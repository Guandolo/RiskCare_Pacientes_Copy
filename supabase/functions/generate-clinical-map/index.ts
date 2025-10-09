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

    const prompt = `Analiza la siguiente información clínica del paciente y crea un mapa clínico interactivo que muestre las relaciones entre condiciones, tratamientos, estudios y especialistas.

INFORMACIÓN CLÍNICA:
${clinicalContext}

INSTRUCCIONES PARA GENERAR EL MAPA:

1. NODOS A CREAR:
   a) UN nodo "patient" (id: "patient") con el nombre completo del paciente
   b) Nodos "condition" para CADA diagnóstico o condición de salud identificada
   c) Nodos "medication" para TODOS los medicamentos mencionados
   d) Nodos "paraclinical" para estudios y resultados de laboratorio clave
   e) Nodos "specialist" para especialidades médicas involucradas

2. CONEXIONES REQUERIDAS (MUY IMPORTANTE):
   
   TIPO 1 - Del PACIENTE a sus CONDICIONES:
   - source: "patient"
   - target: id de cada condición
   - label: "diagnosticado con"
   
   TIPO 2 - De CONDICIONES a MEDICAMENTOS:
   - source: id de condición
   - target: id de medicamento que la trata
   - label: "tratada con"
   
   TIPO 3 - De CONDICIONES a PARACLÍNICOS:
   - source: id de condición
   - target: id de estudio/resultado
   - label: "monitoreada con"
   
   TIPO 4 - De CONDICIONES a ESPECIALISTAS:
   - source: id de condición
   - target: id de especialista
   - label: "controlada por"

3. REGLAS CRÍTICAS:
   - TODOS los nodos DEBEN estar conectados de alguna forma
   - Si un medicamento trata múltiples condiciones, crear múltiples edges
   - Asegurar que cada condición tenga al menos 2 conexiones (medicamentos, estudios o especialistas)
   - NO crear nodos huérfanos (sin conexiones)

FORMATO DE RESPUESTA (JSON puro):
{
  "nodes": [
    {"id": "patient", "type": "patient", "label": "NOMBRE COMPLETO PACIENTE"},
    {"id": "cond_diabetes", "type": "condition", "label": "Diabetes Mellitus Tipo 2"},
    {"id": "cond_hta", "type": "condition", "label": "Hipertensión Arterial"},
    {"id": "med_metformina", "type": "medication", "label": "Metformina 850mg"},
    {"id": "med_losartan", "type": "medication", "label": "Losartán 50mg"},
    {"id": "para_glucosa", "type": "paraclinical", "label": "Glucosa: 130 mg/dL"},
    {"id": "para_hba1c", "type": "paraclinical", "label": "HbA1c: 7.5%"},
    {"id": "para_presion", "type": "paraclinical", "label": "Presión: 145/90 mmHg"},
    {"id": "spec_cardio", "type": "specialist", "label": "Cardiología"},
    {"id": "spec_medint", "type": "specialist", "label": "Medicina Interna"}
  ],
  "edges": [
    {"id": "e1", "source": "patient", "target": "cond_diabetes", "label": "diagnosticado con"},
    {"id": "e2", "source": "patient", "target": "cond_hta", "label": "diagnosticado con"},
    {"id": "e3", "source": "cond_diabetes", "target": "med_metformina", "label": "tratada con"},
    {"id": "e4", "source": "cond_diabetes", "target": "para_glucosa", "label": "monitoreada con"},
    {"id": "e5", "source": "cond_diabetes", "target": "para_hba1c", "label": "monitoreada con"},
    {"id": "e6", "source": "cond_hta", "target": "med_losartan", "label": "tratada con"},
    {"id": "e7", "source": "cond_hta", "target": "para_presion", "label": "monitoreada con"},
    {"id": "e8", "source": "cond_hta", "target": "spec_cardio", "label": "controlada por"},
    {"id": "e9", "source": "cond_diabetes", "target": "spec_medint", "label": "controlada por"}
  ]
}

RESPONDE ÚNICAMENTE CON EL JSON. Sin comentarios, sin markdown, sin explicaciones.`;

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
