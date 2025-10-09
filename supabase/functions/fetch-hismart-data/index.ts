import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    const HISMART_TOKEN = Deno.env.get('API_HISMART');
    if (!HISMART_TOKEN) {
      throw new Error('API_HISMART no configurado');
    }

    console.log('Consultando HiSmart API para:', identification);

    // Llamar a la API real de HiSmart
    const formData = JSON.stringify({ id_patient: parseInt(identification) });

    const hismartResponse = await fetch('https://hismart.com.co/toolbar/public/Insertdb_hismart/get_patient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic amVpc29ucGVyZXpAaGlzbWFydC5jb20uY286NjQzMSpyb21wZQ=='
      },
      body: formData
    });

    if (!hismartResponse.ok) {
      throw new Error(`HiSmart API error: ${hismartResponse.status}`);
    }

    const hismartData = await hismartResponse.json();
    
    console.log('Datos de HiSmart obtenidos exitosamente');

    return new Response(
      JSON.stringify({ success: true, data: hismartData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error en fetch-hismart-data:', error);
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
