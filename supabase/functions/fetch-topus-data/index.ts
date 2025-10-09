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
    const { documentType, identification } = await req.json();
    
    const TOPUS_TOKEN = Deno.env.get('TOPUS_API_TOKEN');
    if (!TOPUS_TOKEN) {
      throw new Error('TOPUS_API_TOKEN no configurado');
    }

    console.log('Consultando Topus API para:', documentType, identification);

    const formdata = new FormData();
    formdata.append("token", TOPUS_TOKEN);
    formdata.append("doc_type", documentType);
    formdata.append("identification", identification);

    const response = await fetch("https://topus.com.co/ApiRest/request_ss", {
      method: "POST",
      body: formdata,
    });

    if (!response.ok) {
      throw new Error(`Error de Topus API: ${response.status}`);
    }

    const result = await response.text();
    const topusData = JSON.parse(result);

    console.log('Datos de Topus obtenidos exitosamente');

    return new Response(
      JSON.stringify({ success: true, data: topusData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error en fetch-topus-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
