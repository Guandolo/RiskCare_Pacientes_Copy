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
    const { clinicaId } = await req.json();
    if (!clinicaId) {
      return new Response(JSON.stringify({ error: 'clinicaId requerido' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Configuración del backend incompleta');
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: links, error: linkErr } = await admin
      .from('clinica_profesionales')
      .select('id, profesional_user_id')
      .eq('clinica_id', clinicaId);
    if (linkErr) throw linkErr;

    const ids = (links ?? []).map(l => l.profesional_user_id);
    const uniqueIds = Array.from(new Set(ids));

    // Fetch profesionales_clinicos rows
    const { data: pros, error: prosErr } = await admin
      .from('profesionales_clinicos')
      .select('user_id, tipo_documento, numero_documento')
      .in('user_id', uniqueIds);
    if (prosErr) throw prosErr;

    // Fetch emails from auth via admin.getUserById
    const emails: Record<string, { email: string | null; full_name: string | null }> = {};
    await Promise.all(uniqueIds.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        emails[id] = {
          email: data.user.email ?? null,
          full_name: (data.user.user_metadata?.full_name as string) || (data.user.user_metadata?.name as string) || null,
        };
      } catch (_) {
        emails[id] = { email: null, full_name: null };
      }
    }));

    const result = (links ?? []).map((l) => {
      const pro = pros?.find(p => p.user_id === l.profesional_user_id);
      const meta = emails[l.profesional_user_id] || { email: null, full_name: null };
      return {
        id: l.id,
        profesional_user_id: l.profesional_user_id,
        profesional: {
          identification: pro?.numero_documento || '',
          document_type: pro?.tipo_documento || null,
          full_name: meta.full_name,
          email: meta.email,
        }
      };
    });

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('list-clinic-professionals error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});