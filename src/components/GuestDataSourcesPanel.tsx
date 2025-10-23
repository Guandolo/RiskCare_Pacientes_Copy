import { Download, FileText, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

interface GuestDataSourcesPanelProps {
  patient?: PatientData;
  documents?: Document[];
  permissions?: {
    allow_download: boolean;
    allow_chat: boolean;
  };
  onDownloadDocument?: (documentId: string, fileName: string) => Promise<void>;
}

export const GuestDataSourcesPanel = ({ 
  patient, 
  documents,
  permissions,
  onDownloadDocument 
}: GuestDataSourcesPanelProps) => {
  const [patientInfoOpen, setPatientInfoOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(true);

  const getTopusValue = (path: string) => {
    if (!patient?.topus_data) return null;
    const keys = path.split('.');
    let value = patient.topus_data;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO');
  };

  const handleDownload = async (docId: string, fileName: string) => {
    if (!permissions?.allow_download) {
      toast.error('No tienes permiso para descargar documentos');
      return;
    }
    
    if (onDownloadDocument) {
      await onDownloadDocument(docId, fileName);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 border-b border-border bg-background shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold">Mis Documentos Clínicos</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Fuentes de datos consolidadas</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Información del Paciente */}
          <Collapsible open={patientInfoOpen} onOpenChange={setPatientInfoOpen}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Información del Paciente</h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${patientInfoOpen ? '' : '-rotate-90'}`} />
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <Separator />
                <div className="p-4 space-y-4">
                  {/* Datos Personales */}
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Nombre Completo</p>
                      <p className="font-medium">{patient?.full_name || getTopusValue('nombres_apellidos') || 'No especificado'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Documento</p>
                        <p className="font-medium text-xs">{patient?.document_type || 'CC'}</p>
                        <p className="font-medium">{patient?.identification}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Edad</p>
                        <p className="font-medium">{patient?.age ? `${patient.age} años` : 'N/A'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">EPS</p>
                        <p className="font-medium text-xs">{patient?.eps || getTopusValue('nombre_eps') || 'N/A'}</p>
                      </div>
                      {patient?.phone && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Teléfono</p>
                          <p className="font-medium text-xs">{patient.phone}</p>
                        </div>
                      )}
                    </div>

                    {/* Datos adicionales de Topus si existen */}
                    {getTopusValue('sexo') && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Sexo</p>
                        <p className="font-medium text-xs">{getTopusValue('sexo')}</p>
                      </div>
                    )}

                    {getTopusValue('direccion') && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Dirección</p>
                        <p className="font-medium text-xs">{getTopusValue('direccion')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Mis Documentos Cargados */}
          <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Mis Documentos Cargados</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{documents?.length || 0} documentos</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${documentsOpen ? '' : '-rotate-90'}`} />
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <Separator />
                <div className="p-4">
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
                                    {formatDate(doc.document_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {permissions?.allow_download && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0"
                                onClick={() => handleDownload(doc.id, doc.file_name)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No hay documentos disponibles
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
};
