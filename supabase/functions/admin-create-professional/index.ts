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
    const { clinicaId, documentType, identification, fullName, email } = await req.json();

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

    // 1) Buscar en profesionales_clinicos por documento
    const { data: existingPro, error: proErr } = await admin
      .from('profesionales_clinicos')
      .select('user_id')
      .eq('tipo_documento', docType)
      .eq('numero_documento', identification)
      .maybeSingle();
    if (proErr) throw proErr;

    let userId: string | null = existingPro?.user_id ?? null;

    // 2) Si no existe usuario, crearlo
    if (!userId) {
      if (!email || !String(email).includes('@')) {
        return new Response(JSON.stringify({ error: 'Email válido requerido para profesionales nuevos' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
      }

      const randomPass = crypto.randomUUID();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: randomPass,
        user_metadata: {
          is_profesional: true,
          full_name: fullName || null,
          document_type: docType,
          identification,
        }
      });
      if (createErr) throw createErr;
      userId = created.user.id;

      // 3) Insertar registro en profesionales_clinicos
      const { error: insertProErr } = await admin
        .from('profesionales_clinicos')
        .insert({
          user_id: userId,
          tipo_documento: docType,
          numero_documento: identification,
          estado_validacion: 'pendiente',
        });
      if (insertProErr) throw insertProErr;

      // 4) Asignar rol
      const { error: roleErr } = await admin
        .from('user_roles')
        .insert({ user_id: userId, role: 'profesional_clinico' });
      if (roleErr) throw roleErr;
    }

    // 5) Asociar a clínica
    const { error: linkErr } = await admin
      .from('clinica_profesionales')
      .upsert({
        clinica_id: clinicaId,
        profesional_user_id: userId!,
      }, { onConflict: 'clinica_id,profesional_user_id' });
    if (linkErr) throw linkErr;

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('admin-create-professional error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});