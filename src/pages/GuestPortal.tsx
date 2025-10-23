import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { 
  AlertCircle, 
  Clock, 
  Shield,
  Eye
} from "lucide-react";
import riskCareLogo from "@/assets/riskcare-logo.png";
import { GuestDataSourcesPanel } from "@/components/GuestDataSourcesPanel";
import { GuestChatPanel } from "@/components/GuestChatPanel";

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

export const GuestPortal = () => {
  const { token } = useParams<{ token: string }>();
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-download-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            documentId
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al descargar el documento');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      alert(err instanceof Error ? err.message : 'Error al descargar el documento');
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

      {/* Banner de Aviso de Acceso Temporal */}
      <div className="border-b bg-muted/20">
        <div className="container px-4 py-2">
          <Alert className="border-primary/50 bg-primary/5">
            <Shield className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              Acceso temporal de {permissions?.allow_download ? 'lectura y descarga' : 'solo lectura'}
              {!permissions?.allow_chat && ' - Chat no disponible'}
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Layout Principal con Componentes Reutilizados */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel Izquierdo - Reutilizar diseño de DataSourcesPanel */}
        <div className="w-80 border-r bg-muted/20 overflow-hidden">
          <GuestDataSourcesPanel
            patient={patient}
            documents={documents}
            permissions={permissions}
            onDownloadDocument={handleDownloadDocument}
          />
        </div>

        {/* Panel Central - Reutilizar diseño de ChatPanel */}
        <div className="flex-1 overflow-hidden">
          {permissions?.allow_chat ? (
            <GuestChatPanel
              patientUserId={accessData?.patientUserId}
              guestToken={token}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
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
