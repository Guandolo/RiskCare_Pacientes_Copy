import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('Generando análisis corporal para usuario:', user.id);

    // Obtener todos los documentos clínicos y el perfil del usuario
    const { data: documents, error: docsError } = await supabase
      .from('clinical_documents')
      .select('extracted_text, structured_data, document_type, document_date, file_name')
      .eq('user_id', user.id);

    if (docsError) throw docsError;

    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('topus_data')
      .eq('user_id', user.id)
      .single();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Preparar el contexto para el análisis
    const documentsContext = documents?.map((doc: any) => ({
      tipo: doc.document_type,
      fecha: doc.document_date,
      nombre: doc.file_name,
      texto: doc.extracted_text,
      datos: doc.structured_data
    })) || [];

    const systemPrompt = `Eres un asistente médico especializado en análisis de medidas corporales y signos vitales.

Tu tarea es extraer TODOS los registros históricos de medidas corporales y signos vitales de los documentos clínicos del paciente.

MÉTRICAS A EXTRAER:
1. Peso (kg) - busca términos: peso, weight, kg
2. Talla/Estatura (cm o m) - busca términos: talla, estatura, altura, height
3. Presión Arterial (mmHg) - busca términos: TA, PA, presión arterial, blood pressure, sistólica/diastólica
4. Frecuencia Cardíaca (lpm) - busca términos: FC, frecuencia cardíaca, heart rate, pulso

REGLAS IMPORTANTES:
1. Extrae TODOS los registros históricos, no solo el más reciente
2. Para cada medida, captura el valor exacto y la fecha del documento
3. Para presión arterial, extrae tanto sistólica como diastólica
4. Ordena cronológicamente todos los registros
5. Si encuentras peso y talla en la misma fecha, calcula el IMC (peso/(talla_en_metros)²)

FORMATO DE SALIDA:
Debes responder SOLO con un JSON válido en este formato exacto:
{
  "medidas": {
    "peso": [
      { "fecha": "2023-01-15", "valor": 75.5, "fuente": "Historia Clínica - Consulta Externa" }
    ],
    "talla": [
      { "fecha": "2023-01-15", "valor": 170, "fuente": "Historia Clínica - Consulta Externa" }
    ],
    "presionArterial": [
      { "fecha": "2023-01-15", "sistolica": 120, "diastolica": 80, "fuente": "Historia Clínica" }
    ],
    "frecuenciaCardiaca": [
      { "fecha": "2023-01-15", "valor": 72, "fuente": "Historia Clínica" }
    ],
    "imc": [
      { "fecha": "2023-01-15", "valor": 26.1, "peso": 75.5, "talla": 170 }
    ]
  },
  "ultimosValores": {
    "peso": 75.5,
    "talla": 170,
    "imc": 26.1,
    "presionSistolica": 120,
    "presionDiastolica": 80,
    "frecuenciaCardiaca": 72
  }
}

IMPORTANTE: Responde ÚNICAMENTE con el JSON, sin texto adicional antes o después.`;

    const prompt = `Analiza los siguientes documentos clínicos y extrae TODOS los registros históricos de medidas corporales y signos vitales:

DOCUMENTOS:
${JSON.stringify(documentsContext, null, 2)}

DATOS DE PERFIL (puede contener información adicional):
${JSON.stringify(profile?.topus_data || {}, null, 2)}

Recuerda: Responde SOLO con el JSON estructurado, sin explicaciones adicionales.`;

    console.log('Llamando a Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Extraer JSON del contenido
    let bodyAnalysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        bodyAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        bodyAnalysis = JSON.parse(content);
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
      console.log('Content:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log('Análisis corporal generado exitosamente');

    return new Response(
      JSON.stringify({ bodyAnalysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-body-analysis:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
