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
    const { frontImage, backImage } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY no configurado');
    }

    console.log('Procesando documento con Gemini 2.5 Pro...');

    // Usar Gemini 2.5 Pro para OCR y estructuración en un solo paso
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en extracción de datos de documentos de identidad colombianos. 
Analiza las imágenes del documento (frente y reverso) y extrae TODA la información disponible.
Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "nombres": "string",
  "apellidos": "string", 
  "numeroDocumento": "string",
  "tipoDocumento": "string",
  "fechaNacimiento": "YYYY-MM-DD",
  "lugarNacimiento": "string",
  "tipoSangre": "string",
  "rh": "string",
  "sexo": "string"
}

Si algún campo no está visible o no es aplicable, usa null. NO agregues texto adicional, solo el JSON.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extrae toda la información de este documento de identidad colombiano:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: frontImage
                }
              },
              ...(backImage ? [{
                type: 'image_url',
                image_url: {
                  url: backImage
                }
              }] : [])
            ]
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido, intenta nuevamente en unos momentos." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere agregar créditos al workspace de Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Error de Lovable AI:', response.status, errorText);
      throw new Error('Error al procesar el documento con IA');
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;
    
    console.log('Texto extraído:', extractedText);

    // Parsear JSON de la respuesta
    let documentData;
    try {
      // Limpiar markdown si existe
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        documentData = JSON.parse(jsonMatch[0]);
      } else {
        documentData = JSON.parse(extractedText);
      }
    } catch (parseError) {
      console.error('Error parseando JSON:', parseError, 'Texto:', extractedText);
      throw new Error('No se pudo extraer información estructurada del documento');
    }

    console.log('Datos extraídos exitosamente:', documentData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: documentData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error en extract-document-data:', error);
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
