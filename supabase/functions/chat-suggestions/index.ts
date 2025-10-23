import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json",
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

    // Obtener el contexto de la conversación y el targetUserId del body
    const { conversationContext, targetUserId } = await req.json();
    
    // Determinar qué usuario se está consultando
    let patientUserId = user.id;
    
    // Si se proporciona targetUserId, verificar permisos
    if (targetUserId && targetUserId !== user.id) {
      // Verificar que el usuario autenticado es un profesional con acceso a este paciente
      const { data: hasAccess } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'profesional_clinico' 
      });
      
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "No autorizado para acceder a datos de otros usuarios" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Verificar que el profesional tiene acceso a este paciente a través de una clínica
      const { data: clinicaAccess, error: accessError } = await supabase
        .from('clinica_profesionales')
        .select(`
          clinica_id,
          clinica_pacientes!inner(paciente_user_id)
        `)
        .eq('profesional_user_id', user.id)
        .eq('clinica_pacientes.paciente_user_id', targetUserId)
        .limit(1)
        .maybeSingle();
      
      if (accessError || !clinicaAccess) {
        return new Response(JSON.stringify({ error: "No tienes acceso a este paciente" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      patientUserId = targetUserId;
    }

    const API_GEMINI = Deno.env.get("API_GEMINI");
    if (!API_GEMINI) {
      return new Response(JSON.stringify({ error: "API_GEMINI no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cargar contexto (perfil + documentos breves) del paciente correcto
    const { data: profile } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", patientUserId)
      .single();

    const { data: documents } = await supabase
      .from("clinical_documents")
      .select("file_name, document_type, document_date, extracted_text, structured_data, created_at")
      .eq("user_id", patientUserId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    // Obtener información del profesional si aplica
    let profesionalInfo = null;
    if (targetUserId && targetUserId !== user.id) {
      const { data: profData } = await supabase
        .from('profesionales_clinicos')
        .select('rethus_data')
        .eq('user_id', user.id)
        .single();
      
      if (profData?.rethus_data) {
        profesionalInfo = profData.rethus_data;
      }
    }

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
    console.log('Conversation context:', conversationContext?.length || 0, 'messages');

    // Construir el prompt considerando el contexto de la conversación
    let conversationSummary = '';
    if (conversationContext && conversationContext.length > 0) {
      conversationSummary = '\n\nCONTEXTO DE LA CONVERSACIÓN ACTUAL:\n';
      // Tomar los últimos 4 mensajes para contexto
      const recentMessages = conversationContext.slice(-4);
      recentMessages.forEach((msg: any, idx: number) => {
        conversationSummary += `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
      });
      conversationSummary += '\nBASADO en esta conversación, genera preguntas de seguimiento que ayuden al usuario a profundizar en los temas que está explorando.\n';
    }

    // Determinar el prompt del sistema según el rol
    let systemPrompt = '';
    
    if (profesionalInfo) {
      // Prompt para profesionales clínicos
      const profesion = profesionalInfo.datos_academicos?.[0]?.profesion_u_ocupacion || 'profesional de la salud';
      const especialidad = profesionalInfo.datos_academicos?.[0]?.tipo_programa || '';
      
      systemPrompt = `Eres un asistente clínico AVANZADO diseñado para apoyar a profesionales de la salud.

CONTEXTO DEL PROFESIONAL:
- Profesión: ${profesion}
- Especialidad: ${especialidad}

REGLAS FUNDAMENTALES:
- Genera EXACTAMENTE 3 preguntas TÉCNICAS en español (máximo 15 palabras cada una)
- Las preguntas deben usar TERMINOLOGÍA MÉDICA apropiada para un ${profesion}
- ENFÓCATE en análisis clínicos, correlaciones, tendencias y hallazgos relevantes
- Prioriza preguntas que ayuden en el proceso de EVALUACIÓN CLÍNICA
- Si HAY contexto de conversación, genera preguntas de SEGUIMIENTO especializadas
- Las preguntas pueden explorar diagnósticos diferenciales, criterios clínicos, y planes de manejo

TIPOS DE PREGUNTAS SUGERIDAS (Enfoque Clínico):
✓ "¿Cuál es la tendencia de [parámetro] en los últimos 6 meses?"
✓ "¿Hay correlación entre [medicamento] y [resultado de laboratorio]?"
✓ "¿Qué hallazgos relevantes muestran los estudios de [especialidad]?"
✓ "¿Cuáles son los factores de riesgo identificados en el historial?"
✓ "¿Hay adherencia al tratamiento de [condición]?"
✓ "¿Qué criterios diagnósticos cumple según [guía clínica]?"
✓ Preguntas de seguimiento basadas en evaluación clínica

OBJETIVO: Facilitar la evaluación clínica del paciente con preguntas técnicas y relevantes.`;
    } else {
      // Prompt para pacientes
      systemPrompt = `Eres un asistente que genera preguntas EXPLORATORIAS para ayudar al paciente a COMPRENDER su información médica existente.

REGLAS FUNDAMENTALES - NO NEGOCIABLES:
- Genera EXACTAMENTE 3 preguntas CORTAS en español (máximo 10 palabras cada una)
- Las preguntas NUNCA deben solicitar diagnósticos, recomendaciones o consejos médicos
- Las preguntas SOLO deben buscar EXPLORAR y ENTENDER los datos ya disponibles
- ENFÓCATE en aclarar términos médicos, fechas, resultados y contenido de documentos
- Si HAY contexto de conversación, genera preguntas de SEGUIMIENTO relacionadas con lo que el usuario está preguntando
- Si NO hay documentos ni conversación, pregunta sobre términos médicos comunes para educar al paciente
- NO inventes información que no esté en el contexto

TIPOS DE PREGUNTAS PERMITIDAS (Enfoque: Exploración de Datos):
✓ "¿Qué significa [término médico] que aparece en mi documento?"
✓ "¿Cuáles fueron los resultados de [examen específico] en mi documento del [fecha]?"
✓ "¿Cuándo fue mi última consulta de [especialidad] según mis documentos?"
✓ "¿Qué medicamentos aparecen formulados en mi historial?"
✓ "¿Qué estudios de imagenología tengo registrados?"
✓ "¿Cuál es la tendencia de mi [parámetro] en los últimos exámenes?"
✓ Preguntas de seguimiento basadas en el tema que el usuario está explorando

TIPOS DE PREGUNTAS PROHIBIDAS (Inducen a consejos médicos):
✗ "¿Qué debo hacer con...?"
✗ "¿Es normal que...?"
✗ "¿Debería preocuparme por...?"
✗ "¿Qué tratamiento necesito para...?"
✗ "¿Es grave mi condición de...?"
✗ Cualquier pregunta que espere una opinión clínica o recomendación

OBJETIVO: El paciente debe poder explorar y comprender sus datos sin inducir al asistente a actuar como médico.`;
    }

    const body: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextInfo + conversationSummary },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_questions",
            description: "Devuelve exactamente 3 preguntas CORTAS (máximo 10 palabras) EXPLORATORIAS en español basadas en los datos clínicos del paciente",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: { 
                    type: "string",
                    description: "Una pregunta exploratoria CORTA (máximo 10 palabras) en español sobre la información clínica"
                  },
                  minItems: 3,
                  maxItems: 3,
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
    
    console.log('Calling Gemini for suggestions...');

    const promptText = `${systemPrompt}\n\n${contextInfo}${conversationSummary}\n\nDevuelve SOLO un JSON válido con la forma {"suggestions":["...","...","..."]} con exactamente 3 preguntas cortas en español. No incluyas texto adicional.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_GEMINI}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini suggestions error:', geminiResponse.status, errorText);
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Límite de solicitudes de Gemini excedido, intenta luego.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Defaults si falla
      const defaultSuggestions = [
        '¿Qué significa hipertensión arterial?',
        '¿Cuáles fueron mis últimos resultados?',
        '¿Cuándo fue mi última consulta?',
      ];
      return new Response(JSON.stringify({ suggestions: defaultSuggestions }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let suggestions: string[] = [];
    // Intentar parsear JSON
    if (rawText) {
      try {
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');
        const jsonSlice = start !== -1 && end !== -1 ? rawText.slice(start, end + 1) : rawText;
        const parsed = JSON.parse(jsonSlice);
        if (Array.isArray(parsed?.suggestions)) {
          suggestions = parsed.suggestions;
        }
      } catch (e) {
        console.warn('Gemini JSON parse fallback:', e);
      }
    }

    // Fallback: extraer líneas con signos de pregunta
    if (!suggestions.length && rawText) {
      suggestions = rawText
        .split('\n')
        .map((s: string) => s.replace(/^[\-\*•0-9.)\s]+/, '').trim())
        .filter((s: string) => s.length > 6 && s.includes('?'))
        .slice(0, 3);
    }

    if (!suggestions.length) {
      suggestions = [
        '¿Qué significa hipertensión arterial?',
        '¿Cuáles fueron mis últimos resultados?',
        '¿Cuándo fue mi última consulta?',
      ];
    }

    console.log('Final suggestions:', suggestions);
    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("chat-suggestions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});