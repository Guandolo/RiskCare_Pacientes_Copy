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

    // Obtener todos los documentos clínicos del usuario
    const { data: documents, error: docsError } = await supabase
      .from('clinical_documents')
      .select('extracted_text, structured_data, document_type, document_date, file_name')
      .eq('user_id', user.id);

    if (docsError) throw docsError;

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

    const systemPrompt = `Eres un asistente médico especializado en analizar resultados de laboratorio (paraclínicos).

Tu tarea es extraer y estructurar TODOS los resultados de laboratorio encontrados en los documentos clínicos del paciente.

REGLAS IMPORTANTES:
1. Identifica TODOS los exámenes de laboratorio mencionados (hemograma, glucosa, colesterol, creatinina, etc.)
2. Para cada examen, extrae: nombre, valor, unidad, fecha, rango de referencia si está disponible
3. Agrupa los resultados por tipo de examen (ej: todas las glucosas juntas)
4. Ordena cronológicamente los valores de cada examen
5. Si un valor está fuera del rango normal, márcalo como anormal
6. Categoriza los exámenes en grupos: Hematología, Química Sanguínea, Función Renal, Función Hepática, Lípidos, etc.

FORMATO DE SALIDA:
Debes responder SOLO con un JSON válido en este formato exacto:
{
  "paraclinicos": [
    {
      "id": "glucosa_ayunas",
      "nombre": "Glucosa en Ayunas",
      "categoria": "Química Sanguínea",
      "unidad": "mg/dL",
      "rangoNormal": "70-100",
      "valores": [
        {
          "fecha": "2023-01-15",
          "valor": 95,
          "anormal": false,
          "fuente": "Laboratorio XYZ - Orden 123"
        },
        {
          "fecha": "2023-06-20",
          "valor": 110,
          "anormal": true,
          "fuente": "Laboratorio ABC - Orden 456"
        }
      ]
    }
  ]
}

IMPORTANTE: Responde ÚNICAMENTE con el JSON, sin texto adicional antes o después.`;

    const prompt = `Analiza los siguientes documentos clínicos y extrae TODOS los resultados de paraclínicos (laboratorios):

${JSON.stringify(documentsContext, null, 2)}

Recuerda: Responde SOLO con el JSON estructurado, sin explicaciones adicionales.`;

    console.log('Generando análisis de paraclínicos...');

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
    let paraclinicos;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        paraclinicos = JSON.parse(jsonMatch[0]);
      } else {
        paraclinicos = JSON.parse(content);
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
      console.log('Content:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log('Paraclínicos generados exitosamente');

    return new Response(
      JSON.stringify({ paraclinicos: paraclinicos.paraclinicos || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-paraclinicos:', error);
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
