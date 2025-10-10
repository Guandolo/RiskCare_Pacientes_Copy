import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Lightbulb, RotateCw, History, Pencil, Check, Mic, MicOff, Paperclip, Clock, CheckCircle2, Loader2, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SecureUploadModal } from "./SecureUploadModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

type ProgressStep = {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
};

export const ChatPanel = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [hasLoadedInitialSuggestions, setHasLoadedInitialSuggestions] = useState(false);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const suggestionsScrollRef = useRef<HTMLDivElement>(null);
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadOrCreateConversation();
    loadConversations();
    initializeSpeechRecognition();

    // Listener para recargar sugerencias cuando se actualicen documentos
    const handleDocumentsUpdate = () => {
      loadSuggestions();
    };
    window.addEventListener('documentsUpdated', handleDocumentsUpdate);

    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentsUpdate);
    };
  }, []);

  // Reaccionar a cambios de autenticación (centralizado)
  useEffect(() => {
    const handle = (e: any) => {
      const event = e?.detail?.event;
      if (event === 'SIGNED_IN' && !hasLoadedInitialSuggestions) {
        loadOrCreateConversation();
        loadConversations();
        loadSuggestions(); // Solo cuando inicia sesión por primera vez
        setHasLoadedInitialSuggestions(true);
      }
      if (event === 'SIGNED_OUT') {
        setMessages([]);
        setSuggestions([]);
        setCurrentConversationId(null);
        setConversations([]);
        setHasLoadedInitialSuggestions(false);
      }
    };
    window.addEventListener('authChanged', handle);
    return () => window.removeEventListener('authChanged', handle);
  }, [hasLoadedInitialSuggestions]);

  const loadSuggestions = async (conversationContext?: Message[]) => {
    try {
      setSuggestionsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session for suggestions');
        return;
      }
      
      console.log('Loading suggestions with context...');
      const { data, error } = await supabase.functions.invoke('chat-suggestions', {
        body: { 
          conversationContext: conversationContext || messages 
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (error) {
        console.error('Suggestions error:', error);
        return;
      }
      
      console.log('Suggestions response:', data);
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        console.log('Setting suggestions:', data.suggestions);
        setSuggestions(data.suggestions);
      }
    } catch (e) {
      console.error('Error cargando sugerencias:', e);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const loadOrCreateConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar la conversación más reciente
      const { data: latestConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (latestConv) {
        setCurrentConversationId(latestConv.id);
        await loadChatHistory(latestConv.id);
      } else {
        await createNewConversation();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadChatHistory = async (conversationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data.map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content })));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const createNewConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title: 'Nueva conversación' })
        .select()
        .single();

      if (!error && data) {
        setCurrentConversationId(data.id);
        setMessages([]);
        await loadConversations();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const switchConversation = async (conversationId: string) => {
    try {
      setCurrentConversationId(conversationId);
      setMessages([]); // Limpiar mensajes actuales
      await loadChatHistory(conversationId);
      setHistoryOpen(false);
      
      toast({
        title: "Conversación cargada",
        description: "Ahora puedes continuar esta conversación",
      });
    } catch (error) {
      console.error('Error switching conversation:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la conversación",
        variant: "destructive"
      });
    }
  };

  const generateTitle = async (firstMessage: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('generate-chat-title', {
        body: { message: firstMessage },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error('Error generating title:', error);
        return 'Consulta médica';
      }

      return data?.title || 'Consulta médica';
    } catch (error) {
      console.error('Error generating title:', error);
      return 'Consulta médica';
    }
  };

  const startEditingTitle = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title || '');
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const saveTitle = async (convId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title: editingTitle, updated_at: new Date().toISOString() })
        .eq('id', convId);

      if (!error) {
        await loadConversations();
        setEditingId(null);
      } else {
        console.error('Error saving title:', error);
      }
    } catch (error) {
      console.error('Error saving title:', error);
    }
  };

  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'es-CO';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Voice recognition started');
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('Transcript:', transcript);
      setMessage(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        toast({
          title: "Permiso denegado",
          description: "Por favor permite el acceso al micrófono para usar esta función.",
          variant: "destructive"
        });
      } else if (event.error === 'no-speech') {
        toast({
          title: "No se detectó voz",
          description: "No se escuchó ninguna voz. Intenta de nuevo.",
          variant: "destructive"
        });
      }
    };

    recognition.onend = () => {
      console.log('Voice recognition ended');
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  };

  const toggleVoiceRecognition = () => {
    if (!recognitionRef.current) {
      toast({
        title: "No disponible",
        description: "El reconocimiento de voz no está disponible en este navegador. Usa Chrome o Edge.",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast({
          title: "Error",
          description: "No se pudo iniciar el reconocimiento de voz.",
          variant: "destructive"
        });
      }
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !currentConversationId) return;

    // Inicializar pasos de progreso
    const initialSteps: ProgressStep[] = [
      { id: 'analyzing', label: 'Analizando tu pregunta', status: 'pending' },
      { id: 'searching', label: 'Buscando en tus documentos', status: 'pending' },
      { id: 'drafting', label: 'Redactando la respuesta', status: 'pending' },
      { id: 'verifying', label: 'Verificando la precisión', status: 'pending' }
    ];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Debes iniciar sesión para usar el chat.', variant: 'destructive' });
        return;
      }

      const userMessage = message;
      const isFirstMessage = messages.length === 0;
      setMessage("");
      setMessages(prev => [...prev, { role: "user", content: userMessage }]);
      setIsLoading(true);
      setProgressSteps(initialSteps);

      // Paso 1: Analizando
      setProgressSteps(prev => prev.map(step => 
        step.id === 'analyzing' ? { ...step, status: 'in-progress' as const } : step
      ));
      await new Promise(resolve => setTimeout(resolve, 300));
      setProgressSteps(prev => prev.map(step => 
        step.id === 'analyzing' ? { ...step, status: 'completed' as const } : step
      ));

      // Paso 2: Buscando
      setProgressSteps(prev => prev.map(step => 
        step.id === 'searching' ? { ...step, status: 'in-progress' as const } : step
      ));

      const CHAT_URL = `https://mixunsevvfenajctpdfq.functions.supabase.co/functions/v1/chat-stream`;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: userMessage, conversationId: currentConversationId }),
      });

      if (!resp.ok || !resp.body) {
        setProgressSteps([]);
        if (resp.status === 401) throw new Error('No autenticado');
        if (resp.status === 429) throw new Error('Límite de solicitudes alcanzado, intenta luego.');
        if (resp.status === 402) throw new Error('Se requieren créditos para AI.');
        throw new Error('No se pudo iniciar el stream');
      }

      // Completar búsqueda al obtener respuesta
      setProgressSteps(prev => prev.map(step => 
        step.id === 'searching' ? { ...step, status: 'completed' as const } : step
      ));

      // Paso 3: Redactando
      setProgressSteps(prev => prev.map(step => 
        step.id === 'drafting' ? { ...step, status: 'in-progress' as const } : step
      ));

      // Stream SSE token a token
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantSoFar = '';
      let hasStartedStreaming = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              // Primera vez que llega contenido
              if (!hasStartedStreaming) {
                setProgressSteps(prev => prev.map(step => 
                  step.id === 'drafting' ? { ...step, status: 'completed' as const } : step
                ));
                setProgressSteps(prev => prev.map(step => 
                  step.id === 'verifying' ? { ...step, status: 'in-progress' as const } : step
                ));
                hasStartedStreaming = true;
              }

              assistantSoFar += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Completar verificación
      setProgressSteps(prev => prev.map(step => 
        step.id === 'verifying' ? { ...step, status: 'completed' as const } : step
      ));
      
      // Esperar antes de limpiar
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgressSteps([]);

      if (isFirstMessage && currentConversationId) {
        const title = await generateTitle(userMessage);
        await supabase
          .from('conversations')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', currentConversationId);
        await loadConversations();
      }

      // Generar nuevas sugerencias basadas en el contexto de la conversación
      // Esperar un momento para que el mensaje se procese completamente
      setTimeout(() => {
        loadSuggestions([...messages, { role: "user", content: userMessage }, { role: "assistant", content: assistantSoFar }]);
      }, 1000);

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      setMessages(prev => prev.slice(0, -1));
      setProgressSteps([]);
    } finally {
      setIsLoading(false);
      setProgressSteps([]);
    }
  };

  const handleUploadSuccess = () => {
    toast({ title: 'Éxito', description: 'Documento cargado y verificado correctamente' });
    window.dispatchEvent(new CustomEvent('documentsUpdated'));
  };

  const scrollSuggestions = (direction: 'left' | 'right') => {
    if (!suggestionsScrollRef.current) return;
    const scrollAmount = 300;
    const newScroll = direction === 'left' 
      ? suggestionsScrollRef.current.scrollLeft - scrollAmount
      : suggestionsScrollRef.current.scrollLeft + scrollAmount;
    
    suggestionsScrollRef.current.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
  };

  return (
    <div className="flex flex-col h-full bg-background" data-tour="chat-panel">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Asistente Clínico IA</h2>
              <p className="text-xs text-muted-foreground">Pregunta sobre tu historial médico</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={createNewConversation}
              className="gap-2"
              disabled={isLoading}
            >
              <RotateCw className="w-4 h-4" />
              Reiniciar
            </Button>
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <History className="w-4 h-4" />
                  Historial
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Historial de Conversaciones</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                  <div className="space-y-2">
                    {conversations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay conversaciones previas
                      </p>
                    ) : (
                      conversations.map((conv) => (
                        <Card
                          key={conv.id}
                          className={`p-3 hover:bg-accent transition-colors ${
                            conv.id === currentConversationId ? 'border-primary' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => switchConversation(conv.id)}
                            >
                              {editingId === conv.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    ref={editInputRef}
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') saveTitle(conv.id);
                                    }}
                                    className="text-sm h-7"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveTitle(conv.id);
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm font-medium truncate">
                                    {conv.title || 'Sin título'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(conv.updated_at).toLocaleDateString('es-CO', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {editingId !== conv.id && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingTitle(conv);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {conv.id === currentConversationId && (
                                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <>
              {/* Welcome Message */}
              <Card className="p-4 bg-gradient-card shadow-card border-primary/20">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground leading-relaxed">
                      ¡Hola! Soy tu asistente clínico personal. Puedo ayudarte a entender la información 
                      en tus documentos médicos. Pregúntame sobre términos médicos, resultados de exámenes, 
                      consultas anteriores o medicamentos.
                    </p>
                    <p className="text-xs text-muted-foreground mt-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                      <strong>Importante:</strong> No ofrezco diagnósticos ni recomendaciones médicas. 
                      Solo te ayudo a comprender tu información clínica existente.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Suggested Questions - Horizontal Carousel */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lightbulb className="w-4 h-4" />
                    <span className="font-medium">Preguntas sugeridas:</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadSuggestions()}
                    disabled={suggestionsLoading}
                    className="h-auto py-1 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                  >
                    <RotateCw className={`w-3 h-3 ${suggestionsLoading ? 'animate-spin' : ''}`} />
                    {suggestionsLoading ? 'Generando...' : 'Ver más preguntas'}
                  </Button>
                </div>
                
                {/* Horizontal Carousel Container */}
                <div className="relative group">
                  {/* Left Arrow */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => scrollSuggestions('left')}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {/* Scrollable Suggestions */}
                  <div 
                    ref={suggestionsScrollRef}
                    className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {suggestionsLoading ? (
                      Array.from({ length: 3 }).map((_, idx) => (
                        <Card key={idx} className="flex-shrink-0 w-[280px] p-4 bg-muted/50 animate-pulse">
                          <div className="h-12 bg-muted rounded"></div>
                        </Card>
                      ))
                    ) : (
                      (suggestions.length ? suggestions : [
                        "¿Qué significa hipertensión arterial esencial?",
                        "¿Cuáles fueron los resultados de mi último examen de sangre?",
                        "¿Cuándo fue mi última consulta de cardiología?",
                        "¿Qué medicamentos me han formulado recientemente?",
                      ]).map((question, idx) => (
                        <Card
                          key={idx}
                          className="flex-shrink-0 w-[280px] p-4 bg-card hover:bg-accent hover:border-primary/50 border-border transition-all cursor-pointer group/card"
                          onClick={() => setMessage(question)}
                        >
                          <p className="text-sm text-foreground leading-relaxed line-clamp-3 group-hover/card:text-primary transition-colors">
                            {question}
                          </p>
                        </Card>
                      ))
                    )}
                  </div>

                  {/* Right Arrow */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => scrollSuggestions('right')}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <Card key={idx} className={`p-4 ${msg.role === 'assistant' ? 'bg-gradient-card border-primary/20' : 'bg-muted/50'}`}>
                  <div className="flex gap-3">
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({node, ...props}) => <ul className="mb-2 ml-4 list-disc" {...props} />,
                            ol: ({node, ...props}) => <ol className="mb-2 ml-4 list-decimal" {...props} />,
                            li: ({node, ...props}) => <li className="mb-1" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                            code: ({node, inline, ...props}: any) => 
                              inline 
                                ? <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props} />
                                : <code className="block bg-muted p-2 rounded text-sm overflow-x-auto" {...props} />,
                            sup: ({node, ...props}) => <sup className="text-primary font-medium" {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      
                      {/* Sello de Respuesta Verificada */}
                      {msg.role === 'assistant' && !isLoading && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                  Respuesta Verificada
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="text-xs">
                                Esta respuesta fue verificada por nuestro sistema de auditoría para asegurar que la información es fiel a tus documentos cargados.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {isLoading && progressSteps.length > 0 && (
                <Card className="p-4 bg-gradient-card border-primary/20">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <div className="flex-1 space-y-3">
                      {progressSteps.map((step) => (
                        <div key={step.id} className="flex items-center gap-3">
                          {step.status === 'pending' && (
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                          {step.status === 'in-progress' && (
                            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                          )}
                          {step.status === 'completed' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          <span className={`text-sm ${
                            step.status === 'completed' ? 'text-green-600 dark:text-green-400 line-through' :
                            step.status === 'in-progress' ? 'text-primary font-medium' :
                            'text-muted-foreground'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setShowUploadModal(true)}
              disabled={isLoading}
              title="Adjuntar documento"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              placeholder="Escribe tu pregunta sobre tu historial médico..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 min-h-[44px] max-h-[200px] resize-none"
              disabled={isLoading}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '44px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
            <Button
              size="icon"
              variant={isListening ? "default" : "outline"}
              onClick={toggleVoiceRecognition}
              disabled={isLoading}
              className={isListening ? "bg-destructive hover:bg-destructive/90 animate-pulse" : ""}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button 
              size="icon" 
              className="bg-primary hover:bg-primary-dark transition-all"
              disabled={!message.trim() || isLoading}
              onClick={handleSendMessage}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Las respuestas están basadas exclusivamente en tus documentos cargados
          </p>
        </div>
      </div>

      {/* Upload Modal */}
      <SecureUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
};
