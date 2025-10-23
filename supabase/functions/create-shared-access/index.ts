import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener el usuario autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { durationMinutes, permissions } = await req.json();

    // Validar parámetros
    if (!durationMinutes || ![5, 15, 30, 60, 180].includes(durationMinutes)) {
      throw new Error('Invalid duration. Must be 5, 15, 30, 60, or 180 minutes');
    }

    // Verificar que el usuario tenga un perfil de paciente
    const { data: patientProfile, error: profileError } = await supabase
      .from('patient_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !patientProfile) {
      throw new Error('No patient profile found for this user');
    }

    // Generar token único (usando crypto random)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Calcular fecha de expiración
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Crear el registro de acceso compartido
    const { data: sharedAccess, error: createError } = await supabase
      .from('shared_access_tokens')
      .insert({
        patient_user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        permissions: permissions || {
          allow_download: false,
          allow_chat: false,
          allow_notebook: false
        }
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating shared access:', createError);
      throw createError;
    }

    console.log(`Created shared access token for user ${user.id}, expires at ${expiresAt}`);

    // Generar URL del portal usando el subdominio de la aplicación
    const shareUrl = `https://pacientes.riskcare.ai/guest/${token}`;

    return new Response(
      JSON.stringify({
        token: sharedAccess.token,
        shareUrl,
        expiresAt: sharedAccess.expires_at,
        permissions: sharedAccess.permissions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in create-shared-access:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
