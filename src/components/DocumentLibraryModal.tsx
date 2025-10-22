import { useState, useEffect } from "react";
import { Upload, FileText, Image, Search, Filter, Download, Trash2, Eye, Calendar, File, X, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { QuickUploadModal } from "./QuickUploadModal";
import { useActivePatient } from "@/hooks/useActivePatient";
import { useUserRole } from "@/hooks/useUserRole";

interface ClinicalDocument {
  id: string;
  file_name: string;
  document_type: string | null;
  document_date: string | null;
  created_at: string;
  file_url: string;
  file_type: string;
  extracted_text: string | null;
  structured_data: any;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string | null;
}

interface DocumentLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DocumentLibraryModal = ({ open, onOpenChange }: DocumentLibraryModalProps) => {
  const { isProfesional } = useUserRole();
  const { activePatient } = useActivePatient();
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<ClinicalDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<ClinicalDocument | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadDocuments();
      
      // Auto-refresco cada 5 segundos cuando el modal está abierto
      const interval = setInterval(() => {
        loadDocuments();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [open, isProfesional, activePatient?.user_id]); // Recargar cuando cambie el paciente activo

  useEffect(() => {
    filterDocuments();
  }, [documents, searchQuery, filterType]);

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[DocumentLibraryModal] No hay usuario autenticado');
        setLoadingDocs(false);
        return;
      }

      // CRÍTICO: Determinar de qué usuario cargar documentos
      const targetUserId = isProfesional && activePatient 
        ? activePatient.user_id 
        : user.id;
      
      // Si es profesional sin paciente activo, no cargar
      if (isProfesional && !activePatient) {
        console.log('[DocumentLibraryModal] Profesional sin paciente activo');
        setDocuments([]);
        setLoadingDocs(false);
        return;
      }

      console.log('[DocumentLibraryModal] Cargando documentos para:', targetUserId, 
        isProfesional ? `(Paciente: ${activePatient?.full_name})` : '(Usuario propio)');

      const { data, error } = await supabase
        .from('clinical_documents')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DocumentLibraryModal] Error cargando documentos:', error);
        throw error;
      }
      
      console.log('[DocumentLibraryModal] Documentos cargados:', data?.length || 0);
      
      // Procesar URLs públicas para cada documento
      const documentsWithUrls = (data || []).map(doc => {
        let publicUrl = doc.file_url;
        if (!publicUrl || !/^https?:\/\//.test(publicUrl)) {
          const { data: urlData } = supabase.storage
            .from('clinical-documents')
            .getPublicUrl(doc.file_url);
          publicUrl = urlData.publicUrl;
        }
        return { ...doc, file_url: publicUrl };
      }) as ClinicalDocument[];
      
      setDocuments(documentsWithUrls);
    } catch (error) {
      console.error('[DocumentLibraryModal] Error loading documents:', error);
      toast.error('Error cargando documentos');
    } finally {
      setLoadingDocs(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (filterType !== "all") {
      filtered = filtered.filter(doc => 
        doc.document_type?.toLowerCase().includes(filterType.toLowerCase())
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.document_type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredDocuments(filtered);
  };

  const handleViewDocument = async (doc: ClinicalDocument) => {
    try {
      let publicUrl = doc.file_url;
      if (!publicUrl || !/^https?:\/\//.test(publicUrl)) {
        const { data } = supabase.storage
          .from('clinical-documents')
          .getPublicUrl(doc.file_url);
        publicUrl = data.publicUrl;
      }

      setSelectedDoc({ ...doc, file_url: publicUrl });
      setViewerOpen(true);
      // NO cerramos el modal de biblioteca aquí
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Error al visualizar documento');
    }
  };

  const handleDownloadDocument = async (doc: ClinicalDocument) => {
    try {
      let publicUrl = doc.file_url;
      if (!publicUrl || !/^https?:\/\//.test(publicUrl)) {
        const { data } = supabase.storage
          .from('clinical-documents')
          .getPublicUrl(doc.file_url);
        publicUrl = data.publicUrl;
      }

      const response = await fetch(publicUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'documento';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Documento descargado');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Error al descargar documento');
    }
  };

  const handleDeleteDocument = async (docId: string, fileName: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: dbError } = await supabase
        .from('clinical_documents')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      const filePath = fileName.includes('/') ? fileName : `${user.id}/${fileName}`;
      const { error: storageError } = await supabase.storage
        .from('clinical-documents')
        .remove([filePath]);

      if (storageError) console.error('Error deleting from storage:', storageError);

      toast.success('Documento eliminado');
      loadDocuments();
      window.dispatchEvent(new CustomEvent('documentsUpdated'));
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const getDocumentTypeIcon = (type: string | null) => {
    if (!type) return <File className="w-5 h-5" />;
    
    if (type.toLowerCase().includes('laboratorio')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (type.toLowerCase().includes('imagen')) {
      return <Image className="w-5 h-5 text-green-500" />;
    }
    return <FileText className="w-5 h-5 text-purple-500" />;
  };

  const getProcessingStatusBadge = (status?: 'pending' | 'processing' | 'completed' | 'failed') => {
    if (!status || status === 'completed') return null;

    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="text-xs gap-1">
            <Clock className="w-3 h-3" />
            En cola
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default" className="text-xs gap-1 bg-blue-500 hover:bg-blue-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Procesando...
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertCircle className="w-3 h-3" />
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  const getProcessingStatusMessage = (status?: 'pending' | 'processing' | 'completed' | 'failed', doc?: ClinicalDocument) => {
    if (!status || status === 'completed') {
      // Si está completado y tiene datos extraídos, mostrar resumen
      if (doc?.extracted_text) {
        const preview = doc.extracted_text.substring(0, 150);
        return (
          <div className="mt-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-3 h-3" />
              <span className="font-medium">Documento procesado</span>
            </div>
            <p className="text-muted-foreground line-clamp-2">{preview}...</p>
          </div>
        );
      }
      return null;
    }

    switch (status) {
      case 'pending':
        return (
          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3" />
              <span className="font-medium">En cola para procesamiento</span>
            </div>
            El sistema extraerá automáticamente la información. Esto puede tardar 1-2 minutos. La biblioteca se actualiza cada 5 segundos.
          </div>
        );
      case 'processing':
        return (
          <div className="mt-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="font-medium">Extrayendo información del documento...</span>
            </div>
            <div className="space-y-1 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                <span>Análisis con IA en progreso</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                <span>Extracción de datos clínicos</span>
              </div>
            </div>
            <p className="mt-2 text-muted-foreground">Tiempo estimado: 30s - 2min</p>
          </div>
        );
      case 'failed':
        return (
          <div className="mt-2 text-xs text-destructive bg-destructive/10 rounded p-2 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-3 h-3" />
              <span className="font-medium">Error en el procesamiento</span>
            </div>
            No se pudo extraer la información. Intenta volver a cargar el documento.
          </div>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDocumentTypes = () => {
    const types = new Set(documents.map(d => d.document_type).filter(Boolean));
    return Array.from(types);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-2xl font-bold">Mis Documentos Clínicos</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
            </p>
          </DialogHeader>

          {/* Barra de búsqueda y filtros - SIN padding top extra */}
          <div className="px-6 pt-4 pb-3 border-b border-border bg-muted/20">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex-1 min-w-[250px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documentos por nombre o tipo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent className="z-[60] bg-popover">
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {getDocumentTypes().map(type => (
                    <SelectItem key={type} value={type || 'sin-tipo'}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={() => setShowUploadModal(true)}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Upload className="w-4 h-4" />
                Subir Documento
              </Button>
            </div>
          </div>

          {/* Lista de documentos */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-6 py-4">
              {loadingDocs ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando documentos...</p>
                  </div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <Card className="p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No hay documentos</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || filterType !== "all" 
                      ? "No se encontraron documentos con los filtros aplicados" 
                      : "Comienza subiendo tu primer documento clínico"}
                  </p>
                  {!searchQuery && filterType === "all" && (
                    <Button onClick={() => setShowUploadModal(true)} className="gap-2">
                      <Upload className="w-4 h-4" />
                      Subir Documento
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocuments.map((doc) => (
                    <Card
                      key={doc.id} 
                      className="group hover:shadow-lg transition-all cursor-pointer overflow-hidden border-2 hover:border-primary/50"
                    >
                      <div 
                        className="p-4"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {getDocumentTypeIcon(doc.document_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate mb-1 flex items-center gap-2">
                              {doc.file_name}
                              {getProcessingStatusBadge(doc.processing_status)}
                            </h3>
                            {doc.document_type && (
                              <Badge variant="secondary" className="text-xs">
                                {doc.document_type}
                              </Badge>
                            )}
                            {doc.processing_error && (
                              <p className="text-xs text-destructive mt-1 truncate" title={doc.processing_error}>
                                {doc.processing_error}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(doc.document_date || doc.created_at)}</span>
                        </div>

                        {getProcessingStatusMessage(doc.processing_status, doc)}

                        {doc.file_type?.includes('image') && doc.file_url && (
                          <div className="aspect-video bg-muted rounded-md mb-3 overflow-hidden">
                            <img 
                              src={doc.file_url}
                              alt={doc.file_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-border p-2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDocument(doc);
                          }}
                        >
                          <Eye className="w-3 h-3" />
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadDocument(doc);
                          }}
                        >
                          <Download className="w-3 h-3" />
                          Descargar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id, doc.file_url);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de subida - Quick Upload*/}
      <QuickUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onSuccess={() => {
          loadDocuments();
          setShowUploadModal(false);
          toast.success('Documentos cargados exitosamente');
          window.dispatchEvent(new CustomEvent('documentsUpdated'));
        }}
      />

      {/* Visor de documentos */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-3 border-b border-border">
            <DialogTitle className="text-lg font-bold">{selectedDoc?.file_name}</DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-4">
                {/* Previsualización del archivo */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Vista Previa
                  </h4>
                  {selectedDoc.file_type?.includes('image') ? (
                    <div className="bg-background rounded-lg overflow-hidden border border-border">
                      <img 
                        src={selectedDoc.file_url}
                        alt={selectedDoc.file_name}
                        className="w-full h-auto"
                      />
                    </div>
                  ) : selectedDoc.file_type?.includes('pdf') ? (
                    <iframe
                      src={selectedDoc.file_url}
                      className="w-full h-[500px] rounded-lg border border-border bg-background"
                      title={selectedDoc.file_name}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">Previsualización no disponible</p>
                  )}
                </div>

                {/* Información Detectada */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Información Detectada
                  </h4>
                  <div className="space-y-3 text-sm bg-background rounded-lg p-4 border border-border">
                    {selectedDoc.document_type && (
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground font-medium">Tipo de documento:</span>
                        <Badge variant="secondary" className="ml-2">{selectedDoc.document_type}</Badge>
                      </div>
                    )}
                    {selectedDoc.document_date && (
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground font-medium">Fecha:</span>
                        <span className="font-medium">{formatDate(selectedDoc.document_date)}</span>
                      </div>
                    )}
                    {selectedDoc.structured_data && Object.keys(selectedDoc.structured_data).length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-muted-foreground font-medium block mb-2">Datos estructurados:</span>
                        <ScrollArea className="h-[150px] rounded border border-border">
                          <pre className="bg-muted/50 p-3 text-xs font-mono">
                            {JSON.stringify(selectedDoc.structured_data, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>

                {/* Texto extraído */}
                {selectedDoc.extracted_text && (
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Texto Extraído
                    </h4>
                    <ScrollArea className="h-[200px] rounded border border-border bg-background">
                      <p className="text-xs text-foreground whitespace-pre-wrap p-4 font-mono">
                        {selectedDoc.extracted_text}
                      </p>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
