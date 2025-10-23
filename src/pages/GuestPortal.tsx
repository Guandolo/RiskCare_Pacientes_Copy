import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, 
  Clock, 
  User, 
  FileText, 
  Download,
  Shield,
  Eye
} from "lucide-react";
import riskCareLogo from "@/assets/riskcare-logo.png";

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
}

export const GuestPortal = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

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

      // Aquí iría la lógica de descarga del documento
      // Por ahora solo mostramos un mensaje
      alert(`Descargando: ${fileName}`);
    } catch (err) {
      console.error('Error downloading document:', err);
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
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Volver al Inicio
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { patient, documents, permissions } = accessData;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header del Portal de Invitado */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={riskCareLogo} alt="RiskCare" className="h-8" />
            <Badge variant="secondary" className="gap-1">
              <Eye className="w-3 h-3" />
              Portal de Invitado
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Expira en: {formatTimeRemaining(timeRemaining)}
            </span>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Banner de Aviso */}
        <Alert className="border-primary">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Está viendo el historial de <strong>{patient?.full_name}</strong> como invitado.
            Este acceso es temporal y de solo lectura.
          </AlertDescription>
        </Alert>

        {/* Información del Paciente */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Información del Paciente</h2>
          </div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Nombre Completo</Label>
              <p className="font-medium">{patient?.full_name || 'No especificado'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Documento de Identidad</Label>
              <p className="font-medium">
                {patient?.document_type || 'CC'} {patient?.identification}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Edad</Label>
              <p className="font-medium">{patient?.age ? `${patient.age} años` : 'No especificada'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">EPS</Label>
              <p className="font-medium">{patient?.eps || 'No especificada'}</p>
            </div>
            {patient?.phone && (
              <div>
                <Label className="text-sm text-muted-foreground">Teléfono</Label>
                <p className="font-medium">{patient.phone}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Documentos Clínicos */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Documentos Clínicos</h2>
            {!permissions?.allow_download && (
              <Badge variant="secondary" className="ml-auto text-xs">
                Solo visualización
              </Badge>
            )}
          </div>
          <Separator className="mb-4" />
          
          {documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{doc.file_name}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {doc.document_type && (
                        <span>Tipo: {doc.document_type}</span>
                      )}
                      {doc.document_date && (
                        <span>Fecha: {new Date(doc.document_date).toLocaleDateString('es-CO')}</span>
                      )}
                      <span>Subido: {new Date(doc.created_at).toLocaleDateString('es-CO')}</span>
                    </div>
                  </div>
                  {permissions?.allow_download && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay documentos disponibles
            </div>
          )}
        </Card>

        {/* Información de Acceso */}
        <Card className="p-6">
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>Este es un portal de acceso temporal y de solo lectura</p>
            <p>Veces accedido: {accessData.accessCount || 1}</p>
            <p className="text-xs">
              Expira: {accessData.expiresAt ? new Date(accessData.expiresAt).toLocaleString('es-CO') : 'N/A'}
            </p>
          </div>
        </Card>
      </main>

      <footer className="border-t mt-12 py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>
            Portal de invitado de{' '}
            <a 
              href="https://ingenieria365.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors underline"
            >
              Ingenieria 365
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

// Helper component
const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <label className={className}>{children}</label>
);
