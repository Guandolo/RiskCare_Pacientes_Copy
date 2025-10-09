import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Eres un Asistente Clínico virtual para el paciente. Tu único propósito es ayudar al usuario a entender la información contenida en SUS documentos clínicos.

REGLAS ESTRICTAS:
1. Explica términos médicos en lenguaje sencillo y claro
2. Resume documentos, encuentra fechas o resultados específicos
3. Conecta información entre diferentes archivos
4. SIEMPRE cita de qué documento obtuviste la información
5. PROHIBIDO: Dar consejos médicos, ofrecer diagnósticos, recomendar tratamientos o cambios en medicación
6. Solo interpreta lo que está explícitamente escrito
7. Si no tienes la información en los documentos, dilo claramente
8. Sé empático, claro y preciso

Tu rol es educativo e informativo, NO eres un profesional de la salud.`;

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

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Mensaje inválido" }), {
        status: 400,
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

    // Cargar contexto mínimo necesario
    const { data: profile } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { data: documents } = await supabase
      .from("clinical_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: chatHistory } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(10);

    let contextInfo = `INFORMACIÓN DEL PACIENTE:\n`;
    if (profile) {
      contextInfo += `- Nombre: ${profile.full_name || "No disponible"}\n`;
      contextInfo += `- Edad: ${profile.age || "No disponible"}\n`;
      contextInfo += `- EPS: ${profile.eps || "No disponible"}\n`;
    }

    if (documents && documents.length > 0) {
      contextInfo += `\nDOCUMENTOS CLÍNICOS DISPONIBLES:\n`;
      documents.forEach((doc: any, idx: number) => {
        contextInfo += `\n[Documento ${idx + 1}: ${doc.file_name}]\n`;
        if (doc.extracted_text) {
          contextInfo += `Contenido: ${doc.extracted_text.substring(0, 500)}...\n`;
        }
        if (doc.structured_data) {
          contextInfo += `Datos estructurados: ${JSON.stringify(doc.structured_data).substring(0, 500)}...\n`;
        }
      });
    }

    // Guardar mensaje del usuario inmediatamente
    await supabase.from("chat_messages").insert([
      { user_id: user.id, role: "user", content: message },
    ]);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextInfo },
    ];

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((m: any) => messages.push({ role: m.role, content: m.content }));
    }

    messages.push({ role: "user", content: message });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Duplicar el stream: 1) devolver al cliente; 2) acumular para guardar en DB
    const [streamForClient, streamForDb] = aiResponse.body!.tee();

    // Procesar stream para acumular contenido del asistente
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";

    (async () => {
      const reader = streamForDb.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (delta) assistantSoFar += delta;
            } catch (_) {
              // JSON parcial, esperar más
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (e) {
        console.error("Error leyendo stream para DB:", e);
      } finally {
        // Guardar respuesta del asistente
        if (assistantSoFar && assistantSoFar.trim().length > 0) {
          await supabase.from("chat_messages").insert([
            { user_id: user.id, role: "assistant", content: assistantSoFar },
          ]);
        }
      }
    })();

    return new Response(streamForClient, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("chat-stream error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});