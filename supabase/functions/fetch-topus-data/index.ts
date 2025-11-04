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

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    // Intentar leer JSON con fallback seguro
    let payload: any = {};
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        payload = await req.json();
      } else {
        const raw = await req.text();
        payload = raw ? JSON.parse(raw) : {};
      }
    } catch (_) {
      payload = {};
    }

    const { documentType, identification } = payload || {};

    if (!documentType || !identification) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parámetros inválidos: documentType e identification son obligatorios' }),
        { headers: jsonHeaders, status: 200 }
      );
    }

    const TOPUS_TOKEN = Deno.env.get('API_TOPUS');
    if (!TOPUS_TOKEN) {
      console.error('API_TOPUS no configurado');
      return new Response(
        JSON.stringify({ success: false, error: 'API_TOPUS no configurado' }),
        { headers: jsonHeaders, status: 200 }
      );
    }

    console.log('Consultando Topus API para:', documentType, identification);

    const formdata = new FormData();
    formdata.append('token', TOPUS_TOKEN);
    formdata.append('doc_type', documentType);
    formdata.append('identification', identification);

    const response = await fetch('https://topus.com.co/ApiRest/request_ss', {
      method: 'POST',
      body: formdata,
    });

    if (!response.ok) {
      const raw = await response.text();
      console.error('Topus API no OK:', response.status, raw);
      return new Response(
        JSON.stringify({ success: false, error: `Error de Topus API: ${response.status}`, status: response.status, raw }),
        { headers: jsonHeaders, status: 200 }
      );
    }

    const resultText = await response.text();
    let topusData: any;
    try {
      topusData = JSON.parse(resultText);
    } catch (e) {
      console.error('Error parseando respuesta de Topus:', e, resultText);
      return new Response(
        JSON.stringify({ success: false, error: 'Respuesta inválida de Topus', raw: resultText }),
        { headers: jsonHeaders, status: 200 }
      );
    }

    console.log('Datos de Topus obtenidos exitosamente');
    return new Response(
      JSON.stringify({ success: true, data: topusData }),
      { headers: jsonHeaders, status: 200 }
    );

  } catch (error) {
    console.error('Error en fetch-topus-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    // Responder 200 para evitar el toast genérico de non-2xx
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, code: 'UNEXPECTED_ERROR' }),
      { headers: jsonHeaders, status: 200 }
    );
  }
});
