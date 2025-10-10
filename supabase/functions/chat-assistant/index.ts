import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const { message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Obtener contexto: datos del paciente y documentos
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const { data: documents } = await supabase
      .from('clinical_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Construir contexto para el asistente
    let contextInfo = `INFORMACIÓN DEL PACIENTE:\n`;
    if (profile) {
      contextInfo += `- Nombre: ${profile.full_name || 'No disponible'}\n`;
      contextInfo += `- Edad: ${profile.age || 'No disponible'}\n`;
      contextInfo += `- EPS: ${profile.eps || 'No disponible'}\n`;
    }

    if (documents && documents.length > 0) {
      contextInfo += `\nDOCUMENTOS CLÍNICOS DISPONIBLES:\n`;
      documents.forEach((doc: any, idx: number) => {
        contextInfo += `\n[Documento ${idx + 1}: ${doc.file_name}]\n`;
        if (doc.extracted_text) {
          contextInfo += `Contenido: ${doc.extracted_text.substring(0, 1000)}...\n`;
        }
        if (doc.structured_data) {
          contextInfo += `Datos estructurados: ${JSON.stringify(doc.structured_data)}\n`;
        }
      });
    }

    // Obtener historial de chat
    const { data: chatHistory } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(10);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextInfo },
    ];

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({ role: 'user', content: message });

    console.log('Enviando request a Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de Lovable AI:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Guardar mensajes en la base de datos
    await supabase.from('chat_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: assistantMessage }
    ]);

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error en chat-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
