import { useState, useEffect } from "react";
import { Network, FlaskConical, ScanSearch, Pill, Activity, Loader2, Trash2, Edit2, MoreVertical, ThumbsUp, ThumbsDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  {
    id: 'analisis_corporal',
    title: 'Análisis Corporal',
    description: 'Gráficos de evolución de peso, IMC y signos vitales',
    icon: Activity,
    type: 'analisis_corporal'
  },
];

export const ClinicalNotebookPanel = () => {
  const [generatingModule, setGeneratingModule] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [savedNotes, setSavedNotes] = useState<any[]>([]);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [noteFeedback, setNoteFeedback] = useState<Record<string, 'positive' | 'negative' | null>>({});
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackNoteId, setFeedbackNoteId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [selectedFeedbackReasons, setSelectedFeedbackReasons] = useState<string[]>([]);
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
        'medicamentos': 'generate-medicamentos',
        'analisis_corporal': 'generate-body-analysis'
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
      } else if (module.type === 'analisis_corporal') {
        content = data?.bodyAnalysis;
      }

      if (content) {
        const newData = {
          type: module.type,
          title: module.title,
          content: content,
        };
        setGeneratedData(newData);
        setNoteTitle(`${module.title} - ${new Date().toLocaleDateString('es-CO')}`);
        
        // Auto-guardado y abrir en fullscreen
        await autoSaveNote(newData, `${module.title} - ${new Date().toLocaleDateString('es-CO')}`);
        setFullscreenOpen(true);
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

  const autoSaveNote = async (data: any, title: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sanitizedContent = JSON.parse(
        JSON.stringify(data.content, (_k, v) => {
          if (typeof v === 'number' && !Number.isFinite(v)) return null;
          if (v === undefined) return null;
          return v;
        })
      );

      if (sanitizedContent == null) return;

      const { error } = await supabase
        .from('clinical_notes')
        .insert({
          user_id: user.id,
          type: data.type,
          title: title,
          content: sanitizedContent,
        });

      if (error) throw error;

      toast({
        title: "Guardado automático",
        description: "El análisis se guardó en tu historial",
      });

      await loadSavedNotes();
    } catch (error) {
      console.error('Error auto-saving note:', error);
    }
  };

  const handleRenameNote = async () => {
    if (!editingNote || !noteTitle.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar un título",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('clinical_notes')
        .update({ title: noteTitle })
        .eq('id', editingNote.id);

      if (error) throw error;

      toast({
        title: "Nota renombrada",
        description: "El título se actualizó correctamente",
      });

      setEditingNote(null);
      setNoteTitle("");
      await loadSavedNotes();
    } catch (error) {
      console.error('Error renaming note:', error);
      toast({
        title: "Error",
        description: "No se pudo renombrar la nota",
        variant: "destructive"
      });
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    
    try {
      const { error } = await supabase
        .from('clinical_notes')
        .delete()
        .eq('id', noteToDelete);

      if (error) throw error;

      toast({
        title: "Nota eliminada",
        description: "El análisis se eliminó correctamente",
      });

      setNoteToDelete(null);
      await loadSavedNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la nota",
        variant: "destructive"
      });
    }
  };

  const handleNoteFeedback = async (noteId: string, feedbackType: 'positive' | 'negative') => {
    try {
      const currentFeedback = noteFeedback[noteId];
      
      // Si es feedback positivo o toggle del mismo tipo
      if (feedbackType === 'positive' || currentFeedback === feedbackType) {
        const newFeedback = currentFeedback === feedbackType ? null : feedbackType;
        
        setNoteFeedback(prev => ({
          ...prev,
          [noteId]: newFeedback
        }));

        if (newFeedback === 'positive') {
          toast({
            title: "Gracias por tu feedback",
            description: "Tu opinión nos ayuda a mejorar",
          });
        }
      } else {
        // Feedback negativo - abrir dialog
        setFeedbackNoteId(noteId);
        setFeedbackDialogOpen(true);
      }
    } catch (error) {
      console.error('Error saving note feedback:', error);
    }
  };

  const handleSubmitNegativeFeedback = async () => {
    if (!feedbackNoteId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setNoteFeedback(prev => ({
        ...prev,
        [feedbackNoteId]: 'negative'
      }));

      // Guardar en la base de datos
      const feedbackData = {
        user_id: user.id,
        note_id: feedbackNoteId,
        feedback_type: 'negative' as const,
        comment: selectedFeedbackReasons.length > 0 
          ? `Razones: ${selectedFeedbackReasons.join(', ')}${feedbackComment ? `. Comentario: ${feedbackComment}` : ''}`
          : feedbackComment || 'Sin comentario'
      };

      await supabase.from('clinical_notes_feedback').insert(feedbackData);

      toast({
        title: "Gracias por tu feedback",
        description: "Usaremos esta información para mejorar los análisis",
      });

      // Limpiar estado
      setFeedbackDialogOpen(false);
      setFeedbackNoteId(null);
      setFeedbackComment("");
      setSelectedFeedbackReasons([]);
    } catch (error) {
      console.error('Error saving negative feedback:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el feedback",
        variant: "destructive"
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-card/50" data-tour="notebook-panel">
        {/* Header */}
        <div className="p-4 border-b border-border bg-background shadow-sm">
          <div className="flex items-center justify-between">
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


            {/* Saved Notes History - NotebookLM Style */}
            {savedNotes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Bitácoras guardadas
                  </h3>
                  <span className="text-xs text-muted-foreground">{savedNotes.length}</span>
                </div>
                {savedNotes.map((note) => (
                  <Card 
                    key={note.id} 
                    className="group hover:shadow-lg transition-all border-border/50"
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3 mb-2">
                        <div 
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer ${
                            note.type === 'mapa_clinico' ? 'bg-purple-100 dark:bg-purple-950/50' :
                            note.type === 'paraclinicos' ? 'bg-blue-100 dark:bg-blue-950/50' :
                            note.type === 'ayudas_diagnosticas' ? 'bg-amber-100 dark:bg-amber-950/50' :
                            note.type === 'analisis_corporal' ? 'bg-pink-100 dark:bg-pink-950/50' :
                            'bg-green-100 dark:bg-green-950/50'
                          }`}
                          onClick={() => {
                            setGeneratedData({
                              type: note.type,
                              title: note.title,
                              content: note.content,
                            });
                            setFullscreenOpen(true);
                          }}
                        >
                          {note.type === 'mapa_clinico' && <Network className="w-5 h-5 text-purple-700 dark:text-purple-400" />}
                          {note.type === 'paraclinicos' && <FlaskConical className="w-5 h-5 text-blue-700 dark:text-blue-400" />}
                          {note.type === 'ayudas_diagnosticas' && <ScanSearch className="w-5 h-5 text-amber-700 dark:text-amber-400" />}
                          {note.type === 'medicamentos' && <Pill className="w-5 h-5 text-green-700 dark:text-green-400" />}
                          {note.type === 'analisis_corporal' && <Activity className="w-5 h-5 text-pink-700 dark:text-pink-400" />}
                        </div>
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            setGeneratedData({
                              type: note.type,
                              title: note.title,
                              content: note.content,
                            });
                            setFullscreenOpen(true);
                          }}
                        >
                          <p className="text-sm font-semibold text-foreground mb-0.5 line-clamp-1">
                            {note.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            1 fuente · Hace {(() => {
                              const now = new Date();
                              const created = new Date(note.created_at);
                              const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
                              if (diffHours < 1) return 'menos de 1 h';
                              if (diffHours < 24) return `${diffHours} h`;
                              const diffDays = Math.floor(diffHours / 24);
                              return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
                            })()}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(note);
                                setNoteTitle(note.title);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Cambiar nombre
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                toast({
                                  description: "Compartir - Próximamente",
                                  duration: 2000,
                                  className: "bg-background border-muted-foreground/20",
                                });
                              }}
                            >
                              <Share2 className="w-4 h-4 mr-2" />
                              Compartir
                              <span className="ml-auto text-xs text-muted-foreground">Próximamente</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNoteToDelete(note.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Borrar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Feedback buttons */}
                      <div className="flex items-center gap-1 pt-2 border-t border-border/30">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2 ${noteFeedback[note.id] === 'positive' ? 'text-green-600 bg-green-50 dark:bg-green-950/30' : 'text-muted-foreground'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNoteFeedback(note.id, 'positive');
                          }}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2 ${noteFeedback[note.id] === 'negative' ? 'text-red-600 bg-red-50 dark:bg-red-950/30' : 'text-muted-foreground'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNoteFeedback(note.id, 'negative');
                          }}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </Button>
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
              {generatedData?.type === 'analisis_corporal' && (
                <BodyAnalysisViewer data={generatedData.content} />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Note Dialog */}
        <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renombrar bitácora</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nuevo título</label>
                <Input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Ej: Mapa Clínico - Enero 2025"
                  className="mt-2"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingNote(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleRenameNote}>
                  Renombrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El análisis guardado será eliminado permanentemente de tu historial.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteNote}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Feedback Dialog */}
        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>¿Qué no te gustó de este análisis?</DialogTitle>
              <DialogDescription>
                Tu feedback nos ayuda a mejorar. Selecciona una o más opciones y añade comentarios adicionales si lo deseas.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Razones predefinidas */}
              <div className="space-y-3">
                {[
                  { id: 'incorrect', label: 'Información incorrecta o imprecisa' },
                  { id: 'incomplete', label: 'Análisis incompleto' },
                  { id: 'unclear', label: 'No es claro o es confuso' },
                  { id: 'irrelevant', label: 'No es útil para mi caso' },
                  { id: 'formatting', label: 'Problemas de formato o visualización' },
                ].map((reason) => (
                  <div key={reason.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`note-${reason.id}`}
                      checked={selectedFeedbackReasons.includes(reason.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedFeedbackReasons(prev => [...prev, reason.id]);
                        } else {
                          setSelectedFeedbackReasons(prev => prev.filter(r => r !== reason.id));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`note-${reason.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Campo de comentario */}
              <div className="space-y-2">
                <Label htmlFor="note-feedback-comment">
                  Comentarios adicionales (opcional)
                </Label>
                <Textarea
                  id="note-feedback-comment"
                  placeholder="Cuéntanos más sobre tu experiencia..."
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value.slice(0, 500))}
                  className="resize-none h-24"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {feedbackComment.length}/500 caracteres
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setFeedbackDialogOpen(false);
                  setFeedbackNoteId(null);
                  setFeedbackComment("");
                  setSelectedFeedbackReasons([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitNegativeFeedback}
                disabled={selectedFeedbackReasons.length === 0 && !feedbackComment.trim()}
              >
                Enviar feedback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
