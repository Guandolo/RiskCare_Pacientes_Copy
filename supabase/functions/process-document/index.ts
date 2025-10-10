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
    const { fileUrl, fileName, fileType, userId, userIdentification, pdfPassword } = await req.json();
    
    const GEMINI_API_KEY = Deno.env.get('API_GEMINI');
    if (!GEMINI_API_KEY) {
      throw new Error('API_GEMINI no configurado');
    }

    console.log('Procesando documento:', fileName, fileType);

    // Descargar el archivo
    const fileResponse = await fetch(fileUrl);
    const fileBlob = await fileResponse.blob();
    let arrayBuffer = await fileBlob.arrayBuffer();
    
    // Convertir a base64 de forma segura para archivos grandes
    // Si es PDF y está protegido, intentar desbloquearlo con el documento de identidad
    if (fileType === 'application/pdf') {
      try {
        const { PDFDocument } = await import('https://cdn.skypack.dev/pdf-lib@^1.17.1');
        
        let isPDFProtected = false;
        try {
          await PDFDocument.load(arrayBuffer);
          console.log('PDF sin contraseña');
        } catch (loadError) {
          isPDFProtected = true;
          console.log('PDF protegido detectado');
        }

        if (isPDFProtected) {
          let unlocked = false;

          // 1) Intentar con documento de identidad
          if (userIdentification) {
            try {
              const pdfDoc = await PDFDocument.load(arrayBuffer, { password: userIdentification });
              arrayBuffer = await pdfDoc.save();
              unlocked = true;
              console.log('PDF desbloqueado exitosamente con identificación');
            } catch (e) {
              console.warn('No se pudo desbloquear con identificación');
            }
          }

          // 2) Intentar con contraseña proporcionada explícitamente
          if (!unlocked && pdfPassword) {
            try {
              const pdfDoc = await PDFDocument.load(arrayBuffer, { password: pdfPassword });
              arrayBuffer = await pdfDoc.save();
              unlocked = true;
              console.log('PDF desbloqueado exitosamente con contraseña proporcionada');
            } catch (e) {
              console.warn('No se pudo desbloquear con contraseña proporcionada');
            }
          }

          // 3) Si no se pudo, solicitar contraseña al cliente
          if (!unlocked) {
            console.error('Error desbloqueando PDF: se requiere contraseña');
            return new Response(
              JSON.stringify({ error: 'PDF_PASSWORD_REQUIRED', message: 'Este PDF está protegido. Ingresa la contraseña para continuar.' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 423 }
            );
          }
        }
      } catch (error) {
        console.error('Error procesando PDF:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Error procesando el PDF');
      }
    }
    
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    // Determinar el mimeType
    const mimeType = fileType === 'application/pdf' ? 'application/pdf' : 
                     fileType === 'image/jpeg' ? 'image/jpeg' : 
                     fileType === 'image/png' ? 'image/png' : 
                     'application/octet-stream';

    // Llamar a Gemini para extraer texto y estructurar datos
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analiza este documento clínico y extrae:
1. Todo el texto completo del documento
2. Tipo de documento (laboratorio, consulta, imagen, receta, etc.)
3. Fecha del documento
4. Información estructurada relevante (diagnósticos, medicamentos, resultados, etc.)

Retorna en formato JSON con esta estructura:
{
  "extracted_text": "texto completo",
  "document_type": "tipo",
  "document_date": "YYYY-MM-DD",
  "structured_data": {
    // datos relevantes extraídos
  }
}`
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('Respuesta de Gemini:', responseText);

    // Extraer JSON de la respuesta
    let extractedData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        extracted_text: responseText,
        document_type: 'desconocido',
        document_date: new Date().toISOString().split('T')[0],
        structured_data: {}
      };
    } catch (e) {
      extractedData = {
        extracted_text: responseText,
        document_type: 'desconocido',
        document_date: new Date().toISOString().split('T')[0],
        structured_data: {}
      };
    }

    // Guardar en la base de datos
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: savedDoc, error: dbError } = await supabase
      .from('clinical_documents')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_type: fileType,
        file_url: fileUrl,
        extracted_text: extractedData.extracted_text,
        document_type: extractedData.document_type,
        document_date: extractedData.document_date,
        structured_data: extractedData.structured_data
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error guardando documento:', dbError);
      throw dbError;
    }

    console.log('Documento procesado y guardado exitosamente');

    return new Response(
      JSON.stringify({ 
        success: true, 
        document: savedDoc,
        extracted_data: extractedData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error en process-document:', error);
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
