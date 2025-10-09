import { useState } from "react";
import { Send, Sparkles, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

export const ChatPanel = () => {
  const [message, setMessage] = useState("");

  const suggestedQuestions = [
    "¿Qué significa hipertensión arterial esencial?",
    "¿Cuáles fueron los resultados de mi último examen de sangre?",
    "¿Cuándo fue mi última consulta de cardiología?",
    "¿Qué medicamentos me han formulado recientemente?",
  ];

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
              {suggestedQuestions.map((question, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/5 hover:border-primary/30 transition-all"
                  onClick={() => setMessage(question)}
                >
                  <span className="text-sm">{question}</span>
                </Button>
              ))}
            </div>
          </div>
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
                if (e.key === "Enter") {
                  // Handle send message
                  console.log("Send:", message);
                  setMessage("");
                }
              }}
              className="flex-1"
            />
            <Button 
              size="icon" 
              className="bg-primary hover:bg-primary-dark transition-all"
              disabled={!message.trim()}
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
