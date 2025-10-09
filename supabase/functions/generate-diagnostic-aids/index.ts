import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('Generating diagnostic aids for user:', user.id);

    // Get patient profile
    const { data: profile, error: profileError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw new Error('No patient profile found');
    }

    // Get all clinical documents
    const { data: documents, error: docsError } = await supabase
      .from('clinical_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('document_date', { ascending: false });

    if (docsError) {
      console.error('Documents error:', docsError);
      throw new Error('Error fetching documents');
    }

    // Prepare context for AI
    const patientContext = `
Nombre: ${profile.topus_data?.result?.nombre || ''} ${profile.topus_data?.result?.s_nombre || ''} ${profile.topus_data?.result?.apellido || ''} ${profile.topus_data?.result?.s_apellido || ''}
Edad: ${profile.topus_data?.result?.edad || profile.age || 'N/A'}
Sexo: ${profile.topus_data?.result?.sexo || 'N/A'}
    `.trim();

    const documentsContext = documents?.map(doc => `
Documento: ${doc.file_name}
Fecha: ${doc.document_date || 'N/A'}
Tipo: ${doc.document_type || 'N/A'}
Contenido extraído:
${doc.extracted_text || 'Sin texto extraído'}
---
    `).join('\n') || 'No hay documentos disponibles';

    const hismartData = profile.topus_data?.hismart_data;
    const hismartContext = hismartData ? `
Datos de HiSmart:
${JSON.stringify(hismartData, null, 2)}
    ` : 'No hay datos de HiSmart disponibles';

    const systemPrompt = `Eres un asistente médico especializado en analizar historias clínicas para extraer información sobre ayudas diagnósticas (estudios de imagenología).

Tu tarea es analizar TODA la información clínica disponible y extraer ÚNICAMENTE los estudios de imagenología, como:
- Radiografías
- Ecografías/Ultrasonidos
- Ecocardiogramas
- Resonancias magnéticas
- Tomografías
- Mamografías
- Endoscopias
- Colonoscopias
- Otros estudios de imagen

Para cada estudio encontrado, debes generar un objeto con:
- id: identificador único (ej: "eco_2023_03_22")
- type: tipo de estudio (ej: "Ecocardiograma Doppler")
- date: fecha del estudio en formato YYYY-MM-DD
- summary: resumen breve de las conclusiones o hallazgos principales (máximo 200 caracteres)
- findings: lista de hallazgos específicos encontrados en el informe
- conclusion: conclusión principal del estudio
- doctor: nombre del médico o especialista que realizó/interpretó el estudio (si está disponible)
- source: nombre del documento de donde se extrajo la información

IMPORTANTE: 
- Solo incluye estudios de imagenología, NO incluyas laboratorios
- Si no encuentras estudios de imagenología, devuelve un array vacío
- Ordena los estudios por fecha, de más reciente a más antiguo
- Sé preciso en las fechas
- Los resúmenes deben ser claros y comprensibles para el paciente

Devuelve SOLO un JSON válido con este formato:
{
  "studies": [
    {
      "id": "string",
      "type": "string",
      "date": "YYYY-MM-DD",
      "summary": "string",
      "findings": ["string"],
      "conclusion": "string",
      "doctor": "string",
      "source": "string"
    }
  ]
}`;

    const userPrompt = `Analiza la siguiente información clínica y extrae todas las ayudas diagnósticas (estudios de imagenología):

INFORMACIÓN DEL PACIENTE:
${patientContext}

DOCUMENTOS CLÍNICOS:
${documentsContext}

DATOS DE HISMART:
${hismartContext}

Extrae y estructura toda la información de ayudas diagnósticas encontrada.`;

    console.log('Calling Lovable AI...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    console.log('AI Response:', aiContent);

    // Parse the JSON response
    let diagnosticAids;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        diagnosticAids = JSON.parse(jsonMatch[0]);
      } else {
        diagnosticAids = { studies: [] };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      diagnosticAids = { studies: [] };
    }

    console.log('Generated diagnostic aids data:', JSON.stringify(diagnosticAids, null, 2));

    return new Response(
      JSON.stringify({ diagnosticAids }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-diagnostic-aids function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
