import { useState, useEffect } from "react";
import { Send, Sparkles, Lightbulb, RotateCw, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

export const ChatPanel = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    loadOrCreateConversation();
    loadConversations();
    loadSuggestions();
  }, []);

  // Reaccionar a cambios de autenticación
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadOrCreateConversation();
        loadConversations();
        loadSuggestions();
      }
      if (event === 'SIGNED_OUT') {
        setMessages([]);
        setSuggestions([]);
        setCurrentConversationId(null);
        setConversations([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session for suggestions');
        return;
      }
      
      console.log('Loading suggestions...');
      const { data, error } = await supabase.functions.invoke('chat-suggestions', {
        body: {},
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
    setCurrentConversationId(conversationId);
    await loadChatHistory(conversationId);
    setHistoryOpen(false);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !currentConversationId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Debes iniciar sesión para usar el chat.', variant: 'destructive' });
        return;
      }

      const userMessage = message;
      setMessage("");
      setMessages(prev => [...prev, { role: "user", content: userMessage }]);
      setIsLoading(true);

      const CHAT_URL = `https://mixunsevvfenajctpdfq.functions.supabase.co/functions/v1/chat-stream`;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 401) throw new Error('No autenticado');
        if (resp.status === 429) throw new Error('Límite de solicitudes alcanzado, intenta luego.');
        if (resp.status === 402) throw new Error('Se requieren créditos para AI.');
        throw new Error('No se pudo iniciar el stream');
      }

      // Stream SSE token a token
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantSoFar = '';

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
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
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
                          className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                            conv.id === currentConversationId ? 'border-primary' : ''
                          }`}
                          onClick={() => switchConversation(conv.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
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
                            </div>
                            {conv.id === currentConversationId && (
                              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                            )}
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

              {/* Suggested Questions */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lightbulb className="w-4 h-4" />
                  <span className="font-medium">Preguntas sugeridas:</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {suggestionsLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <Button key={idx} variant="outline" disabled className="justify-start text-left h-auto py-3 px-4">
                        <span className="text-sm text-muted-foreground">Cargando sugerencias...</span>
                      </Button>
                    ))
                  ) : (
                    (suggestions.length ? suggestions : [
                      "¿Qué significa hipertensión arterial esencial?",
                      "¿Cuáles fueron los resultados de mi último examen de sangre?",
                      "¿Cuándo fue mi última consulta de cardiología?",
                      "¿Qué medicamentos me han formulado recientemente?",
                    ]).map((question, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/5 hover:border-primary/30 transition-all"
                        onClick={() => setMessage(question)}
                        disabled={isLoading}
                      >
                        <span className="text-sm">{question}</span>
                      </Button>
                    ))
                  )}
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
                    </div>
                  </div>
                </Card>
              ))}
              {isLoading && (
                <Card className="p-4 bg-gradient-card border-primary/20">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Pensando...</p>
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
            <Input
              placeholder="Escribe tu pregunta sobre tu historial médico..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleSendMessage();
                }
              }}
              className="flex-1"
              disabled={isLoading}
            />
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
    </div>
  );
};
