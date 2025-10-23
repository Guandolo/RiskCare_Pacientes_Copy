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

    const { token, action, actionDetails } = await req.json();

    if (!token) {
      throw new Error('Token is required');
    }

    // Buscar el token
    const { data: sharedAccess, error: tokenError } = await supabase
      .from('shared_access_tokens')
      .select('*')
      .eq('token', token)
      .is('revoked_at', null)
      .single();

    if (tokenError || !sharedAccess) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token not found or has been revoked' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verificar si el token ha expirado
    const now = new Date();
    const expiresAt = new Date(sharedAccess.expires_at);

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token has expired' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Obtener datos del paciente
    const { data: patientProfile, error: profileError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', sharedAccess.patient_user_id)
      .single();

    if (profileError || !patientProfile) {
      throw new Error('Patient profile not found');
    }

    // Extraer nombre completo de topus_data si está disponible
    let fullName = patientProfile.full_name;
    if (!fullName && patientProfile.topus_data) {
      try {
        const topusData = typeof patientProfile.topus_data === 'string' 
          ? JSON.parse(patientProfile.topus_data) 
          : patientProfile.topus_data;
        
        if (topusData.data?.afiliado?.NombreCompleto) {
          fullName = topusData.data.afiliado.NombreCompleto;
        } else if (topusData.data?.afiliado) {
          const afiliado = topusData.data.afiliado;
          fullName = `${afiliado.PrimerNombre || ''} ${afiliado.SegundoNombre || ''} ${afiliado.PrimerApellido || ''} ${afiliado.SegundoApellido || ''}`.trim();
        }
      } catch (e) {
        console.error('Error extracting name from topus_data:', e);
      }
    }

    // Obtener documentos si se permite
    let documents = null;
    const { data: docs } = await supabase
      .from('clinical_documents')
      .select('id, file_name, file_type, document_type, document_date, created_at')
      .eq('user_id', sharedAccess.patient_user_id)
      .order('created_at', { ascending: false });

    documents = docs || [];

    // Actualizar contador de accesos
    const { error: updateError } = await supabase
      .from('shared_access_tokens')
      .update({
        access_count: sharedAccess.access_count + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', sharedAccess.id);

    if (updateError) {
      console.error('Error updating access count:', updateError);
    }

    // Registrar el acceso en auditoría
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    const { error: logError } = await supabase
      .from('guest_access_logs')
      .insert({
        token_id: sharedAccess.id,
        patient_user_id: sharedAccess.patient_user_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        action_type: action || 'view',
        action_details: actionDetails || null
      });

    if (logError) {
      console.error('Error logging guest access:', logError);
    }

    const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    return new Response(
      JSON.stringify({
        valid: true,
        patient: {
          full_name: fullName,
          identification: patientProfile.identification,
          document_type: patientProfile.document_type,
          age: patientProfile.age,
          eps: patientProfile.eps,
          phone: patientProfile.phone,
          topus_data: patientProfile.topus_data
        },
        documents,
        permissions: sharedAccess.permissions,
        expiresAt: sharedAccess.expires_at,
        timeRemaining,
        accessCount: sharedAccess.access_count + 1,
        patientUserId: sharedAccess.patient_user_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in validate-shared-access:', error);
    return new Response(
      JSON.stringify({ valid: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
