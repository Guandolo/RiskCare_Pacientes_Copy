import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating clinical map for user:', user.id);

    // Obtener perfil del paciente
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Obtener documentos clínicos
    const { data: documents } = await supabase
      .from('clinical_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('document_date', { ascending: false });

    // Construir contexto para la IA
    let clinicalContext = '';
    
    if (profile?.topus_data) {
      clinicalContext += `\nDATOS DEMOGRÁFICOS:\n${JSON.stringify(profile.topus_data, null, 2)}\n`;
    }

    if (documents && documents.length > 0) {
      clinicalContext += `\nDOCUMENTOS CLÍNICOS:\n`;
      documents.forEach((doc: any, idx: number) => {
        clinicalContext += `\n[Documento ${idx + 1}: ${doc.file_name}]\n`;
        clinicalContext += `Fecha: ${doc.document_date || doc.created_at}\n`;
        if (doc.extracted_text) {
          clinicalContext += `Contenido: ${doc.extracted_text.substring(0, 2000)}...\n`;
        }
        if (doc.structured_data) {
          clinicalContext += `Datos estructurados: ${JSON.stringify(doc.structured_data).substring(0, 1000)}...\n`;
        }
      });
    }

    // Llamar a Lovable AI para generar el mapa
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY no configurado');
    }

    const systemPrompt = `Eres un experto médico que crea mapas clínicos interactivos. 
Analiza la información del paciente y crea un mapa que muestre:
- Condiciones médicas del paciente
- Medicamentos que toma
- Resultados de exámenes relevantes
- Especialistas que lo atienden
- IMPORTANTE: Las CONEXIONES entre estos elementos (qué medicamento trata qué condición, etc.)`;

    const userPrompt = `Crea un mapa clínico completo para este paciente:

${clinicalContext}

REGLAS IMPORTANTES:
1. El paciente DEBE conectarse a TODAS sus condiciones
2. Cada condición DEBE conectarse a los medicamentos que la tratan
3. Cada condición DEBE conectarse a los exámenes que la monitorean
4. Cada condición DEBE conectarse al especialista que la controla
5. TODOS los nodos DEBEN estar conectados (no crear nodos aislados)

Si no hay suficiente información, infiere conexiones lógicas basadas en conocimiento médico general.`;

    console.log('Calling Lovable AI with tool calling...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_clinical_map',
              description: 'Crea un mapa clínico con nodos (paciente, condiciones, medicamentos, estudios, especialistas) y sus conexiones',
              parameters: {
                type: 'object',
                properties: {
                  nodes: {
                    type: 'array',
                    description: 'Lista de nodos del mapa',
                    items: {
                      type: 'object',
                      properties: {
                        id: { 
                          type: 'string',
                          description: 'ID único del nodo (ej: patient, cond_diabetes, med_metformina)'
                        },
                        type: { 
                          type: 'string',
                          enum: ['patient', 'condition', 'medication', 'paraclinical', 'specialist'],
                          description: 'Tipo de nodo'
                        },
                        label: { 
                          type: 'string',
                          description: 'Texto a mostrar en el nodo'
                        },
                        description: {
                          type: 'string',
                          description: 'Descripción adicional (opcional)'
                        }
                      },
                      required: ['id', 'type', 'label']
                    }
                  },
                  edges: {
                    type: 'array',
                    description: 'Lista de conexiones entre nodos. CRÍTICO: Debe haber múltiples conexiones.',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          description: 'ID único del edge'
                        },
                        source: {
                          type: 'string',
                          description: 'ID del nodo origen'
                        },
                        target: {
                          type: 'string',
                          description: 'ID del nodo destino'
                        },
                        label: {
                          type: 'string',
                          description: 'Etiqueta de la relación (ej: diagnosticado con, tratada con, monitoreada con, controlada por)'
                        }
                      },
                      required: ['id', 'source', 'target', 'label']
                    }
                  }
                },
                required: ['nodes', 'edges']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_clinical_map' } },
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Error al generar mapa con IA');
    }

    const aiData = await aiResponse.json();
    
    // Extraer el mapa de la respuesta de tool calling
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_clinical_map') {
      console.error('No tool call found in response');
      throw new Error('Error al generar mapa con IA');
    }

    let parsedMap;
    try {
      parsedMap = JSON.parse(toolCall.function.arguments);
      
      // Validar que tiene nodos y edges
      if (!parsedMap.nodes || !Array.isArray(parsedMap.nodes)) {
        throw new Error('Mapa sin nodos');
      }
      if (!parsedMap.edges || !Array.isArray(parsedMap.edges)) {
        console.warn('Mapa sin edges, creando conexiones predeterminadas');
        parsedMap.edges = [];
      }
      
      console.log(`Mapa generado: ${parsedMap.nodes.length} nodos, ${parsedMap.edges.length} conexiones`);
      
    } catch (e) {
      console.error('Failed to parse map from tool call:', e);
      console.error('Tool call arguments:', toolCall.function.arguments);
      throw new Error('Error al parsear el mapa generado');
    }

    // Validar consistencia de edges vs nodes y crear fallback si falta
    const nodeIds = new Set<string>((parsedMap.nodes || []).map((n: any) => String(n.id)));
    parsedMap.nodes = (parsedMap.nodes || []).map((n: any) => ({ ...n, id: String(n.id) }));
    parsedMap.edges = (parsedMap.edges || []).map((e: any, i: number) => ({
      id: String(e.id ?? `e${i + 1}`),
      source: String(e.source),
      target: String(e.target),
      label: e.label || '',
    })).filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target));

    if (!parsedMap.edges || parsedMap.edges.length === 0) {
      // Fallback: construir conexiones lógicas básicas
      const patient = (parsedMap.nodes || []).find((n: any) => n.type === 'patient')?.id || 'patient';
      const conditions = (parsedMap.nodes || []).filter((n: any) => n.type === 'condition').map((n: any) => n.id);
      const medications = (parsedMap.nodes || []).filter((n: any) => n.type === 'medication');
      const paraclinicals = (parsedMap.nodes || []).filter((n: any) => n.type === 'paraclinical');
      const specialists = (parsedMap.nodes || []).filter((n: any) => n.type === 'specialist');

      const edges: any[] = [];
      let edgeIdx = 1;

      // Conectar paciente a todas las condiciones
      for (const c of conditions) {
        edges.push({ id: `e${edgeIdx++}`, source: patient, target: c, label: 'diagnosticado con' });
      }

      // Reglas simples por palabras clave
      const mapCond = (label: string) => {
        const l = label.toLowerCase();
        if (l.includes('diabet')) return 'diabetes';
        if (l.includes('hipertens')) return 'hipertension';
        if (l.includes('dislip') || l.includes('colesterol') || l.includes('ldl')) return 'dislipidemia';
        if (l.includes('astigmat')) return 'astigmatismo';
        return 'general';
      };

      const condForKey: Record<string, string[]> = {
        diabetes: conditions.filter((cid: string) => String(cid).toLowerCase().includes('diabet') || cid.toLowerCase().includes('dm')),
        hipertension: conditions.filter((cid: string) => cid.toLowerCase().includes('hipertens')),
        dislipidemia: conditions.filter((cid: string) => cid.toLowerCase().includes('dislip') || cid.toLowerCase().includes('lipid')),
        astigmatismo: conditions.filter((cid: string) => cid.toLowerCase().includes('astigmat')),
        general: conditions,
      };

      // Meds -> Conditions
      for (const m of medications) {
        const key = mapCond(m.label || m.id);
        const targets = condForKey[key]?.length ? condForKey[key] : conditions;
        for (const c of targets) edges.push({ id: `e${edgeIdx++}`, source: c, target: m.id, label: 'tratada con' });
      }

      // Paraclinicals -> Conditions (monitoreada con)
      for (const p of paraclinicals) {
        const key = mapCond(p.label || p.id);
        const targets = condForKey[key]?.length ? condForKey[key] : conditions;
        for (const c of targets) edges.push({ id: `e${edgeIdx++}`, source: c, target: p.id, label: 'monitoreada con' });
      }

      // Specialists -> Conditions (controlada por)
      for (const s of specialists) {
        const key = mapCond(s.label || s.id);
        const targets = condForKey[key]?.length ? condForKey[key] : conditions;
        for (const c of targets) edges.push({ id: `e${edgeIdx++}`, source: c, target: s.id, label: 'controlada por' });
      }

      parsedMap.edges = edges;
      console.log(`Fallback edges construidos: ${parsedMap.edges.length}`);
    }

    return new Response(JSON.stringify({ map: parsedMap }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating clinical map:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
