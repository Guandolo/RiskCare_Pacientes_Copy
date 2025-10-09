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

    const prompt = `Analiza la siguiente información clínica del paciente y genera un mapa conceptual interactivo en formato JSON.

INFORMACIÓN CLÍNICA:
${clinicalContext}

REGLAS CRÍTICAS PARA GENERAR EL MAPA:

1. NODOS - Debes crear estos tipos de nodos:
   - UN nodo "patient" central con el nombre del paciente
   - Nodos "condition" para CADA condición/diagnóstico mencionado
   - Nodos "medication" para CADA medicamento formulado
   - Nodos "paraclinical" para resultados de laboratorio/exámenes relevantes
   - Nodos "specialist" para especialidades médicas que tratan al paciente

2. CONEXIONES OBLIGATORIAS:
   - SIEMPRE conecta el paciente a sus condiciones principales
   - SIEMPRE conecta cada medicamento a la condición específica que trata
   - SIEMPRE conecta cada paraclínico a la condición que monitorea
   - SIEMPRE conecta cada especialista a las condiciones que maneja
   - NUNCA dejes nodos aislados sin conexiones

3. EJEMPLO DE ESTRUCTURA CORRECTA:
   patient → "Diabetes Mellitus Tipo 2"
   "Diabetes Mellitus Tipo 2" → "Metformina 850mg" (label: "tratada con")
   "Diabetes Mellitus Tipo 2" → "HbA1c: 7.2%" (label: "monitoreada por")
   "Diabetes Mellitus Tipo 2" → "Endocrinología" (label: "manejada por")

FORMATO DE SALIDA (JSON):
{
  "nodes": [
    {
      "id": "patient",
      "type": "patient",
      "label": "Nombre Paciente"
    },
    {
      "id": "condition_diabetes",
      "type": "condition",
      "label": "Diabetes Mellitus Tipo 2"
    },
    {
      "id": "med_metformina",
      "type": "medication",
      "label": "Metformina 850mg"
    },
    {
      "id": "para_hba1c",
      "type": "paraclinical",
      "label": "HbA1c: 7.2%"
    },
    {
      "id": "spec_endocrino",
      "type": "specialist",
      "label": "Endocrinología"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "patient",
      "target": "condition_diabetes",
      "label": "padece"
    },
    {
      "id": "e2",
      "source": "condition_diabetes",
      "target": "med_metformina",
      "label": "tratada con"
    },
    {
      "id": "e3",
      "source": "condition_diabetes",
      "target": "para_hba1c",
      "label": "monitoreada por"
    },
    {
      "id": "e4",
      "source": "condition_diabetes",
      "target": "spec_endocrino",
      "label": "manejada por"
    }
  ]
}

IMPORTANTE:
- Usa IDs descriptivos (condition_X, med_X, para_X, spec_X)
- Labels de edges deben ser verbos claros
- Responde ÚNICAMENTE con el JSON, sin markdown ni texto adicional
- TODAS las conexiones deben tener sentido clínico`;

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
