import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOC_TYPES = new Set([
  'CC','TI','CE','PA','RC','NU','CD','CN','SC','PE','PT'
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicaId, documentType, identification, fullName, topusData, email } = await req.json();

    if (!clinicaId || !documentType || !identification) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const docType = String(documentType).toUpperCase();
    if (!ALLOWED_DOC_TYPES.has(docType)) {
      return new Response(JSON.stringify({ error: 'Tipo de documento no soportado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Configuración del backend incompleta');
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1) Buscar perfil existente por doc
    const { data: existingProfile, error: profileErr } = await admin
      .from('patient_profiles')
      .select('user_id')
      .eq('document_type', docType)
      .eq('identification', identification)
      .maybeSingle();

    if (profileErr) throw profileErr;

    let userId: string | null = existingProfile?.user_id ?? null;

    // 2) Si no existe usuario, crearlo
    if (!userId) {
      const safeEmail = (email && String(email).trim()) || `paciente.${identification}@riskcare.temp`;
      const randomPass = crypto.randomUUID();

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: safeEmail,
        email_confirm: true,
        password: randomPass,
        user_metadata: {
          is_patient: true,
          document_type: docType,
          identification,
        }
      });
      if (createErr) throw createErr;
      userId = created.user.id;

      // 3) Crear perfil paciente
      const computedName = (fullName && String(fullName).trim())
        || topusData?.result?.nombre_completo
        || `${topusData?.result?.nombre ?? ''} ${topusData?.result?.s_nombre ?? ''} ${topusData?.result?.apellido ?? ''} ${topusData?.result?.s_apellido ?? ''}`.trim()
        || null;

      const { error: insertProfileErr } = await admin
        .from('patient_profiles')
        .insert({
          user_id: userId,
          document_type: docType,
          identification,
          full_name: computedName,
          age: topusData?.result?.edad ?? null,
          eps: topusData?.result?.eps ?? null,
          topus_data: topusData ?? null,
        });
      if (insertProfileErr) throw insertProfileErr;

      // 4) Rol paciente
      const { error: roleErr } = await admin
        .from('user_roles')
        .insert({ user_id: userId, role: 'paciente' });
      if (roleErr) throw roleErr;
    }

    // 5) Asociar a clínica
    const { error: upsertErr } = await admin
      .from('clinica_pacientes')
      .upsert({
        clinica_id: clinicaId,
        paciente_user_id: userId!,
      }, { onConflict: 'clinica_id,paciente_user_id' });
    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('admin-create-patient error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});