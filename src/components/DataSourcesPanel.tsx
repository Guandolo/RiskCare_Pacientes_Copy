import { Upload, FileText, Calendar, Heart, Edit2, ChevronDown, ChevronUp, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [patientInfoOpen, setPatientInfoOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
    loadDocuments();
  }, []);

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
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setDocuments(data || []);
    } catch (error) {
      console.error('Error cargando documentos:', error);
    }
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
      const { data, error } = await supabase.functions.invoke('fetch-hismart-data', {
        body: {
          documentType: profile.document_type,
          identification: profile.identification
        }
      });

      if (error) throw error;

      console.log('Datos de HiSmart:', data);
      setHismartData(data.data);
      toast.success('Datos clínicos consultados exitosamente');
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
            userId: user.id
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
                Consultar Datos Clínicos en HC
              </>
            )}
          </Button>

          {/* Datos de HiSmart */}
          {hismartData && (
            <Card className="p-4 bg-accent/5 border-accent/20">
              <h3 className="text-sm font-semibold mb-3 text-foreground">Datos Clínicos (HC)</h3>
              <div className="space-y-4">
                {/* Consultas */}
                {hismartData.consultas && hismartData.consultas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Consultas</h4>
                    {hismartData.consultas.map((consulta: any, idx: number) => (
                      <Card key={idx} className="p-3 mb-2 bg-background/50">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Fecha:</span>{' '}
                            <span className="font-medium">{consulta.fecha}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Especialidad:</span>{' '}
                            <span className="font-medium">{consulta.especialidad}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Diagnóstico:</span>{' '}
                            <span className="font-medium">{consulta.diagnostico}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Médico:</span>{' '}
                            <span className="font-medium">{consulta.medico}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Laboratorios */}
                {hismartData.laboratorios && hismartData.laboratorios.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Laboratorios</h4>
                    {hismartData.laboratorios.map((lab: any, idx: number) => (
                      <Card key={idx} className="p-3 mb-2 bg-background/50">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fecha:</span>
                            <span className="font-medium">{lab.fecha}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="font-medium">{lab.tipo}</span>
                          </div>
                          {lab.resultados && (
                            <div className="pt-2 border-t border-border/50">
                              <div className="text-muted-foreground mb-1">Resultados:</div>
                              {Object.entries(lab.resultados).map(([key, value]) => (
                                <div key={key} className="flex justify-between pl-2">
                                  <span className="text-muted-foreground capitalize">{key}:</span>
                                  <span className="font-medium">{value as string}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Imágenes */}
                {hismartData.imagenes && hismartData.imagenes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Imágenes Diagnósticas</h4>
                    {hismartData.imagenes.map((img: any, idx: number) => (
                      <Card key={idx} className="p-3 mb-2 bg-background/50">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fecha:</span>
                            <span className="font-medium">{img.fecha}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="font-medium">{img.tipo}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Hallazgos:</span>{' '}
                            <span className="font-medium">{img.hallazgos}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
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

          {/* Documents List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Historial Consolidado
            </h3>
            
            {documents.length > 0 ? (
              documents.map((doc) => (
                <Card key={doc.id} className="p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{doc.document_type || 'Documento'}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(doc.document_date || doc.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  No hay documentos cargados aún
                </p>
              </Card>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
