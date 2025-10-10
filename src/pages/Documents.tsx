import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Image, Search, Filter, Download, Trash2, Eye, ArrowLeft, Calendar, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SecureUploadModal } from "@/components/SecureUploadModal";
import { Header } from "@/components/Header";

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

export default function Documents() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<ClinicalDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<ClinicalDocument | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user]);

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

    // Filtrar por tipo
    if (filterType !== "all") {
      filtered = filtered.filter(doc => 
        doc.document_type?.toLowerCase().includes(filterType.toLowerCase())
      );
    }

    // Filtrar por búsqueda
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
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const getDocumentTypeIcon = (type: string | null) => {
    if (!type) return <File className="w-5 h-5" />;
    
    if (type.toLowerCase().includes('identidad')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (type.toLowerCase().includes('imagen') || type.toLowerCase().includes('imagen')) {
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

  if (loading || loadingDocs) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <Header />
      
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Header con acciones */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Mis Documentos Clínicos</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <Button 
              onClick={() => setShowUploadModal(true)}
              className="gap-2 bg-primary hover:bg-primary-dark"
              size="lg"
            >
              <Upload className="w-4 h-4" />
              Subir Documentos
            </Button>
          </div>

          {/* Filtros y búsqueda */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos..."
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
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all">Todos los tipos</SelectItem>
                {getDocumentTypes().map(type => (
                  <SelectItem key={type} value={type || 'sin-tipo'}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid de documentos */}
        {filteredDocuments.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      </div>

      {/* Modal de subida */}
      <SecureUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onSuccess={() => {
          loadDocuments();
          setShowUploadModal(false);
          toast.success('Documento cargado exitosamente');
        }}
      />

      {/* Visor de documentos */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.file_name}</DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="flex-1 overflow-auto">
              {selectedDoc.file_type?.includes('image') ? (
                <img 
                  src={selectedDoc.file_url}
                  alt={selectedDoc.file_name}
                  className="w-full h-auto"
                />
              ) : selectedDoc.file_type?.includes('pdf') ? (
                <iframe
                  src={selectedDoc.file_url}
                  className="w-full h-full min-h-[600px]"
                  title={selectedDoc.file_name}
                />
              ) : (
                <div className="p-8 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Vista previa no disponible para este tipo de archivo
                  </p>
                  <Button 
                    onClick={() => handleDownloadDocument(selectedDoc)}
                    className="mt-4 gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descargar documento
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
