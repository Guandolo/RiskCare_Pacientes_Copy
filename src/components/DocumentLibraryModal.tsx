import { useState, useEffect } from "react";
import { Upload, FileText, Image, Search, Filter, Download, Trash2, Eye, Calendar, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SecureUploadModal } from "./SecureUploadModal";

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
}

interface DocumentLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DocumentLibraryModal = ({ open, onOpenChange }: DocumentLibraryModalProps) => {
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
    }
  }, [open]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchQuery, filterType]);

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clinical_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
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
      onOpenChange(false); // Cerrar el modal de biblioteca
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
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <DialogHeader className="p-6 pb-4 border-b border-border">
            <DialogTitle className="text-2xl font-bold">Mis Documentos Clínicos</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
            </p>
          </DialogHeader>

          <div className="p-6 pt-4 flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Barra de búsqueda y filtros */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[300px] relative">
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
                  <SelectValue placeholder="Filtrar por tipo" />
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

            {/* Lista de documentos */}
            <ScrollArea className="flex-1 -mx-6 px-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
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
                            <h3 className="font-semibold text-sm truncate mb-1">
                              {doc.file_name}
                            </h3>
                            {doc.document_type && (
                              <Badge variant="secondary" className="text-xs">
                                {doc.document_type}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(doc.document_date || doc.created_at)}</span>
                        </div>

                        {doc.file_type?.includes('image') && doc.file_url && (
                          <div className="aspect-video bg-muted rounded-md mb-3 overflow-hidden">
                            <img 
                              src={doc.file_url.startsWith('http') ? doc.file_url : supabase.storage.from('clinical-documents').getPublicUrl(doc.file_url).data.publicUrl}
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

      {/* Modal de subida */}
      <SecureUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onSuccess={() => {
          loadDocuments();
          setShowUploadModal(false);
          toast.success('Documento cargado exitosamente');
          window.dispatchEvent(new CustomEvent('documentsUpdated'));
        }}
      />

      {/* Visor de documentos */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.file_name}</DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="flex-1 overflow-auto space-y-4">
              {/* Previsualización del archivo */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">Vista Previa</h4>
                {selectedDoc.file_type?.includes('image') ? (
                  <img 
                    src={selectedDoc.file_url}
                    alt={selectedDoc.file_name}
                    className="w-full rounded border"
                  />
                ) : selectedDoc.file_type?.includes('pdf') ? (
                  <iframe
                    src={selectedDoc.file_url}
                    className="w-full h-[400px] rounded border"
                    title={selectedDoc.file_name}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Previsualización no disponible</p>
                )}
              </div>

              {/* Información Detectada */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">Información Detectada</h4>
                <div className="space-y-3 text-sm">
                  {selectedDoc.document_type && (
                    <div>
                      <span className="text-muted-foreground">Tipo de documento: </span>
                      <span className="font-medium">{selectedDoc.document_type}</span>
                    </div>
                  )}
                  {selectedDoc.document_date && (
                    <div>
                      <span className="text-muted-foreground">Fecha: </span>
                      <span className="font-medium">{formatDate(selectedDoc.document_date)}</span>
                    </div>
                  )}
                  {selectedDoc.structured_data && Object.keys(selectedDoc.structured_data).length > 0 && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Datos estructurados:</span>
                      <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(selectedDoc.structured_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Texto extraído */}
              {selectedDoc.extracted_text && (
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Texto Extraído</h4>
                  <ScrollArea className="h-[200px]">
                    <p className="text-xs text-foreground whitespace-pre-wrap">
                      {selectedDoc.extracted_text}
                    </p>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
