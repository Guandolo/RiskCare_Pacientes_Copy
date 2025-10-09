import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cargar contexto (perfil + documentos breves)
    const { data: profile } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { data: documents } = await supabase
      .from("clinical_documents")
      .select("file_name, document_type, document_date, extracted_text, structured_data, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    console.log('Profile:', profile);
    console.log('Documents count:', documents?.length || 0);

    let contextInfo = `INFORMACIÓN DEL PACIENTE:\n`;
    if (profile) {
      contextInfo += `- Nombre: ${profile.full_name || "No disponible"}\n`;
      contextInfo += `- Edad: ${profile.age || "No disponible"}\n`;
      contextInfo += `- EPS: ${profile.eps || "No disponible"}\n`;
      
      // Agregar datos de HiSmart si existen
      if (profile.topus_data && typeof profile.topus_data === 'object') {
        const topusData = profile.topus_data as any;
        if (topusData.hismart_data) {
          contextInfo += `\nDATOS CLÍNICOS DE HISTORIA:\n`;
          contextInfo += JSON.stringify(topusData.hismart_data).substring(0, 1000) + '\n';
        }
      }
    }
    
    if (documents && documents.length > 0) {
      contextInfo += `\nDOCUMENTOS CLÍNICOS (${documents.length} disponibles):\n`;
      documents.forEach((doc: any, idx: number) => {
        contextInfo += `\n${idx + 1}. ${doc.file_name}\n`;
        contextInfo += `   Tipo: ${doc.document_type || "no especificado"}\n`;
        contextInfo += `   Fecha: ${doc.document_date || doc.created_at}\n`;
        if (doc.extracted_text) {
          contextInfo += `   Contenido: ${doc.extracted_text.substring(0, 300)}...\n`;
        }
        if (doc.structured_data) {
          contextInfo += `   Datos: ${JSON.stringify(doc.structured_data).substring(0, 200)}...\n`;
        }
      });
    } else {
      contextInfo += `\nNo hay documentos clínicos cargados todavía.\n`;
    }

    console.log('Context length:', contextInfo.length);

    const systemPrompt = `Eres un asistente que genera preguntas útiles basadas en información clínica real del paciente.

INSTRUCCIONES:
- Genera EXACTAMENTE 4 preguntas en español
- Basa las preguntas SOLO en la información real que se te proporciona
- Si hay documentos específicos, pregunta sobre ellos
- Si hay datos de historia clínica, pregunta sobre resultados o fechas
- Si NO hay documentos, genera preguntas genéricas sobre términos médicos comunes
- NO inventes información que no esté en el contexto
- Las preguntas deben ayudar al paciente a entender su información médica

Ejemplos de buenas preguntas según contexto:
- Si hay documento de laboratorio: "¿Qué significan los resultados de mi último examen de sangre?"
- Si hay múltiples consultas: "¿Cuándo fue mi última consulta de cardiología?"
- Si hay medicamentos: "¿Qué medicamentos me han formulado recientemente?"
- Si NO hay documentos: "¿Qué significa hipertensión arterial esencial?"`;

    const body: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextInfo },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_questions",
            description: "Devuelve exactamente 4 preguntas sugeridas en español basadas en los datos clínicos del paciente",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: { 
                    type: "string",
                    description: "Una pregunta en español sobre la información clínica del paciente"
                  },
                  minItems: 4,
                  maxItems: 4,
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "suggest_questions" } },
    };
    
    console.log('Calling AI for suggestions...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI suggestions error:", response.status, t);
      // Devolver preguntas por defecto si falla
      const defaultSuggestions = [
        "¿Qué significa hipertensión arterial esencial?",
        "¿Cuáles fueron los resultados de mi último examen de sangre?",
        "¿Cuándo fue mi última consulta de cardiología?",
        "¿Qué medicamentos me han formulado recientemente?",
      ];
      return new Response(JSON.stringify({ suggestions: defaultSuggestions }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data).substring(0, 500));
    
    const choice = data.choices?.[0];
    let suggestions: string[] = [];

    const toolCalls = choice?.message?.tool_calls;
    if (toolCalls && toolCalls[0]?.function?.arguments) {
      try {
        const args = JSON.parse(toolCalls[0].function.arguments);
        console.log('Tool call args:', args);
        if (Array.isArray(args.suggestions)) {
          suggestions = args.suggestions;
        }
      } catch (e) {
        console.error('Error parsing tool call:', e);
      }
    }

    // Fallback: intentar extraer del contenido
    if (!suggestions.length && typeof choice?.message?.content === "string") {
      console.log('Using fallback - parsing from content');
      suggestions = choice.message.content
        .split("\n")
        .map((s: string) => s.replace(/^[-*•0-9.)\s]+/, "").trim())
        .filter((s: string) => s.length > 10 && s.includes("?"))
        .slice(0, 4);
    }

    // Si aún no hay sugerencias, usar defaults
    if (!suggestions.length) {
      console.log('No suggestions generated, using defaults');
      suggestions = [
        "¿Qué significa hipertensión arterial esencial?",
        "¿Cuáles fueron los resultados de mi último examen de sangre?",
        "¿Cuándo fue mi última consulta de cardiología?",
        "¿Qué medicamentos me han formulado recientemente?",
      ];
    }

    console.log('Final suggestions:', suggestions);
    
    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-suggestions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});