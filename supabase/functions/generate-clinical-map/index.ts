import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating clinical map for user:', user.id);

    // Obtener perfil del paciente
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Obtener documentos clínicos
    const { data: documents } = await supabase
      .from('clinical_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('document_date', { ascending: false });

    // Construir contexto para la IA
    let clinicalContext = '';
    
    if (profile?.topus_data) {
      clinicalContext += `\nDATOS DEMOGRÁFICOS:\n${JSON.stringify(profile.topus_data, null, 2)}\n`;
    }

    if (documents && documents.length > 0) {
      clinicalContext += `\nDOCUMENTOS CLÍNICOS:\n`;
      documents.forEach((doc: any, idx: number) => {
        clinicalContext += `\n[Documento ${idx + 1}: ${doc.file_name}]\n`;
        clinicalContext += `Fecha: ${doc.document_date || doc.created_at}\n`;
        if (doc.extracted_text) {
          clinicalContext += `Contenido: ${doc.extracted_text.substring(0, 2000)}...\n`;
        }
        if (doc.structured_data) {
          clinicalContext += `Datos estructurados: ${JSON.stringify(doc.structured_data).substring(0, 1000)}...\n`;
        }
      });
    }

    // Llamar a Lovable AI para generar el mapa
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY no configurado');
    }

    const prompt = `Analiza la siguiente información clínica del paciente y genera un mapa conceptual en formato JSON.

INFORMACIÓN CLÍNICA:
${clinicalContext}

INSTRUCCIONES:
1. Identifica las CONDICIONES médicas principales del paciente
2. Identifica los MEDICAMENTOS formulados
3. Identifica los PARACLÍNICOS relevantes (laboratorios, exámenes)
4. Identifica los ESPECIALISTAS tratantes
5. Establece CONEXIONES lógicas entre estos elementos

FORMATO DE SALIDA (JSON estricto):
{
  "nodes": [
    {
      "id": "unique-id",
      "type": "condition|medication|paraclinical|specialist|patient",
      "label": "Nombre corto",
      "description": "Descripción breve",
      "data": {}
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "source": "source-node-id",
      "target": "target-node-id",
      "label": "tipo de relación"
    }
  ]
}

IMPORTANTE: Responde ÚNICAMENTE con el JSON, sin texto adicional. El nodo principal debe ser tipo "patient".`;

    console.log('Calling Lovable AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Error al generar mapa con IA');
    }

    const aiData = await aiResponse.json();
    let mapData = aiData.choices?.[0]?.message?.content?.trim() || '{}';

    // Limpiar el contenido para extraer solo el JSON
    mapData = mapData.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    console.log('Generated map data:', mapData.substring(0, 500));

    let parsedMap;
    try {
      parsedMap = JSON.parse(mapData);
    } catch (e) {
      console.error('Failed to parse map JSON:', e);
      throw new Error('Error al parsear el mapa generado');
    }

    return new Response(JSON.stringify({ map: parsedMap }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating clinical map:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
