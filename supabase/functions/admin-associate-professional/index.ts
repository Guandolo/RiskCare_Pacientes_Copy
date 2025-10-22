import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicaId, numeroDocumento } = await req.json();

    // Validar parámetros requeridos
    if (!clinicaId || !numeroDocumento) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos: clinicaId y numeroDocumento' }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Configuración del backend incompleta');
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Paso 1: Buscar profesional clínico por número de documento
    const { data: profesional, error: searchError } = await admin
      .from('profesionales_clinicos')
      .select(`
        user_id,
        numero_documento,
        tipo_documento,
        estado_validacion
      `)
      .eq('numero_documento', numeroDocumento.trim())
      .maybeSingle();

    if (searchError) {
      console.error('Error buscando profesional:', searchError);
      throw new Error('Error al buscar en la base de datos');
    }

    // Caso Error 1: Profesional no encontrado
    if (!profesional) {
      return new Response(
        JSON.stringify({ 
          error: 'No se encontró un profesional clínico registrado con el documento ingresado. Por favor, verifique el número o indique al profesional que debe completar su registro y validación en la plataforma.',
          code: 'PROFESSIONAL_NOT_FOUND'
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 404 
        }
      );
    }

    // Verificar que el usuario tenga el rol de profesional_clinico
    const { data: userRole, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', profesional.user_id)
      .eq('role', 'profesional_clinico')
      .maybeSingle();

    if (roleError) {
      console.error('Error verificando rol:', roleError);
      throw new Error('Error al verificar el rol del usuario');
    }

    if (!userRole) {
      return new Response(
        JSON.stringify({ 
          error: 'El usuario encontrado no tiene el rol de profesional clínico. Por favor, verifique el documento.',
          code: 'NOT_PROFESSIONAL_ROLE'
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      );
    }

    // Obtener nombre del profesional (opcional, para el mensaje de éxito)
    let profesionalName = '';
    const { data: authUser } = await admin.auth.admin.getUserById(profesional.user_id);
    if (authUser?.user) {
      profesionalName = authUser.user.user_metadata?.full_name || authUser.user.email || '';
    }

    // Paso 2: Verificar si ya está asociado a esta clínica
    const { data: existingAssociation, error: associationError } = await admin
      .from('clinica_profesionales')
      .select('id')
      .eq('clinica_id', clinicaId)
      .eq('profesional_user_id', profesional.user_id)
      .maybeSingle();

    if (associationError) {
      console.error('Error verificando asociación:', associationError);
      throw new Error('Error al verificar asociación existente');
    }

    // Caso Error 2: Ya está asociado
    if (existingAssociation) {
      return new Response(
        JSON.stringify({ 
          error: `El profesional ${profesionalName ? profesionalName : 'con documento ' + numeroDocumento} ya se encuentra registrado en su clínica.`,
          code: 'ALREADY_ASSOCIATED'
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 409 
        }
      );
    }

    // Paso 3: Crear la asociación
    const { error: insertError } = await admin
      .from('clinica_profesionales')
      .insert({
        clinica_id: clinicaId,
        profesional_user_id: profesional.user_id,
      });

    if (insertError) {
      console.error('Error creando asociación:', insertError);
      throw new Error('Error al crear la asociación en la base de datos');
    }

    // Caso de Éxito
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `El profesional ${profesionalName ? profesionalName : 'con documento ' + numeroDocumento} ha sido agregado a su clínica exitosamente.`,
        profesionalId: profesional.user_id,
        profesionalName
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('admin-associate-professional error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    
    // Caso Error 3: Error interno
    return new Response(
      JSON.stringify({ 
        error: 'Ocurrió un error inesperado al intentar agregar al profesional. Por favor, intente más tarde.',
        details: message,
        code: 'INTERNAL_ERROR'
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
