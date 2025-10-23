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

    // Obtener todos los tokens del usuario (activos y revocados)
    const { data: tokens, error: tokensError } = await supabase
      .from('shared_access_tokens')
      .select('*')
      .eq('patient_user_id', user.id)
      .order('created_at', { ascending: false });

    if (tokensError) {
      throw tokensError;
    }

    // Clasificar tokens
    const now = new Date();
    const activeTokens = tokens?.filter(t => 
      !t.revoked_at && new Date(t.expires_at) > now
    ) || [];
    
    const expiredTokens = tokens?.filter(t => 
      !t.revoked_at && new Date(t.expires_at) <= now
    ) || [];
    
    const revokedTokens = tokens?.filter(t => t.revoked_at) || [];

    // Generar URLs para tokens activos usando el subdominio de la aplicación
    const baseUrl = 'https://pacientes.riskcare.ai';
    
    const activeWithUrls = activeTokens.map(token => ({
      ...token,
      shareUrl: `${baseUrl}/guest/${token.token}`,
      timeRemaining: Math.max(0, Math.floor((new Date(token.expires_at).getTime() - now.getTime()) / 1000))
    }));

    return new Response(
      JSON.stringify({
        active: activeWithUrls,
        expired: expiredTokens,
        revoked: revokedTokens,
        total: tokens?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-shared-accesses:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
