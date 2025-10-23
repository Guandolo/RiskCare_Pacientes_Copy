import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Share2, QrCode, Copy, Trash2, AlertCircle } from "lucide-react";
import QRCodeLib from "qrcode";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface ShareHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SharedAccess {
  id: string;
  token: string;
  shareUrl: string;
  expires_at: string;
  created_at: string;
  permissions: {
    allow_download: boolean;
    allow_chat: boolean;
    allow_notebook: boolean;
  };
  access_count: number;
  timeRemaining: number;
}

export const ShareHistoryModal = ({ open, onOpenChange }: ShareHistoryModalProps) => {
  const [activeTab, setActiveTab] = useState("create");
  const [duration, setDuration] = useState("30");
  const [permissions, setPermissions] = useState({
    allow_download: false,
    allow_chat: false,
    allow_notebook: false,
  });
  const [loading, setLoading] = useState(false);
  const [generatedAccess, setGeneratedAccess] = useState<SharedAccess | null>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [activeAccesses, setActiveAccesses] = useState<SharedAccess[]>([]);
  const [loadingAccesses, setLoadingAccesses] = useState(false);

  useEffect(() => {
    if (open && activeTab === "manage") {
      fetchActiveAccesses();
    }
  }, [open, activeTab]);

  const fetchActiveAccesses = async () => {
    setLoadingAccesses(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-shared-accesses');
      
      if (error) throw error;
      
      setActiveAccesses(data.active || []);
    } catch (error) {
      console.error('Error fetching active accesses:', error);
      toast.error('Error al cargar los accesos activos');
    } finally {
      setLoadingAccesses(false);
    }
  };

  const handleCreateAccess = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-shared-access', {
        body: {
          durationMinutes: parseInt(duration),
          permissions
        }
      });

      if (error) throw error;

      setGeneratedAccess(data);
      
      // Generar código QR
      const qr = await QRCodeLib.toDataURL(data.shareUrl, {
        width: 300,
        margin: 2,
      });
      setQrCode(qr);

      toast.success('Acceso compartido creado exitosamente');
      setActiveTab("view");
    } catch (error) {
      console.error('Error creating shared access:', error);
      toast.error('Error al crear el acceso compartido');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedAccess) {
      navigator.clipboard.writeText(generatedAccess.shareUrl);
      toast.success('Enlace copiado al portapapeles');
    }
  };

  const handleRevokeAccess = async (tokenId: string) => {
    try {
      const { error } = await supabase.functions.invoke('revoke-shared-access', {
        body: { tokenId }
      });

      if (error) throw error;

      toast.success('Acceso revocado exitosamente');
      fetchActiveAccesses();
    } catch (error) {
      console.error('Error revoking access:', error);
      toast.error('Error al revocar el acceso');
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Compartir Mi Historial Clínico
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Crear Acceso</TabsTrigger>
            <TabsTrigger value="view">Acceso Generado</TabsTrigger>
            <TabsTrigger value="manage">Gestionar Accesos</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Crea un acceso temporal y seguro a tu historial clínico. El receptor no necesita registrarse.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Duración del Acceso</Label>
                <RadioGroup value={duration} onValueChange={setDuration}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="5" id="5min" />
                    <Label htmlFor="5min" className="cursor-pointer">5 minutos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="15" id="15min" />
                    <Label htmlFor="15min" className="cursor-pointer">15 minutos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="30" id="30min" />
                    <Label htmlFor="30min" className="cursor-pointer">30 minutos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="60" id="1hour" />
                    <Label htmlFor="1hour" className="cursor-pointer">1 hora</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="180" id="3hours" />
                    <Label htmlFor="3hours" className="cursor-pointer">3 horas</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div>
                <Label className="text-base font-semibold mb-3 block">Permisos de Acceso</Label>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="view"
                      checked={true}
                      disabled
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="view" className="cursor-not-allowed opacity-60">
                        Ver Historial Clínico y Datos
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Requerido - No se puede desmarcar
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="download"
                      checked={permissions.allow_download}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, allow_download: checked as boolean })
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="download" className="cursor-pointer">
                        Permitir Descarga de Documentos
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        El invitado podrá descargar documentos clínicos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="chat"
                      checked={permissions.allow_chat}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, allow_chat: checked as boolean })
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="chat" className="cursor-pointer">
                        Permitir Interacción con Asistente IA
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        El invitado podrá hacer preguntas al asistente
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="notebook"
                      checked={permissions.allow_notebook}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, allow_notebook: checked as boolean })
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="notebook" className="cursor-pointer">
                        Permitir Acceso a Bitácora
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        El invitado podrá ver análisis y gráficas clínicas
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateAccess}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'Generando...' : 'Generar Acceso Seguro'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="view" className="space-y-4 mt-4">
            {generatedAccess ? (
              <div className="space-y-4">
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Este acceso expirará en {duration} minutos. Puedes revocarlo manualmente desde "Gestionar Accesos".
                  </AlertDescription>
                </Alert>

                <Card className="p-6 space-y-4">
                  <div className="text-center">
                    <h3 className="font-semibold text-lg mb-4">Código QR para Escanear</h3>
                    {qrCode && (
                      <img src={qrCode} alt="QR Code" className="mx-auto border-2 border-border rounded-lg" />
                    )}
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Enlace Seguro</Label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedAccess.shareUrl}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm border border-input bg-background rounded-md"
                      />
                      <Button onClick={handleCopyLink} size="icon">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Expira:</Label>
                      <p className="font-medium">
                        {new Date(generatedAccess.expires_at).toLocaleString('es-CO')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Permisos:</Label>
                      <div className="space-y-1">
                        {generatedAccess.permissions.allow_download && (
                          <p className="text-xs">✓ Descarga</p>
                        )}
                        {generatedAccess.permissions.allow_chat && (
                          <p className="text-xs">✓ Asistente IA</p>
                        )}
                        {generatedAccess.permissions.allow_notebook && (
                          <p className="text-xs">✓ Bitácora</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay acceso generado. Crea uno desde la pestaña "Crear Acceso".
              </div>
            )}
          </TabsContent>

          <TabsContent value="manage" className="space-y-4 mt-4">
            {loadingAccesses ? (
              <div className="text-center py-8">Cargando...</div>
            ) : activeAccesses.length > 0 ? (
              <div className="space-y-3">
                {activeAccesses.map((access) => (
                  <Card key={access.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Expira en: {formatTimeRemaining(access.timeRemaining)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Creado: {new Date(access.created_at).toLocaleString('es-CO')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Accesos: {access.access_count}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRevokeAccess(access.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No tienes accesos activos
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
