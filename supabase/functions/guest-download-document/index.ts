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

    const { token, documentId } = await req.json();

    if (!token || !documentId) {
      throw new Error('Token and documentId are required');
    }

    // Validar el token de acceso
    const { data: sharedAccess, error: tokenError } = await supabase
      .from('shared_access_tokens')
      .select('*, permissions')
      .eq('token', token)
      .is('revoked_at', null)
      .single();

    if (tokenError || !sharedAccess) {
      return new Response(
        JSON.stringify({ error: 'Invalid or revoked token' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verificar si el token ha expirado
    const now = new Date();
    const expiresAt = new Date(sharedAccess.expires_at);
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: 'Token has expired' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verificar permisos de descarga
    const permissions = sharedAccess.permissions as { allow_download?: boolean };
    if (!permissions?.allow_download) {
      return new Response(
        JSON.stringify({ error: 'Download not permitted' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Obtener información del documento
    const { data: document, error: docError } = await supabase
      .from('clinical_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', sharedAccess.patient_user_id)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Descargar el archivo desde storage
    const filePath = `${sharedAccess.patient_user_id}/${document.file_name}`;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('clinical-documents')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Registrar la descarga en auditoría
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    await supabase
      .from('guest_access_logs')
      .insert({
        token_id: sharedAccess.id,
        patient_user_id: sharedAccess.patient_user_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        action_type: 'download_document',
        action_details: {
          documentId: document.id,
          fileName: document.file_name,
          timestamp: new Date().toISOString()
        }
      });

    // Convertir el Blob a ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();

    // Retornar el archivo
    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': document.file_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.file_name}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error in guest-download-document:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
