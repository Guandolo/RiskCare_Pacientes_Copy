import { useState, useEffect } from "react";
import { Send, Sparkles, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const ChatPanel = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    loadChatHistory();
    loadSuggestions();
  }, []);

  // Reaccionar a cambios de autenticación (corrige casos de sugerencias estáticas y 401)
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadChatHistory();
        loadSuggestions();
      }
      if (event === 'SIGNED_OUT') {
        setMessages([]);
        setSuggestions([]);
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

  const loadChatHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found for chat history');
        return;
      }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(20);

      if (!error && data) {
        setMessages(data.map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content })));
      } else if (error) {
        console.error('Error loading chat history:', error);
      }
    } catch (error) {
      console.error('Error in loadChatHistory:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

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

      if (!session) throw new Error('No hay sesión activa');

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Asistente Clínico IA</h2>
            <p className="text-xs text-muted-foreground">Pregunta sobre tu historial médico</p>
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
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
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
