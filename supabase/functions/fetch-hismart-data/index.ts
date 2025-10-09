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

    console.log('Consultando HiSmart API para:', documentType, identification);

    // TODO: Aquí va la implementación real de la API de HiSmart
    // Por ahora retorno datos de ejemplo
    const mockData = {
      consultas: [
        {
          fecha: "2024-03-15",
          especialidad: "Cardiología",
          diagnostico: "Control rutinario",
          medico: "Dr. Juan Pérez"
        }
      ],
      laboratorios: [
        {
          fecha: "2024-03-15",
          tipo: "Hemograma completo",
          resultados: {
            hemoglobina: "14.5 g/dL",
            leucocitos: "7500 /mm3"
          }
        }
      ],
      imagenes: [
        {
          fecha: "2024-02-28",
          tipo: "Radiografía de tórax",
          hallazgos: "Sin alteraciones significativas"
        }
      ]
    };

    console.log('Datos de HiSmart obtenidos exitosamente');

    return new Response(
      JSON.stringify({ success: true, data: mockData }),
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
