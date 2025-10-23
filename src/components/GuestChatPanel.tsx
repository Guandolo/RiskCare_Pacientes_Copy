import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface GuestChatPanelProps {
  patientUserId?: string;
  guestToken?: string;
}

export const GuestChatPanel = ({ patientUserId, guestToken }: GuestChatPanelProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (overrideMessage?: string) => {
    const text = (overrideMessage ?? message).trim();
    if (!text || !patientUserId || !guestToken) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            targetUserId: patientUserId,
            isGuestAccess: true,
            guestToken: guestToken
          })
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Error en la respuesta del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: assistantMessage
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignorar errores de parsing
            }
          }
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Lo siento, ocurrió un error al procesar tu pregunta."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-bold">Asistente Clínico IA</h2>
            <p className="text-xs text-muted-foreground">Pregunta sobre tu historial médico</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Haz una pregunta sobre el historial clínico</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Puedo ayudarte a entender mejor la información médica disponible
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-lg px-4 py-3 max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted border'
                  }`}
                >
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted border rounded-lg px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              placeholder="Escribe tu pregunta sobre el historial clínico..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              className="min-h-[60px] max-h-[200px] resize-none"
              rows={2}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!message.trim() || isLoading}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
