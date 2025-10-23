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

    const { tokenId } = await req.json();

    if (!tokenId) {
      throw new Error('Token ID is required');
    }

    // Verificar que el token pertenece al usuario
    const { data: token, error: tokenError } = await supabase
      .from('shared_access_tokens')
      .select('*')
      .eq('id', tokenId)
      .eq('patient_user_id', user.id)
      .single();

    if (tokenError || !token) {
      throw new Error('Token not found or does not belong to you');
    }

    // Revocar el token
    const { error: revokeError } = await supabase
      .from('shared_access_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tokenId);

    if (revokeError) {
      throw revokeError;
    }

    console.log(`Token ${tokenId} revoked by user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Access revoked successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in revoke-shared-access:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
