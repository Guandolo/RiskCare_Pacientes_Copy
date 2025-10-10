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
    const { fileUrl, fileName, fileType, userId, userIdentification, pdfPassword, verifyIdentity, forceUpload } = await req.json();
    
    const GEMINI_API_KEY = Deno.env.get('API_GEMINI');
    if (!GEMINI_API_KEY) {
      throw new Error('API_GEMINI no configurado');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Obtener el token JWT del header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuario no autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    // Determinar el mimeType basándose en fileType o fileName
    let mimeType = 'application/pdf'; // Default para PDFs
    
    if (fileType) {
      // Si viene el fileType, usarlo directamente
      if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
        mimeType = 'image/jpeg';
      } else if (fileType === 'image/png') {
        mimeType = 'image/png';
      } else if (fileType === 'application/pdf') {
        mimeType = 'application/pdf';
      }
    } else if (fileName) {
      // Fallback: determinar por extensión del archivo
      const ext = fileName.toLowerCase().split('.').pop();
      if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (ext === 'png') {
        mimeType = 'image/png';
      } else if (ext === 'pdf') {
        mimeType = 'application/pdf';
      }
    }
    
    console.log('MIME type determinado:', mimeType, 'para archivo:', fileName);

    // Si se requiere verificación de identidad
    let identityCheckResult = null;
    if (verifyIdentity && !forceUpload) {
      const { data: profile } = await supabase
        .from('patient_profiles')
        .select('full_name, identification')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: 'Perfil de paciente no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Prompt de verificación de identidad
      const identityPrompt = `TAREA 1 - VERIFICACIÓN DE IDENTIDAD:
Analiza este documento médico e identifica si contiene el nombre completo o número de identificación del paciente.

Datos del paciente registrado:
- Nombre completo: ${profile.full_name || 'No disponible'}
- Número de identificación: ${profile.identification}

Busca en el documento:
1. Nombres completos de personas
2. Números de cédula o identificación
3. Determina si la identidad encontrada coincide con el paciente registrado

Retorna SOLO JSON con esta estructura exacta:
{
  "identity_check": {
    "status": "VERIFIED" | "REJECTED" | "UNVERIFIABLE",
    "found_name": "nombre encontrado o null",
    "found_document": "documento encontrado o null",
    "confidence": 0.0-1.0,
    "reasoning": "explicación breve"
  }
}`;

      const identityResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: identityPrompt },
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
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!identityResponse.ok) {
        const errorText = await identityResponse.text();
        console.error('Error en verificación de identidad:', errorText);
        throw new Error(`Gemini API error (identity): ${identityResponse.status}`);
      }

      const identityData = await identityResponse.json();
      const identityText = identityData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      try {
        identityCheckResult = JSON.parse(identityText);
        console.log('Resultado verificación:', identityCheckResult);

        // Si es REJECTED, retornar inmediatamente
        if (identityCheckResult.identity_check?.status === 'REJECTED') {
          return new Response(JSON.stringify({
            status: 'rejected',
            message: `Este documento parece pertenecer a otra persona. ${identityCheckResult.identity_check.reasoning}`
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Si es UNVERIFIABLE, retornar para confirmación
        if (identityCheckResult.identity_check?.status === 'UNVERIFIABLE') {
          return new Response(JSON.stringify({
            status: 'unverifiable',
            message: 'No pudimos verificar la identidad del paciente en este documento.',
            file_url: fileUrl
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        console.error('Error parsing identity check:', e);
        // Si hay error en parseo, continuar con el proceso normal
      }
    }

    // Llamar a Gemini para extraer texto y estructurar datos
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
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

Retorna SOLO JSON con esta estructura exacta:
{
  "extracted_text": "texto completo",
  "document_type": "tipo",
  "document_date": "YYYY-MM-DD",
  "structured_data": {}
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
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Error llamando a Gemini:', geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    console.log('Respuesta de Gemini (primeros 200 chars):', geminiText.substring(0, 200));
    
    let extractedData;
    try {
      // Intentar parsear como JSON directo
      extractedData = JSON.parse(geminiText);
    } catch (parseError) {
      console.error('Error parseando JSON de Gemini:', parseError);
      // Intentar limpiar markdown
      const cleanedText = geminiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        extractedData = JSON.parse(cleanedText);
      } catch (secondError) {
        console.error('Error parseando JSON limpio:', secondError);
        extractedData = {
          extracted_text: geminiText,
          document_type: 'desconocido',
          document_date: new Date().toISOString().split('T')[0],
          structured_data: {}
        };
      }
    }

    // Guardar en la base de datos
    const { data: savedDoc, error: dbError } = await supabase
      .from('clinical_documents')
      .insert({
        user_id: user.id,
        file_name: fileName,
        file_type: fileType,
        file_url: fileUrl,
        extracted_text: extractedData.extracted_text || '',
        document_type: extractedData.document_type || 'Desconocido',
        document_date: extractedData.document_date || null,
        structured_data: extractedData.structured_data || {}
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
        status: identityCheckResult?.identity_check?.status === 'VERIFIED' ? 'verified' : 'success',
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
