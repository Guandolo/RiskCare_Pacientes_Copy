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

    // Función para llamar a la API RETHUS con reintentos
    const callRethusAPI = async (attempt: number = 1): Promise<any> => {
      const maxAttempts = 3;
      
      try {
        console.log(`Intento ${attempt} de ${maxAttempts} - Consultando RETHUS...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
        
        const rethusResponse = await fetch(
          'https://dpxoykesaioahclxbmmg.supabase.co/functions/v1/consulta-rethus',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweG95a2VzYWlvYWhjbHhibW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDA5NDIsImV4cCI6MjA3NjUxNjk0Mn0.RFEFsg04wRZboOQ_UbnWtcLl3I-yWq5ilrKITgBvL2I'
            },
            body: JSON.stringify({ tipoDocumento, numeroDocumento }),
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);

        if (!rethusResponse.ok) {
          throw new Error(`HTTP ${rethusResponse.status}`);
        }

        return await rethusResponse.json();
        
      } catch (error: any) {
        console.error(`Error en intento ${attempt}:`, error.message);
        
        if (attempt < maxAttempts) {
          const waitTime = attempt * 2000; // 2s, 4s
          console.log(`Esperando ${waitTime}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return callRethusAPI(attempt + 1);
        }
        
        throw error;
      }
    };

    const rethusData = await callRethusAPI();
    console.log('Respuesta RETHUS completa:', JSON.stringify(rethusData, null, 2));

    // Determinar si la validación fue exitosa
    // La respuesta tiene estructura: { datos_academicos: [...] }
    const esValido = rethusData?.datos_academicos && Array.isArray(rethusData.datos_academicos) && rethusData.datos_academicos.length > 0;

    // Actualizar o crear registro de profesional clínico
    const { data: existingProfesional } = await supabase
      .from('profesionales_clinicos')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const validacionActual = {
      fecha: new Date().toISOString(),
      tipo_documento: tipoDocumento,
      numero_documento: numeroDocumento,
      datos_rethus: rethusData,
      estado: esValido ? 'validado' : 'rechazado'
    };

    if (existingProfesional) {
      // Obtener historial actual y agregar nueva validación
      const historial = existingProfesional.historial_validaciones || [];
      const nuevoHistorial = [...historial, validacionActual];
      
      // Actualizar registro existente con nueva validación y historial
      await supabase
        .from('profesionales_clinicos')
        .update({
          tipo_documento: tipoDocumento,
          numero_documento: numeroDocumento,
          rethus_data: rethusData,
          estado_validacion: esValido ? 'validado' : 'rechazado',
          fecha_validacion: new Date().toISOString(),
          historial_validaciones: nuevoHistorial
        })
        .eq('user_id', user.id);
    } else {
      // Crear nuevo registro con primera validación en historial
      await supabase
        .from('profesionales_clinicos')
        .insert({
          user_id: user.id,
          tipo_documento: tipoDocumento,
          numero_documento: numeroDocumento,
          rethus_data: rethusData,
          estado_validacion: esValido ? 'validado' : 'rechazado',
          fecha_validacion: new Date().toISOString(),
          historial_validaciones: [validacionActual]
        });
    }

    // Si es válido, asignar rol de profesional clínico
    if (esValido) {
      await supabase
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: 'profesional_clinico'
        }, {
          onConflict: 'user_id,role',
          ignoreDuplicates: true
        });
    }

    // Extraer información académica relevante para mostrar
    let rethusDataToReturn = null;
    if (esValido && rethusData?.datos_academicos && rethusData.datos_academicos.length > 0) {
      rethusDataToReturn = {
        datosAcademicos: rethusData.datos_academicos,
        totalTitulos: rethusData.datos_academicos.length
      };
    }

    return new Response(
      JSON.stringify({
        success: esValido,
        rethusData: rethusDataToReturn,
        message: esValido 
          ? `Profesional validado correctamente. Se encontraron ${rethusData.datos_academicos.length} título(s) académico(s).`
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