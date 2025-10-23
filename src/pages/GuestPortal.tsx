import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  AlertCircle, 
  Clock, 
  User, 
  FileText, 
  Download,
  Shield,
  Eye,
  Send,
  Loader2,
  Sparkles
} from "lucide-react";
import riskCareLogo from "@/assets/riskcare-logo.png";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PatientData {
  full_name: string;
  identification: string;
  document_type: string;
  age: number | null;
  eps: string | null;
  phone: string | null;
  topus_data: any;
}

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  document_type: string | null;
  document_date: string | null;
  created_at: string;
  file_url?: string;
}

interface AccessData {
  valid: boolean;
  error?: string;
  patient?: PatientData;
  documents?: Document[];
  permissions?: {
    allow_download: boolean;
    allow_chat: boolean;
    allow_notebook: boolean;
  };
  expiresAt?: string;
  timeRemaining?: number;
  accessCount?: number;
  patientUserId?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const GuestPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      setError('Token no válido');
      setLoading(false);
      return;
    }

    validateAccess();
  }, [token]);

  useEffect(() => {
    if (accessData?.valid && accessData.timeRemaining) {
      setTimeRemaining(accessData.timeRemaining);
      
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setError('El acceso ha expirado');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [accessData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const validateAccess = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: validationError } = await supabase.functions.invoke('validate-shared-access', {
        body: { 
          token,
          action: 'view',
          actionDetails: {
            timestamp: new Date().toISOString()
          }
        }
      });

      if (validationError) throw validationError;

      if (data.valid) {
        setAccessData(data);
      } else {
        setError(data.error || 'Acceso no válido');
      }
    } catch (err) {
      console.error('Error validating access:', err);
      setError('Error al validar el acceso');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    if (!accessData?.permissions?.allow_download) {
      return;
    }

    try {
      // Registrar el acceso
      await supabase.functions.invoke('validate-shared-access', {
        body: { 
          token,
          action: 'download_document',
          actionDetails: {
            documentId,
            fileName,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Descargar el documento desde storage
      const { data: { user } } = await supabase.auth.getUser();
      const userId = accessData.patientUserId;
      
      if (userId) {
        const { data, error } = await supabase.storage
          .from('clinical-documents')
          .download(`${userId}/${fileName}`);

        if (error) throw error;

        // Crear un enlace de descarga
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      alert('Error al descargar el documento');
    }
  };

  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || !accessData?.permissions?.allow_chat) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoadingChat(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            targetUserId: accessData.patientUserId,
            isGuestAccess: true,
            guestToken: token
          })
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Error en la respuesta del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Agregar mensaje del asistente vacío
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
      setIsLoadingChat(false);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Validando acceso...</p>
        </div>
      </div>
    );
  }

  if (error || !accessData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Acceso No Válido</h1>
            <p className="text-muted-foreground">
              {error || 'El enlace ha expirado, ha sido revocado o no es válido.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const { patient, documents, permissions } = accessData;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={riskCareLogo} alt="RiskCare" className="h-6" />
            <Badge variant="outline" className="gap-1 text-xs">
              <Eye className="w-3 h-3" />
              Portal de Invitado
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">
              Expira en: {formatTimeRemaining(timeRemaining)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Panel Izquierdo - Información del Paciente */}
        <div className="w-80 border-r flex flex-col bg-muted/20">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Banner de Aviso */}
              <Alert className="border-primary/50 bg-primary/5">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  Acceso temporal de solo lectura
                </AlertDescription>
              </Alert>

              {/* Información del Paciente */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Información del Paciente</h3>
                </div>
                <Separator className="mb-3" />
                <div className="space-y-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nombre Completo</Label>
                    <p className="font-medium">{patient?.full_name || 'No especificado'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Documento</Label>
                    <p className="font-medium">
                      {patient?.document_type || 'CC'} {patient?.identification}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Edad</Label>
                      <p className="font-medium">{patient?.age ? `${patient.age} años` : 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">EPS</Label>
                      <p className="font-medium text-xs">{patient?.eps || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Documentos */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Documentos</h3>
                  {!permissions?.allow_download && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Solo lectura
                    </Badge>
                  )}
                </div>
                <Separator className="mb-3" />
                
                {documents && documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs truncate">{doc.file_name}</p>
                            <div className="flex flex-col gap-0.5 mt-1">
                              {doc.document_type && (
                                <span className="text-xs text-muted-foreground">
                                  {doc.document_type}
                                </span>
                              )}
                              {doc.document_date && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(doc.document_date).toLocaleDateString('es-CO')}
                                </span>
                              )}
                            </div>
                          </div>
                          {permissions?.allow_download && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No hay documentos disponibles
                  </div>
                )}
              </Card>
            </div>
          </ScrollArea>
        </div>

        {/* Panel Central - Chat */}
        <div className="flex-1 flex flex-col">
          {permissions?.allow_chat ? (
            <>
              <div className="border-b bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Asistente Clínico</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pregunta sobre la información clínica del paciente
                </p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm">
                        Haz una pregunta sobre el historial clínico
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`rounded-lg px-4 py-2 max-w-[80%] ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
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
                  {isLoadingChat && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="border-t p-4">
                <div className="max-w-3xl mx-auto">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Escribe tu pregunta..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isLoadingChat}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoadingChat}
                      size="icon"
                    >
                      {isLoadingChat ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">El chat no está habilitado para este acceso</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper component
const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <label className={className}>{children}</label>
);
