import { useState, useRef } from "react";
import { Upload, X, FileText, Image as ImageIcon, File, Check, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface QuickUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
}

export const QuickUploadModal = ({ open, onOpenChange, onSuccess }: QuickUploadModalProps) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;

    // Validar archivos
    const validFiles = selectedFiles.filter(file => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      const maxSize = 20 * 1024 * 1024; // 20MB

      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Tipo no permitido. Solo PDF, JPG o PNG.`);
        return false;
      }

      if (file.size > maxSize) {
        toast.error(`${file.name}: Archivo muy grande. Máximo 20MB.`);
        return false;
      }

      return true;
    });

    // Agregar archivos válidos a la lista
    const newFiles: UploadFile[] = validFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Limpiar input para permitir seleccionar los mismos archivos nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('Por favor selecciona al menos un archivo');
      return;
    }

    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Debes iniciar sesión para cargar documentos');
        return;
      }

      const userId = session.user.id;

      // Subir todos los archivos en paralelo
      const uploadPromises = files.map(async (uploadFile) => {
        try {
          // Actualizar estado a uploading
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
          ));

          // Generar nombre único
          const timestamp = Date.now();
          const fileName = `${userId}/${timestamp}-${uploadFile.file.name}`;

          // Subir archivo a storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('clinical-documents')
            .upload(fileName, uploadFile.file);

          if (uploadError) throw uploadError;

          // Obtener URL pública
          const { data: { publicUrl } } = supabase.storage
            .from('clinical-documents')
            .getPublicUrl(fileName);

          // Crear registro en la base de datos con estado 'pending'
          const { data: insertedDoc, error: dbError } = await supabase
            .from('clinical_documents')
            .insert({
              user_id: userId,
              file_name: uploadFile.file.name,
              file_type: uploadFile.file.type,
              file_url: fileName, // Guardar path, no URL completa
              document_type: 'Documento cargado',
              processing_status: 'pending' // Estado inicial: pendiente de procesamiento
            })
            .select()
            .single();

          if (dbError) throw dbError;

          // Disparar procesamiento en segundo plano
          console.log('Iniciando procesamiento para:', uploadFile.file.name);
          
          // Actualizar estado a 'processing'
          await supabase
            .from('clinical_documents')
            .update({ processing_status: 'processing' })
            .eq('id', insertedDoc.id);

          // Invocar función de procesamiento (sin esperar)
          supabase.functions
            .invoke('process-document', {
              body: {
                fileUrl: publicUrl,
                fileName: uploadFile.file.name,
                fileType: uploadFile.file.type,
                userId: userId,
                verifyIdentity: false,
                forceUpload: true
              }
            })
            .then(async (response) => {
              if (response.error) {
                console.error('Error procesando documento:', response.error);
                // Marcar como fallido
                await supabase
                  .from('clinical_documents')
                  .update({ 
                    processing_status: 'failed',
                    processing_error: response.error.message 
                  })
                  .eq('id', insertedDoc.id);
              } else {
                console.log('Documento procesado exitosamente:', response.data);
                // El edge function ya actualiza el documento, pero por si acaso
                await supabase
                  .from('clinical_documents')
                  .update({ processing_status: 'completed' })
                  .eq('id', insertedDoc.id);
              }
            })
            .catch(async (error) => {
              console.error('Error invocando process-document:', error);
              await supabase
                .from('clinical_documents')
                .update({ 
                  processing_status: 'failed',
                  processing_error: error.message 
                })
                .eq('id', insertedDoc.id);
            });

          // Actualizar estado a uploaded
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'uploaded' as const, progress: 100 } : f
          ));

          return { success: true, fileName: uploadFile.file.name };

        } catch (error: any) {
          console.error(`Error al subir ${uploadFile.file.name}:`, error);
          
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { 
              ...f, 
              status: 'error' as const, 
              error: error.message || 'Error al subir'
            } : f
          ));

          return { success: false, fileName: uploadFile.file.name, error };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        toast.success(`${successCount} documento${successCount !== 1 ? 's' : ''} cargado${successCount !== 1 ? 's' : ''} exitosamente.`, {
          description: 'La extracción de datos iniciará automáticamente. Puedes ver el progreso en la biblioteca de documentos.'
        });
        onSuccess();
        
        // Esperar un momento para que el usuario vea el estado y luego cerrar
        setTimeout(() => {
          setFiles([]);
          onOpenChange(false);
        }, 2000);
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} archivo${errorCount !== 1 ? 's' : ''} no se pudieron cargar`);
      }

    } catch (error: any) {
      console.error('Error general al subir archivos:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (fileType.includes('image')) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const getStatusBadge = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="text-xs">Pendiente</Badge>;
      case 'uploading':
        return <Badge variant="default" className="text-xs animate-pulse">Subiendo...</Badge>;
      case 'uploaded':
        return <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700"><Check className="w-3 h-3 mr-1" />Cargado</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      onOpenChange(false);
    }
  };

  const totalFiles = files.length;
  const uploadedFiles = files.filter(f => f.status === 'uploaded').length;
  const overallProgress = totalFiles > 0 ? (uploadedFiles / totalFiles) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => {
          if (isUploading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isUploading) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Carga Rápida de Documentos</DialogTitle>
          <DialogDescription>
            Sube uno o varios documentos. Se procesarán automáticamente en segundo plano.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Área de selección */}
          {!isUploading && (
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Arrastra archivos aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                PDF, JPG o PNG (máx. 20MB cada uno)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                id="quick-file-upload"
                multiple
              />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                Seleccionar Archivos
              </Button>
            </div>
          )}

          {/* Lista de archivos */}
          {files.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Archivos seleccionados: {totalFiles}
                </p>
                {isUploading && (
                  <p className="text-xs text-muted-foreground">
                    {uploadedFiles} de {totalFiles} completados
                  </p>
                )}
              </div>

              {isUploading && (
                <Progress value={overallProgress} className="w-full" />
              )}

              <ScrollArea className="flex-1 max-h-[300px]">
                <div className="space-y-2">
                  {files.map((uploadFile) => (
                    <div
                      key={uploadFile.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-shrink-0">
                        {getFileIcon(uploadFile.file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {uploadFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {uploadFile.error && (
                          <p className="text-xs text-destructive mt-1">
                            {uploadFile.error}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(uploadFile.status)}
                      </div>
                      {!isUploading && uploadFile.status !== 'uploaded' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                          className="flex-shrink-0 h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Botones de acción */}
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isUploading}
            >
              {uploadedFiles === totalFiles && totalFiles > 0 ? 'Cerrar' : 'Cancelar'}
            </Button>
            {files.length > 0 && uploadedFiles < totalFiles && (
              <Button 
                onClick={uploadFiles}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Subir {files.length} archivo{files.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};