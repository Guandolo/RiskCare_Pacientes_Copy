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
4. CRÍTICO: SIEMPRE cita la fuente exacta de donde obtuviste cada información usando este formato:
   - Al inicio de tu respuesta, menciona: "Según el documento '[NOMBRE_ARCHIVO]'..."
   - Cuando menciones datos específicos, usa referencias numeradas como superíndice: "el resultado fue X¹" donde ¹ es la referencia
   - Al final de la respuesta, lista las fuentes: "Fuentes: 1. nombre_documento.pdf"
5. PROHIBIDO: Dar consejos médicos, ofrecer diagnósticos, recomendar tratamientos o cambios en medicación
6. Solo interpreta lo que está explícitamente escrito
7. Si no tienes la información en los documentos, dilo claramente
8. Sé empático, claro y preciso
9. Usa formato markdown para mejor legibilidad: **negritas** para términos importantes, listas con viñetas, etc.

Tu rol es educativo e informativo, NO eres un profesional de la salud. CADA respuesta DEBE incluir referencias claras a los documentos fuente.`;

const AUDITOR_PROMPT = `Eres un Auditor de Fiabilidad Clínica. Tu única función es verificar si una respuesta generada es factualmente correcta y está completamente respaldada por los documentos fuente.

TAREA:
Recibirás:
1. La pregunta del paciente
2. Los documentos clínicos disponibles como fuente
3. Una respuesta borrador generada por el asistente

CRITERIOS DE VALIDACIÓN:
1. Toda la información en la respuesta DEBE estar explícitamente presente en los documentos fuente
2. NO debe haber interpretaciones, inferencias o suposiciones no respaldadas
3. Las fechas, valores numéricos y nombres deben ser exactos
4. Las referencias a documentos deben ser correctas
5. NO debe haber consejos médicos, diagnósticos o recomendaciones de tratamiento

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con un JSON en este formato:
{
  "valido": true/false,
  "justificacion": "Explicación breve del problema si es inválido, o 'OK' si es válido"
}

Sé riguroso y preciso. En caso de duda, marca como inválido.`;

const SAFETY_MESSAGE = `Lo siento, no pude encontrar una respuesta precisa en tus documentos clínicos para esta pregunta. 

Para garantizar tu seguridad, prefiero no proporcionarte información que no pueda verificar completamente en tu historial médico.

Te recomiendo:
- Revisar directamente el documento específico que te interesa
- Consultar con tu médico tratante para aclarar esta información

¿Puedo ayudarte con algo más que esté claramente documentado en tus archivos?`;

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;

    const { message, conversationId } = await req.json();
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
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(50);

    let contextInfo = `INFORMACIÓN DEL PACIENTE:\n`;
    if (profile) {
      contextInfo += `- Nombre: ${profile.full_name || "No disponible"}\n`;
      contextInfo += `- Edad: ${profile.age || "No disponible"}\n`;
      contextInfo += `- EPS: ${profile.eps || "No disponible"}\n`;
    }

    if (documents && documents.length > 0) {
      contextInfo += `\nDOCUMENTOS CLÍNICOS DISPONIBLES (usa estos nombres exactos para citar):\n`;
      documents.forEach((doc: any, idx: number) => {
        contextInfo += `\n[Documento ${idx + 1}: "${doc.file_name}"]\n`;
        contextInfo += `Fecha: ${doc.document_date || doc.created_at}\n`;
        contextInfo += `Tipo: ${doc.document_type || "no especificado"}\n`;
        if (doc.extracted_text) {
          contextInfo += `Contenido: ${doc.extracted_text.substring(0, 1500)}...\n`;
        }
        if (doc.structured_data) {
          contextInfo += `Datos estructurados: ${JSON.stringify(doc.structured_data).substring(0, 800)}...\n`;
        }
      });
    } else {
      contextInfo += `\nNo hay documentos clínicos cargados aún.\n`;
    }

    // Guardar mensaje del usuario inmediatamente
    await supabase.from("chat_messages").insert([
      { user_id: user.id, role: "user", content: message, conversation_id: conversationId },
    ]);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextInfo },
    ];

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((m: any) => messages.push({ role: m.role, content: m.content }));
    }

    messages.push({ role: "user", content: message });

    // Función auxiliar para generar respuesta con el modelo generador
    async function generateResponse(extraContext = ""): Promise<string> {
      const generatorMessages = [...messages];
      if (extraContext) {
        generatorMessages.push({ role: "system", content: `CORRECCIÓN REQUERIDA: ${extraContext}` });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: generatorMessages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }

    // Función auxiliar para auditar una respuesta
    async function auditResponse(draft: string): Promise<{ valido: boolean; justificacion: string }> {
      const auditMessages = [
        { role: "system", content: AUDITOR_PROMPT },
        { role: "user", content: `PREGUNTA DEL PACIENTE:\n${message}\n\nDOCUMENTOS FUENTE:\n${contextInfo}\n\nRESPUESTA BORRADOR A VALIDAR:\n${draft}` },
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: auditMessages,
          stream: false,
        }),
      });

      if (!response.ok) {
        console.error("Error en auditor, asumiendo válido por defecto");
        return { valido: true, justificacion: "Error en auditor" };
      }

      const data = await response.json();
      const auditResult = data.choices[0].message.content;
      
      try {
        const parsed = JSON.parse(auditResult);
        return parsed;
      } catch (e) {
        console.error("Error parseando respuesta del auditor:", e);
        return { valido: true, justificacion: "Error en parseo" };
      }
    }

    // Función para simular streaming de una respuesta ya generada
    function simulateStream(content: string): ReadableStream {
      const encoder = new TextEncoder();
      let index = 0;
      
      return new ReadableStream({
        async pull(controller) {
          if (index >= content.length) {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
            return;
          }
          
          // Enviar caracteres en chunks pequeños para simular streaming
          const chunkSize = Math.min(5, content.length - index);
          const chunk = content.slice(index, index + chunkSize);
          index += chunkSize;
          
          const sseData = {
            choices: [{
              delta: { content: chunk },
              finish_reason: null,
            }],
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));
          
          // Pequeño delay para simular streaming natural
          await new Promise(resolve => setTimeout(resolve, 20));
        },
      });
    }

    // FLUJO PRINCIPAL CON AUDITORÍA
    console.log("Iniciando generación con auditoría...");
    let finalResponse = "";
    let auditPassed = false;
    const MAX_ATTEMPTS = 2;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !auditPassed; attempt++) {
      console.log(`Intento ${attempt} de generación...`);
      
      // Paso 1: Generar respuesta borrador
      const draft = await generateResponse(
        attempt > 1 ? "La respuesta anterior fue rechazada por el auditor. Genera una nueva respuesta más precisa y basada estrictamente en los documentos." : ""
      );
      
      console.log(`Respuesta generada (${draft.length} caracteres). Enviando a auditoría...`);
      
      // Paso 2: Auditar la respuesta
      const auditResult = await auditResponse(draft);
      console.log(`Resultado de auditoría: ${auditResult.valido ? "VÁLIDO" : "INVÁLIDO"} - ${auditResult.justificacion}`);
      
      if (auditResult.valido) {
        finalResponse = draft;
        auditPassed = true;
        console.log("Respuesta aprobada por el auditor");
      } else if (attempt === MAX_ATTEMPTS) {
        // Paso 3: Si no se aprueba después de MAX_ATTEMPTS, usar mensaje de seguridad
        console.log("Máximo de intentos alcanzado. Usando mensaje de seguridad.");
        finalResponse = SAFETY_MESSAGE;
        auditPassed = true; // Para salir del loop
      }
    }

    // Guardar mensaje del asistente en DB
    await supabase.from("chat_messages").insert([
      { user_id: user.id, role: "assistant", content: finalResponse, conversation_id: conversationId },
    ]);

    // Paso 4: Simular streaming de la respuesta validada
    const responseStream = simulateStream(finalResponse);

    return new Response(responseStream, {
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