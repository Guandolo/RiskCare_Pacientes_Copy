import { Upload, FileText, Calendar, Heart, Edit2, ChevronDown, ChevronUp, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PatientProfile {
  full_name: string | null;
  identification: string;
  document_type: string;
  age: number | null;
  eps: string | null;
  phone: string | null;
  topus_data: any;
}

interface ClinicalDocument {
  id: string;
  file_name: string;
  document_type: string | null;
  document_date: string | null;
  created_at: string;
}

export const DataSourcesPanel = () => {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadingHismart, setLoadingHismart] = useState(false);
  const [hismartData, setHismartData] = useState<any>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [patientInfoOpen, setPatientInfoOpen] = useState(false);
  const [hismartLastFetch, setHismartLastFetch] = useState<string | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [selectedDocPreview, setSelectedDocPreview] = useState<any | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfileAndData();

    // Listener para recargar perfil cuando se cree por primera vez
    const handleProfileUpdate = () => {
      loadProfile();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const loadProfileAndData = async () => {
    await loadProfile();
    await loadDocuments();
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setPhoneValue(data.phone || "");
      
      // Cargar datos de HiSmart guardados si existen
      if (data.topus_data && typeof data.topus_data === 'object') {
        const topusData = data.topus_data as any;
        if (topusData.hismart_data) {
          setHismartData(topusData.hismart_data);
          setHismartLastFetch(topusData.hismart_last_fetch || null);
        }
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      toast.error('Error cargando información del paciente');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clinical_documents')
        .select('id, file_name, document_type, document_date, created_at, file_url, file_type, extracted_text, structured_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setDocuments(data || []);
    } catch (error) {
      console.error('Error cargando documentos:', error);
    }
  };

  const handleViewDocument = (doc: any) => {
    setSelectedDocPreview(doc);
    setPreviewDialogOpen(true);
  };

  const handlePhoneUpdate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('patient_profiles')
        .update({ phone: phoneValue })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Teléfono actualizado');
      setEditingPhone(false);
      loadProfile();
    } catch (error) {
      console.error('Error actualizando teléfono:', error);
      toast.error('Error actualizando teléfono');
    }
  };

  const handleFetchHismart = async () => {
    if (!profile) return;
    
    setLoadingHismart(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke('fetch-hismart-data', {
        body: {
          documentType: profile.document_type,
          identification: profile.identification
        }
      });

      if (error) throw error;

      console.log('Datos de HiSmart:', data);
      if (data.success && data.data?.result?.data) {
        const hismartInfo = data.data.result.data;
        setHismartData(hismartInfo);
        
        const fetchDate = new Date().toLocaleString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        setHismartLastFetch(fetchDate);
        
        // Guardar datos de HiSmart en la base de datos
        const { error: updateError } = await supabase
          .from('patient_profiles')
          .update({
            topus_data: {
              ...profile.topus_data,
              hismart_data: hismartInfo,
              hismart_last_fetch: fetchDate
            }
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error guardando datos de HiSmart:', updateError);
        }

        // Disparar evento para actualizar sugerencias
        window.dispatchEvent(new CustomEvent('documentsUpdated'));

        toast.success('Datos clínicos consultados exitosamente');
      } else {
        toast.error('No se encontraron datos clínicos');
      }
    } catch (error) {
      console.error('Error consultando HiSmart:', error);
      toast.error('Error consultando datos clínicos');
    } finally {
      setLoadingHismart(false);
    }
  };

  const handleDeleteDocument = async (docId: string, fileName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Eliminar de la base de datos
      const { error: dbError } = await supabase
        .from('clinical_documents')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      // Eliminar del storage
      const filePath = fileName.includes('/') ? fileName : `${user.id}/${fileName}`;
      const { error: storageError } = await supabase.storage
        .from('clinical-documents')
        .remove([filePath]);

      if (storageError) console.error('Error eliminando del storage:', storageError);

      toast.success('Documento eliminado');
      loadDocuments();
    } catch (error) {
      console.error('Error eliminando documento:', error);
      toast.error('Error eliminando documento');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        // Validar tamaño (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} es muy grande (máx 10MB)`);
          continue;
        }

        // Validar tipo
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
          toast.error(`${file.name} no es un tipo válido (PDF, JPG, PNG)`);
          continue;
        }

        // Subir a storage (crear bucket si no existe)
        const fileName = `${user.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('clinical-documents')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Error subiendo archivo:', uploadError);
          toast.error(`Error subiendo ${file.name}`);
          continue;
        }

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('clinical-documents')
          .getPublicUrl(fileName);

        // Procesar documento con Gemini
        toast.info(`Procesando ${file.name}...`);
        const { data: processData, error: processError } = await supabase.functions.invoke('process-document', {
          body: {
            fileUrl: publicUrl,
            fileName: file.name,
            fileType: file.type,
            userId: user.id,
            userIdentification: profile?.identification // Enviar documento para PDFs protegidos
          }
        });

        if (processError) {
          console.error('Error procesando documento:', processError);
          toast.error(`Error procesando ${file.name}`);
          continue;
        }

        toast.success(`${file.name} cargado exitosamente`);
      }

      // Recargar documentos
      await loadDocuments();
      
      // Disparar evento personalizado para actualizar sugerencias en ChatPanel
      window.dispatchEvent(new CustomEvent('documentsUpdated'));
      
    } catch (error) {
      console.error('Error en carga de archivos:', error);
      toast.error('Error cargando archivos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Extraer datos relevantes de topus_data
  const getTopusValue = (path: string) => {
    if (!profile?.topus_data) return null;
    const keys = path.split('.');
    let value = profile.topus_data;
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground mb-1">Mis Documentos Clínicos</h2>
        <p className="text-xs text-muted-foreground">Fuentes de datos consolidadas</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Patient Info Card - Colapsable */}
          <Collapsible open={patientInfoOpen} onOpenChange={setPatientInfoOpen}>
            <Card className="bg-gradient-card shadow-card border-primary/20">
              <CollapsibleTrigger className="w-full p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-sm">Información del Paciente</h3>
                    {profile && (
                      <p className="text-xs text-foreground font-medium mt-1">
                        {getTopusValue('result.nombre')} {getTopusValue('result.apellido')} - CC {profile.identification}
                      </p>
                    )}
                  </div>
                  {patientInfoOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-4 pb-4">
                {loading ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cargando...</span>
                    </div>
                  </div>
                ) : profile ? (
                  <div className="space-y-3 text-xs">
                    {/* Nombre completo */}
                    <div className="pb-2 border-b border-border/50">
                      <div className="text-base font-bold text-foreground">
                        {getTopusValue('result.nombre')} {getTopusValue('result.s_nombre')} {getTopusValue('result.apellido')} {getTopusValue('result.s_apellido')}
                      </div>
                      <div className="text-muted-foreground mt-1">
                        Cédula de Ciudadanía: {profile.identification}
                      </div>
                    </div>

                    {/* Fila 1: Estado y Sexo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-muted-foreground mb-1">Estado</div>
                        <div className="font-medium">{getTopusValue('result.estado') || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Sexo</div>
                        <div className="font-medium">{getTopusValue('result.sexo') || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Fila 2: Edad y Fecha de Nacimiento */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-muted-foreground mb-1">Edad</div>
                        <div className="font-medium">{getTopusValue('result.edad')} años</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Fecha de Nacimiento</div>
                        <div className="font-medium">{getTopusValue('result.fecha_nacimiento') || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Fila 3: Ubicación */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-muted-foreground mb-1">Ubicación</div>
                        <div className="font-medium">
                          {getTopusValue('result.municipio_id')}, {getTopusValue('result.departamento_id')}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Estado Afiliación</div>
                        <div className="font-medium text-[10px] leading-tight">
                          {getTopusValue('result.estado_afiliacion') || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Fila 4: EPS y Tipo Régimen */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-muted-foreground mb-1">EPS</div>
                        <div className="font-medium">{getTopusValue('result.eps') || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Tipo Régimen</div>
                        <div className="font-medium text-[10px] leading-tight">
                          {getTopusValue('result.eps_tipo') || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Fila 5: Código EPS y EPS Homologada */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-muted-foreground mb-1">Código EPS</div>
                        <div className="font-medium">{getTopusValue('result.eps_codigo') || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">EPS Homologada</div>
                        <div className="font-medium text-[10px] leading-tight">
                          {getTopusValue('result.eps_homologada') || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Fila 6: NIT Homologado y Teléfono */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-muted-foreground mb-1">NIT Homologado</div>
                        <div className="font-medium">{getTopusValue('result.nit_homologado') || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Teléfono</div>
                        {editingPhone ? (
                          <div className="flex gap-1">
                            <Input
                              value={phoneValue}
                              onChange={(e) => setPhoneValue(e.target.value)}
                              className="h-6 text-xs"
                              placeholder="Celular"
                            />
                            <Button size="sm" className="h-6 px-2" onClick={handlePhoneUpdate}>
                              ✓
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingPhone(false)}>
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <span className="font-medium">{profile.phone || 'Sin registrar'}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={() => setEditingPhone(true)}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Botón consultar HiSmart */}
          <div className="space-y-2">
            <Button 
              className="w-full gap-2 bg-secondary hover:bg-secondary/80 transition-all" 
              size="lg"
              onClick={handleFetchHismart}
              disabled={loadingHismart || !profile}
            >
              {loadingHismart ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {hismartLastFetch ? 'Actualizar Datos Clínicos' : 'Consultar Datos Clínicos en HC'}
                </>
              )}
            </Button>
            {hismartLastFetch && (
              <p className="text-xs text-muted-foreground text-center">
                Última consulta: {hismartLastFetch}
              </p>
            )}
          </div>

          {/* Datos de HiSmart */}
          {hismartData && (
            <div className="space-y-2">
              {/* Registros Clínicos */}
              {hismartData.clinical_records && hismartData.clinical_records.length > 0 && (
                <Collapsible defaultOpen={false}>
                  <Card>
                    <CollapsibleTrigger className="w-full p-3 flex justify-between items-center hover:bg-accent/5">
                      <h4 className="text-sm font-semibold text-foreground">Registros Clínicos ({hismartData.clinical_records.length})</h4>
                      <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-2">
                        {hismartData.clinical_records.map((record: any, idx: number) => (
                          <Card key={idx} className="p-3 bg-accent/5">
                            <div className="text-xs space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Fecha:</span>
                                <span className="font-medium">{record.registration_date || record.date_of_attention}</span>
                              </div>
                              {record.diagnoses && (
                                <div>
                                  <span className="text-muted-foreground">Diagnóstico:</span>
                                  <p className="font-medium mt-1">{record.diagnoses}</p>
                                </div>
                              )}
                              {record.id_company && (
                                <div>
                                  <span className="text-muted-foreground">ID Compañía:</span> {record.id_company}
                                </div>
                              )}
                              {record.details && record.details.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger className="text-primary text-xs hover:underline">
                                    Ver detalles ({record.details.length})
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-2 p-2 bg-background rounded">
                                    <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(record.details[0], null, 2)}
                                    </pre>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Registros de Prescripciones */}
              {hismartData.prescription_records && hismartData.prescription_records.length > 0 && (
                <Collapsible defaultOpen={false}>
                  <Card>
                    <CollapsibleTrigger className="w-full p-3 flex justify-between items-center hover:bg-accent/5">
                      <h4 className="text-sm font-semibold text-foreground">Prescripciones ({hismartData.prescription_records.length})</h4>
                      <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-2">
                        {hismartData.prescription_records.map((record: any, idx: number) => (
                          <Card key={idx} className="p-3 bg-accent/5">
                            <div className="text-xs space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Fecha:</span>
                                <span className="font-medium">{record.registration_date}</span>
                              </div>
                              {record.diagnoses && (
                                <div>
                                  <span className="text-muted-foreground">Diagnóstico:</span>
                                  <p className="font-medium mt-1">{record.diagnoses}</p>
                                </div>
                              )}
                              {record.details && record.details.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger className="text-primary text-xs hover:underline">
                                    Ver detalles médicos
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-2 p-2 bg-background rounded">
                                    <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(record.details[0], null, 2)}
                                    </pre>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
            </div>
          )}

          {/* Upload Section */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/jpeg,image/png"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              className="w-full gap-2 bg-primary hover:bg-primary-dark transition-all" 
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Subir Documentos
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              PDF, JPG, PNG - Máx 10MB
            </p>
          </div>

          {/* Documents List - Colapsable */}
          <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
            <Card>
              <CollapsibleTrigger className="w-full p-3 flex justify-between items-center hover:bg-accent/5">
                <h3 className="text-sm font-semibold text-foreground">
                  Historial Consolidado ({documents.length})
                </h3>
                {documentsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="p-3 space-y-2">
                  {documents.length > 0 ? (
                    <ScrollArea className="h-[250px] pr-3">
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <Card 
                            key={doc.id} 
                            className={`p-2.5 cursor-pointer transition-all hover:bg-accent/10 ${
                              selectedDocPreview?.id === doc.id ? 'bg-accent/10 border-primary/50' : 'bg-accent/5'
                            }`}
                            onClick={() => setSelectedDocPreview(doc)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-secondary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{doc.file_name}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground truncate">{doc.document_type || 'Documento'}</span>
                                  <span className="text-[10px] text-muted-foreground">•</span>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {formatDate(doc.document_date || doc.created_at)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDocument(doc.id, doc.file_name);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        No hay documentos cargados aún
                      </p>
                    </div>
                  )}

                  {/* Document Preview */}
                  {selectedDocPreview && (
                    <Card className="p-3 bg-primary/5 border-primary/20">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-semibold text-foreground">Vista Previa</h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0"
                            onClick={() => setSelectedDocPreview(null)}
                          >
                            ✕
                          </Button>
                        </div>
                        <div className="text-[10px] space-y-1.5">
                          <div>
                            <span className="text-muted-foreground">Archivo:</span>
                            <p className="font-medium text-foreground break-words">{selectedDocPreview.file_name}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tipo:</span>
                            <p className="font-medium text-foreground">{selectedDocPreview.document_type || 'No especificado'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fecha del documento:</span>
                            <p className="font-medium text-foreground">
                              {formatDate(selectedDocPreview.document_date) || 'No especificada'}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cargado:</span>
                            <p className="font-medium text-foreground">{formatDate(selectedDocPreview.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Dialog de previsualización */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedDocPreview?.file_name}</DialogTitle>
            <DialogDescription>
              {selectedDocPreview?.document_type || 'Documento'} • {formatDate(selectedDocPreview?.document_date || selectedDocPreview?.created_at)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto space-y-4">
            {/* Previsualización del archivo */}
            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2">Vista Previa</h4>
              {selectedDocPreview?.file_type === 'application/pdf' ? (
                <iframe
                  src={selectedDocPreview.file_url}
                  className="w-full h-[400px] rounded border"
                  title="Vista previa del PDF"
                />
              ) : selectedDocPreview?.file_type?.startsWith('image/') ? (
                <img
                  src={selectedDocPreview.file_url}
                  alt={selectedDocPreview.file_name}
                  className="w-full rounded border"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Previsualización no disponible</p>
              )}
            </div>

            {/* Datos extraídos */}
            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2">Información Detectada</h4>
              <div className="space-y-3 text-sm">
                {selectedDocPreview?.document_type && (
                  <div>
                    <span className="text-muted-foreground">Tipo de documento: </span>
                    <span className="font-medium">{selectedDocPreview.document_type}</span>
                  </div>
                )}
                {selectedDocPreview?.document_date && (
                  <div>
                    <span className="text-muted-foreground">Fecha: </span>
                    <span className="font-medium">{formatDate(selectedDocPreview.document_date)}</span>
                  </div>
                )}
                {selectedDocPreview?.structured_data && Object.keys(selectedDocPreview.structured_data).length > 0 && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Datos estructurados:</span>
                    <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(selectedDocPreview.structured_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Texto extraído */}
            {selectedDocPreview?.extracted_text && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">Texto Extraído</h4>
                <ScrollArea className="h-[200px]">
                  <p className="text-xs text-foreground whitespace-pre-wrap">
                    {selectedDocPreview.extracted_text}
                  </p>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
