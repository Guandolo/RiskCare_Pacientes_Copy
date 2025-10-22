import { useState } from "react";
import { Network, FlaskConical, ScanSearch, Pill, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useActivePatient } from "@/hooks/useActivePatient";
import { ClinicalMapViewer } from "./ClinicalMapViewer";
import { DiagnosticAidsViewer } from "./DiagnosticAidsViewer";
import { ParaclinicosViewer } from "./ParaclinicosViewer";
import { MedicamentosViewer } from "./MedicamentosViewer";
import { BodyAnalysisViewer } from "./BodyAnalysisViewer";

interface AnalysisModule {
  id: string;
  title: string;
  description: string;
  icon: any;
  type: 'mapa_clinico' | 'paraclinicos' | 'ayudas_diagnosticas' | 'medicamentos' | 'analisis_corporal';
}

const analysisModules: AnalysisModule[] = [
  { id: 'mapa_clinico', title: 'Mapa Clínico', description: 'Visualiza conexiones entre condiciones, medicamentos y especialistas', icon: Network, type: 'mapa_clinico' },
  { id: 'paraclinicos', title: 'Paraclínicos', description: 'Gráficas de tendencia de resultados de laboratorio', icon: FlaskConical, type: 'paraclinicos' },
  { id: 'ayudas_diagnosticas', title: 'Ayudas Diagnósticas', description: 'Línea de tiempo de estudios de imagenología', icon: ScanSearch, type: 'ayudas_diagnosticas' },
  { id: 'medicamentos', title: 'Medicamentos', description: 'Historial de formulaciones médicas', icon: Pill, type: 'medicamentos' },
  { id: 'analisis_corporal', title: 'Análisis Corporal', description: 'Gráficos de evolución de peso, IMC y signos vitales', icon: Activity, type: 'analisis_corporal' },
];

interface ClinicalNotebookPanelProps {
  displayedUserId?: string;
}

export const ClinicalNotebookPanel = ({ displayedUserId }: ClinicalNotebookPanelProps) => {
  const { isProfesional } = useUserRole();
  const { activePatient } = useActivePatient();
  const { toast } = useToast();
  const [generatingModule, setGeneratingModule] = useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [generatedData, setGeneratedData] = useState<{ type: string; title: string; content: any } | null>(null);

  const handleGenerate = async (module: AnalysisModule) => {
    try {
      setGeneratingModule(module.id);
      setGeneratedData(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Debes iniciar sesión para usar esta función.', variant: 'destructive' });
        return;
      }

      // Determinar el userId correcto
      const targetUserId = isProfesional && activePatient ? activePatient.user_id : session.user.id;

      const functionMap = {
        'mapa_clinico': 'generate-clinical-map',
        'ayudas_diagnosticas': 'generate-diagnostic-aids',
        'paraclinicos': 'generate-paraclinicos',
        'medicamentos': 'generate-medicamentos',
        'analisis_corporal': 'generate-body-analysis'
      } as const;

      const functionName = functionMap[module.type];
      const { data, error } = await supabase.functions.invoke(functionName, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId: targetUserId }
      });
      if (error) throw error;

      const content =
        module.type === 'mapa_clinico' ? data?.map :
        module.type === 'ayudas_diagnosticas' ? data?.diagnosticAids :
        module.type === 'paraclinicos' ? data?.paraclinicos :
        module.type === 'medicamentos' ? data?.medicamentos :
        data?.bodyAnalysis;

      if (!content) {
        toast({ title: 'Sin datos', description: 'No se pudo generar contenido para este módulo.' });
        return;
      }

      setGeneratedData({ type: module.type, title: module.title, content });
      setFullscreenOpen(true);

      // Guardar la nota en la base de datos (siempre del usuario target)
      const { error: saveError } = await supabase.from('clinical_notes').insert({
        user_id: targetUserId,
        type: module.type,
        title: module.title,
        content: content
      });

      if (saveError) {
        console.error('Error guardando nota:', saveError);
        toast({ 
          title: 'Advertencia', 
          description: 'El análisis se generó pero no se pudo guardar en el historial.',
          variant: 'default'
        });
      } else {
        toast({ 
          title: 'Guardado', 
          description: `${module.title} guardado en tu historial.`,
          variant: 'default'
        });
      }
    } catch (e: any) {
      console.error('Error al generar análisis:', e);
      toast({ title: 'Error', description: e?.message || 'Error desconocido', variant: 'destructive' });
    } finally {
      setGeneratingModule(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/50" data-tour="notebook-panel">
      {/* Header */}
      <div className="p-4 border-b border-border bg-background shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Network className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Bitácora Clínica</h2>
            <p className="text-xs text-muted-foreground">Herramientas de análisis</p>
          </div>
        </div>
      </div>

      {/* Analysis Modules */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {analysisModules.map((module) => (
              <Tooltip key={module.id}>
                <TooltipTrigger asChild>
                  <Card
                    className={`p-3 hover:shadow-md transition-all cursor-pointer ${
                      generatingModule === module.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleGenerate(module)}
                  >
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        module.type === 'mapa_clinico' ? 'bg-purple-50 dark:bg-purple-950/30' :
                        module.type === 'paraclinicos' ? 'bg-blue-50 dark:bg-blue-950/30' :
                        module.type === 'ayudas_diagnosticas' ? 'bg-amber-50 dark:bg-amber-950/30' :
                        module.type === 'analisis_corporal' ? 'bg-pink-50 dark:bg-pink-950/30' :
                        'bg-green-50 dark:bg-green-950/30'
                      }`}>
                        {generatingModule === module.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                          <module.icon className={`w-5 h-5 ${
                            module.type === 'mapa_clinico' ? 'text-purple-600 dark:text-purple-400' :
                            module.type === 'paraclinicos' ? 'text-blue-600 dark:text-blue-400' :
                            module.type === 'ayudas_diagnosticas' ? 'text-amber-600 dark:text-amber-400' :
                            module.type === 'analisis_corporal' ? 'text-pink-600 dark:text-pink-400' :
                            'text-green-600 dark:text-green-400'
                          }`} />
                        )}
                      </div>
                      <span className="text-xs font-medium text-foreground leading-tight">
                        {module.title}
                      </span>
                    </div>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="text-xs">{module.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Fullscreen Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{generatedData?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {generatedData?.type === 'mapa_clinico' && (
              <ClinicalMapViewer mapData={generatedData.content} />
            )}
            {generatedData?.type === 'ayudas_diagnosticas' && (
              <DiagnosticAidsViewer data={generatedData.content} />
            )}
            {generatedData?.type === 'paraclinicos' && (
              <ParaclinicosViewer data={generatedData.content} />
            )}
            {generatedData?.type === 'medicamentos' && (
              <MedicamentosViewer data={generatedData.content} />
            )}
            {generatedData?.type === 'analisis_corporal' && (
              <BodyAnalysisViewer data={generatedData.content} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
