import { useState, useEffect } from "react";
import { Network, FlaskConical, ScanSearch, Pill, Loader2, Maximize2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ClinicalMapViewer } from "./ClinicalMapViewer";
import { DiagnosticAidsViewer } from "./DiagnosticAidsViewer";
import { ParaclinicosViewer } from "./ParaclinicosViewer";
import { MedicamentosViewer } from "./MedicamentosViewer";

interface AnalysisModule {
  id: string;
  title: string;
  description: string;
  icon: any;
  type: 'mapa_clinico' | 'paraclinicos' | 'ayudas_diagnosticas' | 'medicamentos';
}

const analysisModules: AnalysisModule[] = [
  {
    id: 'mapa_clinico',
    title: 'Mapa Clínico',
    description: 'Visualiza conexiones entre condiciones, medicamentos y especialistas',
    icon: Network,
    type: 'mapa_clinico'
  },
  {
    id: 'paraclinicos',
    title: 'Paraclínicos',
    description: 'Gráficas de tendencia de resultados de laboratorio',
    icon: FlaskConical,
    type: 'paraclinicos'
  },
  {
    id: 'ayudas_diagnosticas',
    title: 'Ayudas Diagnósticas',
    description: 'Línea de tiempo de estudios de imagenología',
    icon: ScanSearch,
    type: 'ayudas_diagnosticas'
  },
  {
    id: 'medicamentos',
    title: 'Medicamentos',
    description: 'Historial de formulaciones médicas',
    icon: Pill,
    type: 'medicamentos'
  },
];

export const ClinicalNotebookPanel = () => {
  const [generatingModule, setGeneratingModule] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [saveNoteOpen, setSaveNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [savedNotes, setSavedNotes] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadSavedNotes();
  }, []);

  const loadSavedNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleGenerate = async (module: AnalysisModule) => {
    try {
      setGeneratingModule(module.id);
      setGeneratedData(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'Debes iniciar sesión para usar esta función.',
          variant: 'destructive'
        });
        return;
      }

      console.log(`Generating ${module.type}...`);

      const functionMap = {
        'mapa_clinico': 'generate-clinical-map',
        'ayudas_diagnosticas': 'generate-diagnostic-aids',
        'paraclinicos': 'generate-paraclinicos',
        'medicamentos': 'generate-medicamentos'
      };

      const functionName = functionMap[module.type];

      const { data, error } = await supabase.functions.invoke(functionName, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error(`Error generating ${module.type}:`, error);
        throw error;
      }

      console.log(`${module.type} generated:`, data);

      let content;
      if (module.type === 'mapa_clinico') {
        content = data?.map;
      } else if (module.type === 'ayudas_diagnosticas') {
        content = data?.diagnosticAids;
      } else if (module.type === 'paraclinicos') {
        content = data?.paraclinicos;
      } else if (module.type === 'medicamentos') {
        content = data?.medicamentos;
      }

      if (content) {
        setGeneratedData({
          type: module.type,
          title: module.title,
          content: content,
        });
        setNoteTitle(`${module.title} - ${new Date().toLocaleDateString('es-CO')}`);
      }

    } catch (error) {
      console.error('Error al generar análisis:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setGeneratingModule(null);
    }
  };

  const handleSaveNote = async () => {
    if (!generatedData || !noteTitle.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar un título para la nota",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('clinical_notes')
        .insert({
          user_id: user.id,
          type: generatedData.type,
          title: noteTitle,
          content: generatedData.content,
        });

      if (error) throw error;

      toast({
        title: "Nota guardada",
        description: "El análisis se guardó correctamente",
      });

      setSaveNoteOpen(false);
      setNoteTitle("");
      loadSavedNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la nota",
        variant: "destructive"
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Bitácora Clínica</h2>
          <p className="text-xs text-muted-foreground">Herramientas de análisis</p>
        </div>

        {/* Analysis Modules */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Compact Grid Layout */}
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
                          'bg-green-50 dark:bg-green-950/30'
                        }`}>
                          {generatingModule === module.id ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          ) : (
                            <module.icon className={`w-5 h-5 ${
                              module.type === 'mapa_clinico' ? 'text-purple-600 dark:text-purple-400' :
                              module.type === 'paraclinicos' ? 'text-blue-600 dark:text-blue-400' :
                              module.type === 'ayudas_diagnosticas' ? 'text-amber-600 dark:text-amber-400' :
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

            {/* Generated Result Preview */}
            {generatedData && (
              <Card className="p-4 border-primary/50 shadow-lg animate-fade-in">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{generatedData.title}</h3>
                    <p className="text-xs text-muted-foreground">Resultado generado</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFullscreenOpen(true)}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSaveNoteOpen(true)}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setGeneratedData(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="h-[300px] bg-muted rounded-lg overflow-hidden">
                  {generatedData.type === 'mapa_clinico' && (
                    <ClinicalMapViewer mapData={generatedData.content} />
                  )}
                  {generatedData.type === 'ayudas_diagnosticas' && (
                    <DiagnosticAidsViewer data={generatedData.content} />
                  )}
                  {generatedData.type === 'paraclinicos' && (
                    <ParaclinicosViewer data={generatedData.content} />
                  )}
                  {generatedData.type === 'medicamentos' && (
                    <MedicamentosViewer data={generatedData.content} />
                  )}
                </div>
              </Card>
            )}

            {/* Saved Notes History */}
            {savedNotes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Historial
                </h3>
                {savedNotes.map((note) => (
                  <Card 
                    key={note.id} 
                    className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setGeneratedData({
                        type: note.type,
                        title: note.title,
                        content: note.content,
                      });
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                        note.type === 'mapa_clinico' ? 'bg-purple-50 dark:bg-purple-950/30' :
                        note.type === 'paraclinicos' ? 'bg-blue-50 dark:bg-blue-950/30' :
                        note.type === 'ayudas_diagnosticas' ? 'bg-amber-50 dark:bg-amber-950/30' :
                        'bg-green-50 dark:bg-green-950/30'
                      }`}>
                        {note.type === 'mapa_clinico' && <Network className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                        {note.type === 'paraclinicos' && <FlaskConical className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                        {note.type === 'ayudas_diagnosticas' && <ScanSearch className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                        {note.type === 'medicamentos' && <Pill className="w-4 h-4 text-green-600 dark:text-green-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{note.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Save Note Dialog */}
        <Dialog open={saveNoteOpen} onOpenChange={setSaveNoteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Guardar análisis como nota</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título de la nota</label>
                <Input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Ej: Mapa Clínico - Enero 2025"
                  className="mt-2"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSaveNoteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveNote}>
                  Guardar nota
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
