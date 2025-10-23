import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== search-patient-cascade START ===');
    console.log('Request method:', req.method);
    
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const { identification, profesionalUserId, documentType } = body;

    if (!identification || !profesionalUserId) {
      console.log('ERROR: Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Parameters:', { identification, profesionalUserId, documentType });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Configuración del backend incompleta');
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Obtener clínicas del profesional
    const { data: clinicas, error: clinicasError } = await admin
      .from('clinica_profesionales')
      .select('clinica_id, clinicas:clinica_id (id, nombre)')
      .eq('profesional_user_id', profesionalUserId);

    if (clinicasError) throw clinicasError;

    if (!clinicas || clinicas.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No estás asociado a ninguna clínica', level: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const clinicaIds = clinicas.map(c => c.clinica_id);

    // NIVEL 1: Búsqueda local (pacientes asignados a la clínica)
    const { data: localPatients, error: localError } = await admin
      .from('clinica_pacientes')
      .select(`
        clinica_id,
        paciente_user_id,
        clinicas:clinica_id (nombre),
        patient_profiles:paciente_user_id (
          user_id,
          full_name,
          document_type,
          identification,
          age,
          eps,
          topus_data
        )
      `)
      .in('clinica_id', clinicaIds);

    console.log('Local patients found:', localPatients?.length || 0);
    
    if (!localError && localPatients) {
      const localMatch = localPatients.find((p: any) => {
        const profile = Array.isArray(p.patient_profiles) ? p.patient_profiles[0] : p.patient_profiles;
        return profile?.identification === identification.trim();
      });

      if (localMatch) {
        const profile = Array.isArray(localMatch.patient_profiles) ? localMatch.patient_profiles[0] : localMatch.patient_profiles;
        console.log('Nivel 1: Paciente encontrado localmente');
        return new Response(
          JSON.stringify({
            level: 1,
            patient: profile,
            clinica: {
              clinica_id: localMatch.clinica_id,
              clinicas: localMatch.clinicas
            },
            message: 'Paciente encontrado en tu clínica'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // NIVEL 2: Búsqueda global (pacientes en la plataforma)
    const { data: globalPatient, error: globalError } = await admin
      .from('patient_profiles')
      .select('*')
      .eq('identification', identification.trim())
      .maybeSingle();

    if (!globalError && globalPatient) {
      console.log('Nivel 2: Paciente encontrado globalmente');
      return new Response(
        JSON.stringify({
          level: 2,
          patient: globalPatient,
          clinica: clinicas[0], // Usar la primera clínica del profesional
          message: 'Paciente encontrado en la plataforma (requiere auditoría)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // NIVEL 3: Búsqueda externa (Topus + HiSmart) - requiere tipo de documento
    if (!documentType) {
      return new Response(
        JSON.stringify({
          level: 3,
          requireDocumentType: true,
          message: 'Paciente no encontrado. Por favor, selecciona el tipo de documento para buscar en fuentes externas.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Llamar a Topus
    const API_TOPUS = Deno.env.get('API_TOPUS');
    if (!API_TOPUS) {
      throw new Error('API_TOPUS no configurado');
    }

    const formdata = new FormData();
    formdata.append("token", API_TOPUS);
    formdata.append("doc_type", documentType);
    formdata.append("identification", identification.trim());

    const topusResponse = await fetch("https://topus.com.co/ApiRest/request_ss", {
      method: "POST",
      body: formdata,
    });

    if (!topusResponse.ok) {
      throw new Error(`Error de Topus API: ${topusResponse.status}`);
    }

    const topusResult = await topusResponse.text();
    const topusData = JSON.parse(topusResult);

    // Verificar si Topus encontró el paciente
    if (!topusData || topusData.error || !topusData.identificacion) {
      return new Response(
        JSON.stringify({
          level: 4,
          message: 'Paciente no encontrado. Verifique el documento o proceda con el registro manual si aplica.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('Nivel 3: Paciente encontrado en Topus, consultando HiSmart...');

    // Crear perfil del paciente con datos de Topus
    const newPatientData = {
      document_type: documentType,
      identification: identification.trim(),
      full_name: topusData.primer_nombre && topusData.primer_apellido 
        ? `${topusData.primer_nombre} ${topusData.segundo_nombre || ''} ${topusData.primer_apellido} ${topusData.segundo_apellido || ''}`.trim()
        : null,
      age: topusData.edad ? parseInt(topusData.edad) : null,
      eps: topusData.eps || null,
      topus_data: topusData,
    };

    // Verificar si ya existe el perfil (por si acaso)
    const { data: existingProfile } = await admin
      .from('patient_profiles')
      .select('user_id')
      .eq('document_type', documentType)
      .eq('identification', identification.trim())
      .maybeSingle();

    if (existingProfile) {
      // Ya existe, retornar como nivel 2
      return new Response(
        JSON.stringify({
          level: 2,
          patient: { ...newPatientData, user_id: existingProfile.user_id },
          clinica: clinicas[0],
          message: 'Paciente encontrado en la plataforma (requiere auditoría)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Crear nuevo usuario y perfil
    const tempPassword = crypto.randomUUID();
    const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
      email: `patient_${identification.trim()}_${Date.now()}@temp.riskcare.local`,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        full_name: newPatientData.full_name,
        document_type: documentType,
        identification: identification.trim(),
      }
    });

    if (createUserError || !newUser?.user) {
      throw new Error('Error al crear usuario: ' + createUserError?.message);
    }

    // Insertar perfil del paciente
    const { error: profileError } = await admin
      .from('patient_profiles')
      .insert({
        user_id: newUser.user.id,
        ...newPatientData
      });

    if (profileError) {
      throw new Error('Error al crear perfil: ' + profileError.message);
    }

    // Asignar rol de paciente
    await admin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'paciente'
      });

    console.log('Nivel 3: Nuevo paciente creado desde Topus');

    return new Response(
      JSON.stringify({
        level: 3,
        patient: { ...newPatientData, user_id: newUser.user.id },
        clinica: clinicas[0],
        message: 'Paciente creado desde fuentes externas (requiere auditoría)',
        isNew: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('search-patient-cascade error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
