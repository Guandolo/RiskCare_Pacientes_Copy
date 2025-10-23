import { useState, useEffect } from "react";
import { Network, FlaskConical, ScanSearch, Pill, Activity, Loader2, History, Trash2, Pencil, Check, ThumbsUp, ThumbsDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface SavedNote {
  id: string;
  type: string;
  title: string;
  content: any;
  created_at: string;
  user_id: string;
  patient_user_id: string | null;
}

interface NoteFeedback {
  noteId: string;
  type: 'positive' | 'negative' | null;
}

export const ClinicalNotebookPanel = ({ displayedUserId }: ClinicalNotebookPanelProps) => {
  const { isProfesional } = useUserRole();
  const { activePatient } = useActivePatient();
  const { toast } = useToast();
  const [generatingModule, setGeneratingModule] = useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [generatedData, setGeneratedData] = useState<{ type: string; title: string; content: any } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackNoteId, setFeedbackNoteId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [noteFeedback, setNoteFeedback] = useState<Record<string, 'positive' | 'negative' | null>>({});

  // 🆕 Cargar historial al montar y cuando cambia el paciente activo
  useEffect(() => {
    loadHistory();
  }, [isProfesional, activePatient?.user_id]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const currentUserId = session.user.id;
      const targetPatientId = isProfesional && activePatient ? activePatient.user_id : null;

      console.log('[ClinicalNotebook] 📚 Cargando historial para:', {
        currentUserId,
        targetPatientId,
        isProfesional,
        context: targetPatientId ? 'Profesional -> Paciente' : 'Paciente propio'
      });

      // Construir query según contexto
      let query = supabase
        .from('clinical_notes')
        .select('*')
        .eq('user_id', currentUserId);

      if (isProfesional && targetPatientId) {
        // Profesional: notas sobre el paciente activo
        query = query.eq('patient_user_id', targetPatientId);
      } else {
        // Paciente: solo sus notas propias (patient_user_id IS NULL)
        query = query.is('patient_user_id', null);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[ClinicalNotebook] ✅ Historial cargado:', data?.length || 0, 'notas');
      setSavedNotes(data || []);
    } catch (error) {
      console.error('[ClinicalNotebook] ❌ Error cargando historial:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el historial.',
        variant: 'destructive'
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('clinical_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast({
        title: 'Eliminado',
        description: 'Nota eliminada del historial.',
      });

      await loadHistory();
    } catch (error) {
      console.error('[ClinicalNotebook] Error eliminando nota:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la nota.',
        variant: 'destructive'
      });
    }
  };

  const handleViewNote = (note: SavedNote) => {
    setGeneratedData({
      type: note.type,
      title: note.title,
      content: note.content
    });
    setFullscreenOpen(true);
    setHistoryOpen(false);
  };

  const handleEditNoteTitle = async (noteId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('clinical_notes')
        .update({ title: newTitle })
        .eq('id', noteId);

      if (error) throw error;

      toast({
        description: '✓ Título actualizado',
        duration: 1500,
      });

      await loadHistory();
      setEditingNoteId(null);
    } catch (error) {
      console.error('[ClinicalNotebook] Error actualizando título:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el título.',
        variant: 'destructive'
      });
    }
  };

  const handleNoteFeedback = async (noteId: string, feedbackType: 'positive' | 'negative') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentFeedback = noteFeedback[noteId];
      
      if (feedbackType === 'positive' || currentFeedback === feedbackType) {
        const newFeedback = currentFeedback === feedbackType ? null : feedbackType;
        
        setNoteFeedback(prev => ({
          ...prev,
          [noteId]: newFeedback
        }));

        if (newFeedback === 'positive') {
          await supabase.from('clinical_notes_feedback').insert({
            user_id: user.id,
            note_id: noteId,
            feedback_type: 'positive',
            comment: null
          });

          toast({
            description: "✓ Feedback guardado",
            duration: 1500,
          });
        } else if (newFeedback === null) {
          await supabase
            .from('clinical_notes_feedback')
            .delete()
            .eq('note_id', noteId)
            .eq('user_id', user.id);
        }
      } else {
        // Feedback negativo - abrir dialog
        setFeedbackNoteId(noteId);
        setFeedbackDialogOpen(true);
      }
    } catch (error) {
      console.error('Error guardando feedback:', error);
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

      await supabase.from('clinical_notes_feedback').insert({
        user_id: user.id,
        note_id: feedbackNoteId,
        feedback_type: 'negative',
        comment: feedbackComment || 'Sin comentario'
      });

      toast({
        title: "Gracias por tu feedback",
        description: "Usaremos esta información para mejorar",
      });

      setFeedbackDialogOpen(false);
      setFeedbackNoteId(null);
      setFeedbackComment("");
    } catch (error) {
      console.error('Error guardando feedback negativo:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el feedback",
        variant: "destructive"
      });
    }
  };

  const handleGenerate = async (module: AnalysisModule) => {
    try {
      setGeneratingModule(module.id);
      setGeneratedData(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Debes iniciar sesión para usar esta función.', variant: 'destructive' });
        return;
      }

      // 🆕 Determinar el userId correcto: siempre el del paciente cuyos datos se analizan
      const targetUserId = isProfesional && activePatient ? activePatient.user_id : session.user.id;
      
      console.log('[ClinicalNotebook] 📊 Generando', module.type, 'para paciente:', targetUserId);

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

      // 🆕 LÓGICA DE ASOCIACIÓN DUAL (profesional + paciente)
      // - user_id: SIEMPRE el que crea/genera la nota (profesional o paciente)
      // - patient_user_id: SOLO si es profesional generando sobre un paciente diferente
      const currentUserId = session.user.id;
      const isViewingPatient = isProfesional && activePatient && activePatient.user_id !== currentUserId;
      
      console.log('[ClinicalNotebook] 💾 Guardando nota clínica:', {
        module: module.type,
        creator_user_id: currentUserId,
        patient_user_id: isViewingPatient ? activePatient.user_id : null,
        is_professional: isProfesional,
        active_patient_id: activePatient?.user_id,
        active_patient_name: activePatient?.full_name,
        context: isViewingPatient ? 'Profesional -> Paciente' : 'Paciente propio'
      });

      // Construir objeto de inserción
      const noteData: any = {
        user_id: currentUserId, // Quién crea la nota
        type: module.type,
        title: module.title,
        content: content
      };

      // 🚨 CRÍTICO: Solo agregar patient_user_id si es profesional viendo paciente diferente
      if (isViewingPatient) {
        noteData.patient_user_id = activePatient.user_id;
        console.log('[ClinicalNotebook] ✅ Nota asociada a paciente:', activePatient.full_name);
      } else {
        console.log('[ClinicalNotebook] ✅ Nota propia del paciente (sin patient_user_id)');
      }

      const { error: saveError } = await supabase
        .from('clinical_notes')
        .insert(noteData);

      if (saveError) {
        console.error('[ClinicalNotebook] ❌ Error guardando nota:', saveError);
        toast({ 
          title: 'Advertencia', 
          description: 'El análisis se generó pero no se pudo guardar en el historial.',
          variant: 'default'
        });
      } else {
        console.log('[ClinicalNotebook] ✅ Nota guardada exitosamente');
        toast({ 
          title: 'Guardado', 
          description: `${module.title} guardado en tu historial.`,
          variant: 'default'
        });
        // 🆕 Recargar historial después de guardar
        await loadHistory();
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
          
          {/* Botón de Historial */}
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                onClick={loadHistory}
              >
                <History className="w-4 h-4" />
                <span className="text-xs">Historial</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Historial de Análisis</SheetTitle>
              </SheetHeader>
              
              {/* Barra de búsqueda */}
              <div className="mt-4 mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar análisis..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <ScrollArea className="h-[calc(100vh-180px)]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : savedNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay análisis guardados aún.</p>
                    <p className="text-xs mt-2">Los análisis se guardarán automáticamente al generarlos.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedNotes
                      .filter(note => 
                        searchQuery === "" || 
                        note.title.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((note) => {
                      const module = analysisModules.find(m => m.type === note.type);
                      const Icon = module?.icon || Network;
                      const isEditing = editingNoteId === note.id;
                      
                      return (
                        <Card 
                          key={note.id} 
                          className="p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => !isEditing && handleViewNote(note)}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded flex items-center justify-center ${
                                  note.type === 'mapa_clinico' ? 'bg-purple-50 dark:bg-purple-950/30' :
                                  note.type === 'paraclinicos' ? 'bg-blue-50 dark:bg-blue-950/30' :
                                  note.type === 'ayudas_diagnosticas' ? 'bg-amber-50 dark:bg-amber-950/30' :
                                  note.type === 'analisis_corporal' ? 'bg-pink-50 dark:bg-pink-950/30' :
                                  'bg-green-50 dark:bg-green-950/30'
                                }`}>
                                  <Icon className={`w-4 h-4 ${
                                    note.type === 'mapa_clinico' ? 'text-purple-600 dark:text-purple-400' :
                                    note.type === 'paraclinicos' ? 'text-blue-600 dark:text-blue-400' :
                                    note.type === 'ayudas_diagnosticas' ? 'text-amber-600 dark:text-amber-400' :
                                    note.type === 'analisis_corporal' ? 'text-pink-600 dark:text-pink-400' :
                                    'text-green-600 dark:text-green-400'
                                  }`} />
                                </div>
                                
                                {isEditing ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      value={editingNoteTitle}
                                      onChange={(e) => setEditingNoteTitle(e.target.value)}
                                      className="h-7 text-sm"
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditNoteTitle(note.id, editingNoteTitle);
                                      }}
                                    >
                                      <Check className="w-4 h-4 text-green-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="font-medium text-sm">{note.title}</span>
                                )}
                                
                                {!isEditing && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingNoteId(note.id);
                                      setEditingNoteTitle(note.title);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(note.created_at).toLocaleDateString('es-CO', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNoteFeedback(note.id, 'positive');
                                }}
                                className={noteFeedback[note.id] === 'positive' ? 'text-green-600' : ''}
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNoteFeedback(note.id, 'negative');
                                }}
                                className={noteFeedback[note.id] === 'negative' ? 'text-red-600' : ''}
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNote(note.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>
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

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Qué salió mal?</DialogTitle>
            <DialogDescription>
              Tu feedback nos ayuda a mejorar los análisis clínicos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Describe qué podría mejorar en este análisis..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFeedbackDialogOpen(false);
                setFeedbackNoteId(null);
                setFeedbackComment("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmitNegativeFeedback}>
              Enviar Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
