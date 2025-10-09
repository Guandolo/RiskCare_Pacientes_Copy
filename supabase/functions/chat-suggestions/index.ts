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

    let contextInfo = `INFORMACIÓN DEL PACIENTE PARA SUGERENCIAS:\n`;
    if (profile) {
      contextInfo += `- Nombre: ${profile.full_name || "No disponible"}\n`;
      contextInfo += `- Edad: ${profile.age || "No disponible"}\n`;
      contextInfo += `- EPS: ${profile.eps || "No disponible"}\n`;
    }
    if (documents && documents.length > 0) {
      contextInfo += `\nRESUMEN DE DOCUMENTOS:\n`;
      documents.forEach((doc: any, idx: number) => {
        contextInfo += `- ${idx + 1}. ${doc.file_name} (${doc.document_type || "desconocido"}) fecha: ${doc.document_date || doc.created_at}\n`;
        if (doc.extracted_text) contextInfo += `  pistas: ${doc.extracted_text.substring(0, 180)}...\n`;
      });
    }

    const systemPrompt = `Genera 4 preguntas cortas y útiles en español, basadas EXCLUSIVAMENTE en los datos clínicos provistos. \n` +
      `Evita diagnósticos o recomendaciones. Apunta a preguntas que ayuden a entender documentos, resultados, fechas y medicamentos.`;

    const body: any = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextInfo },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_questions",
            description: "Devuelve entre 3 y 5 preguntas sugeridas en español",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "suggest_questions" } },
      model: "google/gemini-2.5-flash",
    };

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
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    let suggestions: string[] = [];

    const toolCalls = choice?.message?.tool_calls;
    if (toolCalls && toolCalls[0]?.function?.arguments) {
      try {
        const args = JSON.parse(toolCalls[0].function.arguments);
        if (Array.isArray(args.suggestions)) suggestions = args.suggestions;
      } catch (_) { /* ignore */ }
    }

    if (!suggestions.length && typeof choice?.message?.content === "string") {
      // Fallback: dividir por líneas
      suggestions = choice.message.content
        .split("\n")
        .map((s: string) => s.replace(/^[-*•]\s*/, "").trim())
        .filter((s: string) => s)
        .slice(0, 4);
    }

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