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

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { tipoDocumento, numeroDocumento } = await req.json();

    console.log(`Validando profesional: ${tipoDocumento} ${numeroDocumento}`);

    // Llamar a la API RETHUS externa
    const rethusResponse = await fetch(
      'https://dpxoykesaioahclxbmmg.supabase.co/functions/v1/consulta-rethus',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweG95a2VzYWlvYWhjbHhibW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDA5NDIsImV4cCI6MjA3NjUxNjk0Mn0.RFEFsg04wRZboOQ_UbnWtcLl3I-yWq5ilrKITgBvL2I'
        },
        body: JSON.stringify({ tipoDocumento, numeroDocumento })
      }
    );

    if (!rethusResponse.ok) {
      throw new Error('Error al consultar RETHUS');
    }

    const rethusData = await rethusResponse.json();
    console.log('Respuesta RETHUS:', rethusData);

    // Determinar si la validación fue exitosa
    const esValido = rethusData && rethusData.length > 0;

    // Actualizar o crear registro de profesional clínico
    const { data: existingProfesional } = await supabase
      .from('profesionales_clinicos')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingProfesional) {
      // Actualizar registro existente
      await supabase
        .from('profesionales_clinicos')
        .update({
          tipo_documento: tipoDocumento,
          numero_documento: numeroDocumento,
          rethus_data: rethusData,
          estado_validacion: esValido ? 'validado' : 'rechazado',
          fecha_validacion: new Date().toISOString()
        })
        .eq('user_id', user.id);
    } else {
      // Crear nuevo registro
      await supabase
        .from('profesionales_clinicos')
        .insert({
          user_id: user.id,
          tipo_documento: tipoDocumento,
          numero_documento: numeroDocumento,
          rethus_data: rethusData,
          estado_validacion: esValido ? 'validado' : 'rechazado',
          fecha_validacion: new Date().toISOString()
        });
    }

    // Si es válido, asignar rol de profesional clínico
    if (esValido) {
      await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'profesional_clinico'
        })
        .onConflict('user_id, role')
        .ignore();
    }

    return new Response(
      JSON.stringify({
        success: esValido,
        data: rethusData,
        message: esValido 
          ? 'Profesional validado correctamente' 
          : 'No se encontró registro en RETHUS'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error en validar-rethus:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});