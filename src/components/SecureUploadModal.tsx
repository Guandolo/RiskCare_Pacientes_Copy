import { useState, useRef } from "react";
import { Upload, AlertTriangle, CheckCircle, HelpCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SecureUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type VerificationStatus = 'idle' | 'processing' | 'verified' | 'rejected' | 'unverifiable';

export const SecureUploadModal = ({ open, onOpenChange, onSuccess }: SecureUploadModalProps) => {
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tempFileUrl, setTempFileUrl] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de archivo no permitido. Por favor sube PDF, JPG o PNG.');
      return;
    }

    // Validar tamaño (máximo 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande. Tamaño máximo: 20MB.');
      return;
    }

    setSelectedFile(file);
    await processFile(file);
  };

  const processFile = async (file: File) => {
    try {
      setStatus('processing');
      setUploadProgress(10);

      // 1. Obtener sesión del usuario
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Debes iniciar sesión para cargar documentos.');
        resetModal();
        return;
      }

      setUploadProgress(20);

      // 2. Subir archivo temporalmente a Supabase Storage
      const fileName = `${session.user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('clinical-documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Error al subir el archivo');
        resetModal();
        return;
      }

      setUploadProgress(40);

      // 3. Obtener URL pública del archivo
      const { data: { publicUrl } } = supabase.storage
        .from('clinical-documents')
        .getPublicUrl(fileName);

      setTempFileUrl(fileName);
      setUploadProgress(60);

      // 4. Llamar a la función de procesamiento con verificación de identidad
      const { data, error } = await supabase.functions.invoke('process-document', {
        body: {
          fileName: file.name,
          fileType: file.type,
          fileUrl: publicUrl,
          verifyIdentity: true,
          forceUpload: false
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      setUploadProgress(100);

      if (error) {
        console.error('Processing error:', error);
        await cleanupTempFile(fileName);
        toast.error('Error al procesar el documento');
        resetModal();
        return;
      }

      // 5. Manejar respuesta según el estado de verificación
      if (data.status === 'rejected') {
        setStatus('rejected');
        setRejectionReason(data.message || 'Este documento parece pertenecer a otra persona.');
        await cleanupTempFile(fileName);
      } else if (data.status === 'unverifiable') {
        setStatus('unverifiable');
      } else if (data.status === 'verified' || data.success) {
        setStatus('verified');
        setTimeout(() => {
          onSuccess();
          resetModal();
          onOpenChange(false);
        }, 2000);
      }

    } catch (error) {
      console.error('Error en procesamiento:', error);
      if (tempFileUrl) await cleanupTempFile(tempFileUrl);
      toast.error('Error al procesar el documento');
      resetModal();
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !tempFileUrl) return;

    try {
      setStatus('processing');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: { publicUrl } } = supabase.storage
        .from('clinical-documents')
        .getPublicUrl(tempFileUrl);

      const { data, error } = await supabase.functions.invoke('process-document', {
        body: {
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileUrl: publicUrl,
          verifyIdentity: false,
          forceUpload: true
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;

      setStatus('verified');
      setTimeout(() => {
        onSuccess();
        resetModal();
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      console.error('Error al confirmar carga:', error);
      toast.error('Error al cargar el documento');
      resetModal();
    }
  };

  const handleCancelUpload = async () => {
    if (tempFileUrl) {
      await cleanupTempFile(tempFileUrl);
    }
    resetModal();
  };

  const cleanupTempFile = async (filePath: string) => {
    try {
      await supabase.storage
        .from('clinical-documents')
        .remove([filePath]);
    } catch (error) {
      console.error('Error al limpiar archivo temporal:', error);
    }
  };

  const resetModal = () => {
    setStatus('idle');
    setSelectedFile(null);
    setUploadProgress(0);
    setTempFileUrl(null);
    setRejectionReason('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (tempFileUrl && status !== 'verified') {
      cleanupTempFile(tempFileUrl);
    }
    resetModal();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Carga Segura de Documentos</DialogTitle>
          <DialogDescription>
            Verificaremos que el documento te pertenezca antes de agregarlo a tu historial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'idle' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary/50 transition-colors">
                <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-4">
                  Selecciona un archivo PDF, JPG o PNG (máx. 20MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  Seleccionar Archivo
                </Button>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <p className="text-sm">Procesando y verificando documento...</p>
              </div>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-xs text-muted-foreground">
                {selectedFile?.name}
              </p>
            </div>
          )}

          {status === 'verified' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    ✅ ¡Documento verificado!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Hemos confirmado que este archivo te pertenece. La carga se ha completado.
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === 'rejected' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    ⚠️ Alerta de Seguridad
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {rejectionReason || 'Hemos detectado que este documento podría no pertenecerte. Para proteger tu privacidad y la de otros, la carga ha sido cancelada.'}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Por favor, asegúrate de subir solo tus propios documentos.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleClose}>
                  Entendido
                </Button>
              </div>
            </div>
          )}

          {status === 'unverifiable' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <HelpCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">
                    🤔 Confirmación Requerida
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    No pudimos identificar tu nombre en este documento. ¿Confirmas que este archivo es tuyo y deseas cargarlo a tu historial clínico?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelUpload}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmUpload}>
                  Sí, confirmar y cargar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
