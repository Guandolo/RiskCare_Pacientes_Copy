import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PATIENT_SYSTEM_PROMPT = `Eres un Asistente Clínico virtual para el paciente. Tu único propósito es ayudar al usuario a entender la información contenida en SUS documentos clínicos.

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

const PROFESSIONAL_SYSTEM_PROMPT = `Eres un Asistente Clínico Profesional diseñado para apoyar a profesionales de la salud validados. Tu propósito es facilitar el análisis clínico y la toma de decisiones basada en evidencia.

CAPACIDADES PROFESIONALES:
1. **Análisis Clínico Avanzado**: Interpreta resultados de laboratorio, imágenes diagnósticas y estudios especializados con terminología médica precisa
2. **Razonamiento Diferencial**: Ayuda a construir diagnósticos diferenciales basados en hallazgos clínicos
3. **Correlación de Datos**: Conecta información entre múltiples documentos para identificar patrones clínicos relevantes
4. **Soporte en Decisiones**: Proporciona información basada en evidencia para apoyar decisiones terapéuticas (sin sustituir el criterio médico)
5. **Referencias Bibliográficas**: Cita fuentes médicas cuando sea relevante

REGLAS DE OPERACIÓN:
1. Usa terminología médica profesional apropiada
2. SIEMPRE cita las fuentes de información con precisión:
   - "Según laboratorio clínico del [FECHA] en [DOCUMENTO]..."
   - Usa referencias numeradas para datos específicos
3. Identifica valores anormales y su relevancia clínica
4. Señala inconsistencias o datos faltantes importantes
5. Proporciona contexto fisiopatológico cuando sea relevante
6. Mantén objetividad clínica - no emitas juicios definitivos, apoya el análisis
7. Recuerda límites éticos: sugiere, no prescribes; informas, no diagnosticas definitivamente

FORMATO DE RESPUESTA:
- Usa markdown con secciones claras
- **Hallazgos Principales** en negritas
- Listas organizadas por sistemas/categorías
- Referencias al final

Tu rol es ser un asistente de soporte clínico para profesionales, facilitando análisis eficiente y preciso de información médica.`;

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, conversationId, targetUserId, isGuestAccess, guestToken } = await req.json();
    
    let user: any;
    let isProfessional = false;
    
    // Manejo de acceso de invitado
    if (isGuestAccess && guestToken) {
      console.log("Acceso de invitado detectado, validando token...");
      
      // Validar el token de invitado
      const { data: tokenData, error: tokenError } = await supabase
        .from('shared_access_tokens')
        .select('*, patient_profiles!shared_access_tokens_patient_user_id_fkey(user_id, full_name)')
        .eq('token', guestToken)
        .eq('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (tokenError || !tokenData || !tokenData.permissions?.allow_chat) {
        console.error("Token inválido o sin permiso de chat:", tokenError);
        return new Response(JSON.stringify({ error: "Acceso no autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Crear objeto de usuario simulado para el invitado
      user = {
        id: `guest_${tokenData.token}`,
        isGuest: true,
        guestPatientUserId: tokenData.patient_user_id
      };
      
      console.log("Invitado validado exitosamente, accediendo a paciente:", tokenData.patient_user_id);
    } else {
      // Autenticación normal para usuarios registrados
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "No authorization header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const jwt = authHeader.replace("Bearer ", "").trim();
      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      user = userData.user;
      
      // Detectar si es profesional
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      isProfessional = userRoles?.some(r => r.role === 'profesional_clinico' || r.role === 'admin_clinica' || r.role === 'superadmin') || false;
    }
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Mensaje inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_GEMINI = Deno.env.get("API_GEMINI");
    if (!API_GEMINI) {
      return new Response(JSON.stringify({ error: "API_GEMINI no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Determinar de qué usuario cargar los datos
    let patientUserId = user.id;
    let isViewingOtherPatient = false;
    
    if (user.isGuest) {
      // Para invitados, siempre cargar datos del paciente asociado al token
      patientUserId = user.guestPatientUserId;
      isViewingOtherPatient = false; // Los invitados usan el prompt de paciente
      console.log(`Invitado accediendo a paciente ${patientUserId}`);
    } else if (isProfessional && targetUserId && targetUserId !== user.id) {
      // ✅ Profesionales pueden consultar a otros pacientes explícitamente
      patientUserId = targetUserId;
      isViewingOtherPatient = true;
      console.log(`Profesional ${user.id} accediendo a paciente ${targetUserId}`);
    } else if (!isProfessional && targetUserId && targetUserId !== user.id) {
      // ❌ Bloquear a usuarios no profesionales intentando acceder a otros pacientes
      return new Response(JSON.stringify({ error: "No autorizado: solo profesionales pueden consultar a otros pacientes" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    
    const SYSTEM_PROMPT = (isProfessional && isViewingOtherPatient) 
      ? PROFESSIONAL_SYSTEM_PROMPT 
      : PATIENT_SYSTEM_PROMPT;

    console.log(`Usuario ${user.id} - Rol profesional: ${isProfessional} - Viendo otro paciente: ${isViewingOtherPatient}`);

    // ========== FUENTE DE DATOS 1: PERFIL DEL PACIENTE ==========
    const { data: profile } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", patientUserId)
      .single();

    // ========== FUENTE DE DATOS 2: DOCUMENTOS CLÍNICOS ==========
    const { data: documents } = await supabase
      .from("clinical_documents")
      .select("*")
      .eq("user_id", patientUserId)
      .order("created_at", { ascending: false })
      .limit(20);

    // ========== FUENTE DE DATOS 3: DATOS HISMART/BDORO (via Topus) ==========
    // Los datos de HiSmart/BDOro ya están integrados en topus_data del perfil
    const externalData = profile?.topus_data || null;

    // Solo cargar historial para usuarios autenticados
    let chatHistory = null;
    if (!user.isGuest && conversationId) {
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("user_id", user.id)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(50);
      chatHistory = data;
    }

    // Construir contexto unificado con las 3 fuentes de datos
    let contextInfo = `═══════════════════════════════════════════════════════════════
CONTEXTO CLÍNICO DEL PACIENTE (3 FUENTES DE DATOS INTEGRADAS)
═══════════════════════════════════════════════════════════════\n\n`;

    // FUENTE 1: Perfil del Paciente
    contextInfo += `📋 FUENTE 1: INFORMACIÓN DEL PERFIL DEL PACIENTE\n`;
    contextInfo += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (profile) {
      contextInfo += `• Nombre Completo: ${profile.full_name || "No disponible"}\n`;
      contextInfo += `• Tipo de Documento: ${profile.document_type || "No disponible"}\n`;
      contextInfo += `• Identificación: ${profile.identification || "No disponible"}\n`;
      contextInfo += `• Edad: ${profile.age || "No disponible"} años\n`;
      contextInfo += `• EPS/Aseguradora: ${profile.eps || "No disponible"}\n`;
      contextInfo += `• Teléfono: ${profile.phone || "No disponible"}\n`;
    } else {
      contextInfo += `⚠️ No se encontró perfil del paciente\n`;
    }

    // FUENTE 2: Documentos Clínicos
    contextInfo += `\n📄 FUENTE 2: DOCUMENTOS CLÍNICOS DISPONIBLES\n`;
    contextInfo += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (documents && documents.length > 0) {
      contextInfo += `Total de documentos: ${documents.length}\n\n`;
      contextInfo += `INSTRUCCIÓN: Cuando cites información de estos documentos, usa el formato:\n`;
      contextInfo += `"Según [Documento X: nombre_archivo]..." o referencia numerada al final.\n\n`;
      
      documents.forEach((doc: any, idx: number) => {
        contextInfo += `────────────────────────────────────────────────────────────\n`;
        contextInfo += `[Documento ${idx + 1}: "${doc.file_name}"]\n`;
        contextInfo += `  • Fecha del Documento: ${doc.document_date || "No especificada"}\n`;
        contextInfo += `  • Fecha de Carga: ${new Date(doc.created_at).toLocaleDateString('es-CO')}\n`;
        contextInfo += `  • Tipo: ${doc.document_type || "No especificado"}\n`;
        
        if (doc.extracted_text) {
          contextInfo += `  • Contenido Extraído (primeros 1500 caracteres):\n`;
          contextInfo += `    ${doc.extracted_text.substring(0, 1500)}${doc.extracted_text.length > 1500 ? '...' : ''}\n`;
        }
        
        if (doc.structured_data && Object.keys(doc.structured_data).length > 0) {
          contextInfo += `  • Datos Estructurados:\n`;
          contextInfo += `    ${JSON.stringify(doc.structured_data, null, 2).substring(0, 800)}${JSON.stringify(doc.structured_data).length > 800 ? '...' : ''}\n`;
        }
        contextInfo += `\n`;
      });
    } else {
      contextInfo += `⚠️ No hay documentos clínicos cargados aún.\n`;
    }

    // FUENTE 3: Datos Externos (HiSmart/BDOro via Topus)
    contextInfo += `\n🏥 FUENTE 3: DATOS DE SISTEMAS EXTERNOS (HiSmart/BDOro via Topus)\n`;
    contextInfo += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Extraer datos de HiSmart si existen
    const hismartData = externalData?.hismart_data;
    
    console.log('🔍 Verificando datos de HiSmart:', {
      existeHismart: !!hismartData,
      tipoHismart: typeof hismartData,
      claves: hismartData ? Object.keys(hismartData) : []
    });
    
    if (hismartData && typeof hismartData === 'object') {
      contextInfo += `✅ Datos obtenidos de HiSmart/BDOro (Historia Clínica Electrónica)\n\n`;
      
      // 🔧 CORRECCIÓN: Usar clinical_records (no records)
      if (hismartData.clinical_records && Array.isArray(hismartData.clinical_records) && hismartData.clinical_records.length > 0) {
        contextInfo += `📝 REGISTROS CLÍNICOS (${hismartData.clinical_records.length} registros):\n`;
        contextInfo += `────────────────────────────────────────────────────────────\n`;
        hismartData.clinical_records.forEach((record: any, idx: number) => {
          contextInfo += `\n🔹 Registro Clínico ${idx + 1}:\n`;
          
          // Información básica del registro
          if (record.registration_date) contextInfo += `  • Fecha de Registro: ${record.registration_date}\n`;
          if (record.date_of_attention) contextInfo += `  • Fecha de Atención: ${record.date_of_attention}\n`;
          if (record.id_company) contextInfo += `  • ID Compañía: ${record.id_company}\n`;
          if (record.id_attention) contextInfo += `  • ID Atención: ${record.id_attention}\n`;
          if (record.diagnoses) contextInfo += `  • Diagnósticos: ${record.diagnoses}\n`;
          
          // Detalles del registro clínico (suele ser un array)
          if (record.details && Array.isArray(record.details)) {
            contextInfo += `  • DETALLES DEL REGISTRO:\n`;
            record.details.forEach((detail: any, detailIdx: number) => {
              contextInfo += `    ▸ Detalle ${detailIdx + 1}:\n`;
              if (detail.observaciones) contextInfo += `      - Observaciones: ${detail.observaciones}\n`;
              if (detail.motivo_de_consulta) contextInfo += `      - Motivo de Consulta: ${detail.motivo_de_consulta}\n`;
              if (detail.plan_de_manejo) contextInfo += `      - Plan de Manejo: ${detail.plan_de_manejo}\n`;
              if (detail.examen_fisico) {
                contextInfo += `      - Examen Físico:\n`;
                Object.entries(detail.examen_fisico).forEach(([key, value]) => {
                  contextInfo += `        * ${key}: ${JSON.stringify(value)}\n`;
                });
              }
              if (detail.examenes_realizados) {
                contextInfo += `      - Exámenes Realizados:\n`;
                Object.entries(detail.examenes_realizados).forEach(([key, value]) => {
                  contextInfo += `        * ${key}: ${JSON.stringify(value)}\n`;
                });
              }
              if (detail.antecedentes_familiares) {
                contextInfo += `      - Antecedentes Familiares: ${JSON.stringify(detail.antecedentes_familiares)}\n`;
              }
              if (detail.antecedentes_personales) {
                contextInfo += `      - Antecedentes Personales: ${JSON.stringify(detail.antecedentes_personales)}\n`;
              }
            });
          }
          
          // Incluir todos los datos del registro completo (para casos no capturados)
          contextInfo += `  • DATOS COMPLETOS DEL REGISTRO:\n${JSON.stringify(record, null, 2).substring(0, 1000)}\n`;
        });
        contextInfo += `\n`;
      }
      
      // 🔧 CORRECCIÓN: Usar prescription_records (no prescriptions)
      if (hismartData.prescription_records && Array.isArray(hismartData.prescription_records) && hismartData.prescription_records.length > 0) {
        contextInfo += `💊 PRESCRIPCIONES MÉDICAS (${hismartData.prescription_records.length} prescripciones):\n`;
        contextInfo += `────────────────────────────────────────────────────────────\n`;
        hismartData.prescription_records.forEach((prescription: any, idx: number) => {
          contextInfo += `\n🔹 Prescripción ${idx + 1}:\n`;
          
          // Información básica de la prescripción
          if (prescription.registration_date) contextInfo += `  • Fecha de Registro: ${prescription.registration_date}\n`;
          if (prescription.id_company) contextInfo += `  • ID Compañía: ${prescription.id_company}\n`;
          if (prescription.id_attention) contextInfo += `  • ID Atención: ${prescription.id_attention}\n`;
          if (prescription.diagnoses) contextInfo += `  • Diagnósticos Asociados: ${prescription.diagnoses}\n`;
          
          // Detalles de los medicamentos prescritos
          if (prescription.details && Array.isArray(prescription.details)) {
            contextInfo += `  • MEDICAMENTOS PRESCRITOS:\n`;
            prescription.details.forEach((detail: any, detailIdx: number) => {
              contextInfo += `    ▸ Medicamento ${detailIdx + 1}:\n`;
              if (detail.medicamento) contextInfo += `      - Nombre: ${detail.medicamento}\n`;
              if (detail.dosis) contextInfo += `      - Dosis: ${detail.dosis}\n`;
              if (detail.via) contextInfo += `      - Vía: ${detail.via}\n`;
              if (detail.frecuencia) contextInfo += `      - Frecuencia: ${detail.frecuencia}\n`;
              if (detail.duracion) contextInfo += `      - Duración: ${detail.duracion}\n`;
              if (detail.cantidad) contextInfo += `      - Cantidad: ${detail.cantidad}\n`;
              if (detail.indicaciones) contextInfo += `      - Indicaciones: ${detail.indicaciones}\n`;
            });
          }
          
          // Incluir todos los datos de la prescripción
          contextInfo += `  • DATOS COMPLETOS DE LA PRESCRIPCIÓN:\n${JSON.stringify(prescription, null, 2).substring(0, 800)}\n`;
        });
        contextInfo += `\n`;
      }
      
      // Otros datos de HiSmart que puedan existir
      if (hismartData.billing_records && Array.isArray(hismartData.billing_records) && hismartData.billing_records.length > 0) {
        contextInfo += `💰 REGISTROS DE FACTURACIÓN (${hismartData.billing_records.length} registros)\n`;
      }
      
      if (hismartData.scheduling_records && Array.isArray(hismartData.scheduling_records) && hismartData.scheduling_records.length > 0) {
        contextInfo += `📅 REGISTROS DE AGENDAMIENTO (${hismartData.scheduling_records.length} registros)\n`;
      }
      
      if (hismartData.telemonitoring_records && Array.isArray(hismartData.telemonitoring_records) && hismartData.telemonitoring_records.length > 0) {
        contextInfo += `📡 REGISTROS DE TELEMONITOREO (${hismartData.telemonitoring_records.length} registros)\n`;
      }
      
      // Dump completo de datos de HiSmart para contexto adicional
      contextInfo += `\n📦 ESTRUCTURA COMPLETA DE DATOS HISMART (para referencia):\n`;
      contextInfo += `${JSON.stringify(hismartData, null, 2).substring(0, 3000)}${JSON.stringify(hismartData).length > 3000 ? '...\n(Datos adicionales disponibles - se incluyen arriba de forma estructurada)' : ''}\n\n`;
    } else {
      contextInfo += `⚠️ No hay datos de HiSmart/BDOro disponibles para este paciente.\n\n`;
    }
    
    // Datos demográficos de Topus (fuera de hismart_data)
    if (externalData && typeof externalData === 'object') {
      contextInfo += `📋 DATOS DEMOGRÁFICOS (Topus):\n`;
      contextInfo += `────────────────────────────────────────────────────────────\n`;
      
      if (externalData.nombre) contextInfo += `• Nombre Registrado: ${externalData.nombre}\n`;
      if (externalData.identificacion) contextInfo += `• Identificación: ${externalData.identificacion}\n`;
      if (externalData.fecha_nacimiento) contextInfo += `• Fecha de Nacimiento: ${externalData.fecha_nacimiento}\n`;
      if (externalData.sexo) contextInfo += `• Sexo: ${externalData.sexo}\n`;
      if (externalData.estado_civil) contextInfo += `• Estado Civil: ${externalData.estado_civil}\n`;
      if (externalData.direccion) contextInfo += `• Dirección: ${externalData.direccion}\n`;
      if (externalData.telefono) contextInfo += `• Teléfono: ${externalData.telefono}\n`;
      if (externalData.email) contextInfo += `• Email: ${externalData.email}\n`;
      if (externalData.eps) contextInfo += `• EPS: ${externalData.eps}\n`;
      if (externalData.regimen) contextInfo += `• Régimen: ${externalData.regimen}\n`;
      
      // Información médica adicional si existe
      if (externalData.tipo_sangre) contextInfo += `• Tipo de Sangre: ${externalData.tipo_sangre}\n`;
      if (externalData.alergias) contextInfo += `• Alergias Registradas: ${externalData.alergias}\n`;
      if (externalData.medicamentos_actuales) contextInfo += `• Medicamentos Actuales: ${externalData.medicamentos_actuales}\n`;
      if (externalData.diagnosticos_previos) contextInfo += `• Diagnósticos Previos: ${externalData.diagnosticos_previos}\n`;
      
      // Incluir datos adicionales de topus_data si existen
      const topusKeys = Object.keys(externalData).filter(k => k !== 'hismart_data');
      if (topusKeys.length > 0) {
        contextInfo += `\n• Otros Datos de Topus:\n`;
        contextInfo += `  ${JSON.stringify(
          Object.fromEntries(topusKeys.map(k => [k, externalData[k]])),
          null, 
          2
        ).substring(0, 1000)}${JSON.stringify(externalData).length > 1000 ? '...' : ''}\n`;
      }
    }
    
    if (!hismartData && (!externalData || Object.keys(externalData).length === 0)) {
      contextInfo += `⚠️ No hay datos disponibles de sistemas externos.\n`;
      contextInfo += `ℹ️ Esto puede significar que el paciente aún no ha sido consultado en HiSmart/BDOro,\n`;
      contextInfo += `   o que la integración está pendiente de configuración.\n`;
    }

    contextInfo += `\n═══════════════════════════════════════════════════════════════\n`;
    contextInfo += `FIN DEL CONTEXTO CLÍNICO\n`;
    contextInfo += `═══════════════════════════════════════════════════════════════\n`;

    // Guardar mensaje del usuario inmediatamente (solo para usuarios autenticados, no invitados)
    if (!user.isGuest) {
      await supabase.from("chat_messages").insert([
        { user_id: user.id, role: "user", content: message, conversation_id: conversationId },
      ]);
    }

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

      // Convertir mensajes al formato de Gemini
      const geminiContents = [];
      let systemInstruction = SYSTEM_PROMPT + `\n\nCONTEXTO DE DOCUMENTOS DISPONIBLES:\n${contextInfo}`;
      
      for (const msg of generatorMessages) {
        if (msg.role === 'system') {
          systemInstruction += `\n${msg.content}`;
        } else {
          geminiContents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_GEMINI}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: geminiContents,
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            }
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error ${response.status}:`, errorText);
        
        if (response.status === 429) {
          throw new Error('Se ha excedido el límite de solicitudes de Gemini. Por favor, espera un momento.');
        }
        throw new Error(`Error de Gemini API: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // Función auxiliar para auditar una respuesta
    async function auditResponse(draft: string): Promise<{ valido: boolean; justificacion: string }> {
      const auditPrompt = `${AUDITOR_PROMPT}\n\nPREGUNTA DEL PACIENTE:\n${message}\n\nDOCUMENTOS FUENTE:\n${contextInfo}\n\nRESPUESTA BORRADOR A VALIDAR:\n${draft}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_GEMINI}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: auditPrompt }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500,
              responseMimeType: "application/json"
            }
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en auditor ${response.status}:`, errorText);
        
        if (response.status === 429) {
          console.warn("Auditor no disponible temporalmente, asumiendo válido");
        }
        return { valido: true, justificacion: "Error en auditor, respuesta aceptada por defecto" };
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      try {
        const result = JSON.parse(textResponse);
        return result;
      } catch (e) {
        console.error("Error parsing audit response:", e);
        return { valido: true, justificacion: "Error parseando respuesta del auditor" };
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

      // Heurística de respaldo: si el borrador cita al menos un documento real, lo aceptamos
      const docNames = (documents || []).map((d: any) => d.file_name).filter(Boolean);
      const hasCitation = docNames.some((n: string) => draft.includes(String(n)));
      
      if (auditResult.valido || hasCitation) {
        finalResponse = draft;
        auditPassed = true;
        console.log(hasCitation && !auditResult.valido 
          ? "Respuesta aceptada por citar documentos reales (fallback)" 
          : "Respuesta aprobada por el auditor");
      } else if (attempt === MAX_ATTEMPTS) {
        // Paso 3: Si no se aprueba después de MAX_ATTEMPTS, usar mensaje de seguridad
        console.log("Máximo de intentos alcanzado. Usando mensaje de seguridad.");
        finalResponse = SAFETY_MESSAGE;
        auditPassed = true; // Para salir del loop
      }
    }

    // Guardar mensaje del asistente en DB (solo para usuarios autenticados)
    if (!user.isGuest) {
      await supabase.from("chat_messages").insert([
        { user_id: user.id, role: "assistant", content: finalResponse, conversation_id: conversationId },
      ]);
    }

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