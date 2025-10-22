import { Upload, FileText, Calendar, Heart, Edit2, ChevronDown, ChevronUp, RefreshCw, Trash2, Download, User, CreditCard, MapPin, Building2, Phone, Droplet, FolderOpen, Activity, FilePlus2, Pill, Check, Loader2, AlertCircle, CheckCircle, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SecureUploadModal } from "./SecureUploadModal";
import { QuickUploadModal } from "./QuickUploadModal";
import { DocumentLibraryModal } from "./DocumentLibraryModal";
import { ClinicalRecordsModal } from "./ClinicalRecordsModal";
import { UpdateClinicalDataModal } from "./UpdateClinicalDataModal";
import { PatientSearchModal } from "./PatientSearchModal";
import { toast } from "@/components/ui/sonner";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useActivePatient } from "@/hooks/useActivePatient";
import { useProfesionalContext } from "@/hooks/useProfesionalContext";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStore } from "@/stores/globalStore";

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
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string | null;
}

interface DataSourcesPanelProps {
  displayedUserId?: string;
}

export const DataSourcesPanel = ({ displayedUserId }: DataSourcesPanelProps) => {
  const { user } = useAuth();
  const { isProfesional } = useUserRole();
  const { activePatient, setActivePatient } = useActivePatient();
  const { setPatientContext } = useProfesionalContext();
  const { getCacheData, setCacheData } = useGlobalStore();
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
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pendingProcessing, setPendingProcessing] = useState<any | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showQuickUploadModal, setShowQuickUploadModal] = useState(false);
  const [showDocumentLibrary, setShowDocumentLibrary] = useState(false);
  const [showClinicalRecords, setShowClinicalRecords] = useState(false);
  const [showPrescriptions, setShowPrescriptions] = useState(false);
  const [showUpdateClinicalData, setShowUpdateClinicalData] = useState(false);
  const [showPatientSearchModal, setShowPatientSearchModal] = useState(false);

  // Efecto para recargar cuando cambie el paciente activo (profesional)
  // CRÍTICO: Usar cache para evitar recargas innecesarias
  useEffect(() => {
    const patientId = isProfesional && activePatient ? activePatient.user_id : user?.id;
    if (!patientId) return;
    
    // Intentar cargar desde cache primero
    const cachedDocuments = getCacheData(`documents_${patientId}`, 2 * 60 * 1000); // 2 minutos
    if (cachedDocuments) {
      setDocuments(cachedDocuments);
    }
    
    loadProfileAndData();
  }, [isProfesional, activePatient?.user_id]); // Solo reaccionar al cambio de ID, no al objeto completo

  useEffect(() => {
    // Listener para recargar perfil cuando se cree por primera vez
    const handleProfileUpdate = () => {
      loadProfileAndData();
      setPatientInfoOpen(true);
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    // Suscripción a cambios de sesión centralizados
    const handleAuth = () => {
      setProfile(null);
      setDocuments([]);
      setLoading(true);
      loadProfileAndData();
    };
    window.addEventListener('authChanged', handleAuth);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('authChanged', handleAuth);
    };
  }, []);
  const loadProfileAndData = async () => {
    // Reset para evitar datos obsoletos cuando cambia el paciente activo
    setHismartData(null);
    setHismartLastFetch(null);
    setDocuments([]);
    await loadProfile();
    await loadDocuments();
  };
  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // CRÍTICO: Si es profesional y tiene paciente activo, NO hacer consultas adicionales
      // El activePatient YA tiene todos los datos necesarios del hook useActivePatient
      if (isProfesional && activePatient) {
        // Usar directamente el activePatient sin hacer consultas adicionales
        setProfile(activePatient);
        setPhoneValue(activePatient.phone || "");
        
        // Cargar datos de HiSmart del paciente activo
        if (activePatient.topus_data && typeof activePatient.topus_data === 'object') {
          const topusData = activePatient.topus_data as any;
          if (topusData.hismart_data) {
            setHismartData(topusData.hismart_data);
            setHismartLastFetch(topusData.hismart_last_fetch || null);
          }
        }
        setLoading(false);
        return; // IMPORTANTE: Salir aquí para no ejecutar la consulta de abajo
      }

      // Solo si NO es profesional o NO tiene paciente activo, cargar su propio perfil
      const { data, error } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando perfil:', error);
        return;
      }

      if (!data) {
        setProfile(null);
        window.dispatchEvent(new CustomEvent('profileMissing'));
        return;
      }
      
      setProfile(data);
      setPhoneValue(data.phone || "");
      window.dispatchEvent(new CustomEvent('profileLoaded'));
      
      if (data.topus_data && typeof data.topus_data === 'object') {
        const topusData = data.topus_data as any;
        if (topusData.hismart_data) {
          setHismartData(topusData.hismart_data);
          setHismartLastFetch(topusData.hismart_last_fetch || null);
        }
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determinar de qué usuario cargar documentos
      const targetUserId = isProfesional && activePatient ? activePatient.user_id : user.id;

      // Verificar cache primero
      const cacheKey = `documents_${targetUserId}`;
      const cachedData = getCacheData(cacheKey, 2 * 60 * 1000); // 2 minutos
      
      if (cachedData) {
        setDocuments(cachedData);
        return; // Usar datos en cache, no hacer query
      }

      const { data, error } = await supabase
        .from('clinical_documents')
        .select('id, file_name, document_type, document_date, created_at, file_url, file_type, extracted_text, structured_data, processing_status, processing_error')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const docs = (data || []) as ClinicalDocument[];
      setDocuments(docs);
      
      // Guardar en cache
      setCacheData(cacheKey, docs);
    } catch (error) {
      console.error('Error cargando documentos:', error);
    }
  };

  const handleViewDocument = async (doc: any) => {
    try {
      // Determinar URL pública válida
      let publicUrl = doc.file_url as string | undefined;
      if (!publicUrl || !/^https?:\/\//.test(publicUrl)) {
        const { data } = supabase.storage
          .from('clinical-documents')
          .getPublicUrl(doc.file_url);
        publicUrl = data.publicUrl;
      }

      // Guardar doc con URL resuelta
      const docWithUrl = { ...doc, publicUrl };
      setSelectedDocPreview(docWithUrl);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error al cargar vista previa:', error);
      toast.error('No se pudo cargar la vista previa del documento');
    }
  };

  const startPasswordFlow = (params: { publicUrl: string; fileName: string; fileType: string; userId: string; identification?: string | null; }) => {
    setPendingProcessing(params);
    setPdfPassword(params.identification || profile?.identification || '');
    setPasswordDialogOpen(true);
  };

  const confirmPassword = async () => {
    if (!pendingProcessing) return;
    try {
      const { publicUrl, fileName, fileType, userId, identification } = pendingProcessing;
      toast.info(`Intentando desbloquear ${fileName}...`);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: retryData, error: retryError } = await supabase.functions.invoke('process-document', {
        body: {
          fileUrl: publicUrl,
          fileName,
          fileType,
          userId,
          userIdentification: identification || profile?.identification,
          pdfPassword
        },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (retryError) {
        const errorMsg = String((retryError as any)?.message || '');
        if (errorMsg.includes('PDF_PASSWORD_REQUIRED') || errorMsg.includes('423')) {
          toast.error('Contraseña incorrecta. Intenta nuevamente.');
          return;
        }
        console.error('Error reintentando procesamiento:', retryError);
        toast.error('No se pudo desbloquear el PDF');
        return;
      }

      toast.success(`${fileName} cargado exitosamente`);
      setPasswordDialogOpen(false);
      setPendingProcessing(null);
      setPdfPassword('');
      await loadDocuments();
      window.dispatchEvent(new CustomEvent('documentsUpdated'));
    } catch (e) {
      console.error(e);
      toast.error('Error reintentando procesamiento');
    }
  };

  const useIdentificationAsPassword = () => {
    if (profile?.identification) {
      setPdfPassword(profile.identification);
    }
  };

  const cancelPassword = () => {
    setPasswordDialogOpen(false);
    setPendingProcessing(null);
    setPdfPassword('');
    toast.message('Carga de PDF protegida cancelada');
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

  const handleUpdateSuccess = (data: any, fetchDate: string) => {
    setHismartData(data);
    setHismartLastFetch(fetchDate);
    loadProfile(); // Recargar perfil para actualizar los datos
  };

  const handlePatientSelected = async (patientUserId: string, clinicaId: string) => {
    // Actualizar el contexto del profesional
    await setPatientContext(patientUserId, clinicaId);
    
    // Cargar el perfil completo del paciente seleccionado
    const { data: profile, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', patientUserId)
      .single();
    
    if (!error && profile) {
      setActivePatient(profile);
      toast.success(`Paciente activo: ${profile.full_name || 'Sin nombre'}`);
    } else {
      toast.error('Error al cargar el perfil del paciente');
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

  const handleUploadSuccess = () => {
    toast.success('Documento cargado y verificado correctamente');
    loadDocuments();
  };

  const handleDownloadDocument = async (doc: any) => {
    try {
      // Obtener URL pública del documento
      let publicUrl = doc.file_url as string | undefined;
      if (!publicUrl || !/^https?:\/\//.test(publicUrl)) {
        const { data } = supabase.storage
          .from('clinical-documents')
          .getPublicUrl(doc.file_url);
        publicUrl = data.publicUrl;
      }

      // Descargar el archivo
      const response = await fetch(publicUrl);
      const blob = await response.blob();
      
      // Crear un enlace temporal y hacer clic para descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'documento.jpg';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Documento descargado');
    } catch (error) {
      console.error('Error descargando documento:', error);
      toast.error('Error al descargar el documento');
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
    <>
      <div className="flex flex-col h-full bg-muted/30" data-tour="documents-panel">
        <div className="p-4 border-b border-border bg-background shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {isProfesional && activePatient ? "Paciente Activo" : "Mis Documentos Clínicos"}
                </h2>
                <p className="text-xs text-muted-foreground">Fuentes de datos consolidadas</p>
              </div>
            </div>
            {/* Botón Cambiar/Buscar Paciente solo para profesionales */}
            {isProfesional && (
              <Button
                variant={activePatient ? "outline" : "default"}
                size="sm"
                onClick={() => setShowPatientSearchModal(true)}
                className="h-auto py-1.5 px-3"
              >
                <Users className="h-4 w-4 mr-1.5" />
                <span className="text-xs">{activePatient ? "Cambiar" : "Buscar Paciente"}</span>
              </Button>
            )}
          </div>
        </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Patient Info Card - Colapsable */}
          <Collapsible open={patientInfoOpen} onOpenChange={setPatientInfoOpen}>
            <Card className="bg-gradient-card shadow-card border-primary/20">
              <CollapsibleTrigger className="w-full p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-sm">
                      {isProfesional && activePatient ? "Información del Paciente Activo" : "Información del Paciente"}
                    </h3>
                    {profile && (
                      <>
                        <p className="text-base font-bold text-foreground mt-1">
                          {getTopusValue('result.nombre')} {getTopusValue('result.s_nombre')} {getTopusValue('result.apellido')} {getTopusValue('result.s_apellido')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {profile.document_type}: {profile.identification}
                        </p>
                      </>
                    )}
                  </div>
                  {patientInfoOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                  <div className="space-y-4 text-xs pt-2">
                    {/* Datos Personales */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <User className="w-3.5 h-3.5" />
                        <span>Datos Personales</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pl-5">
                        <div>
                          <div className="text-muted-foreground mb-1">Sexo</div>
                          <div className="font-medium">{getTopusValue('result.sexo') || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Edad</div>
                          <div className="font-medium">{getTopusValue('result.edad')} años</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Fecha de Nacimiento</div>
                          <div className="font-medium">{getTopusValue('result.fecha_nacimiento') || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Tipo de Sangre</div>
                          <div className="font-medium flex items-center gap-1">
                            <Droplet className="w-3 h-3 text-red-500" />
                            {profile.topus_data?.document_data?.tipoSangre && profile.topus_data?.document_data?.rh 
                              ? `${profile.topus_data.document_data.tipoSangre}${profile.topus_data.document_data.rh}`
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ubicación */}
                    <div className="space-y-3 border-t border-border/50 pt-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Ubicación</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pl-5">
                        <div>
                          <div className="text-muted-foreground mb-1">Municipio</div>
                          <div className="font-medium">{getTopusValue('result.municipio_id') || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Departamento</div>
                          <div className="font-medium">{getTopusValue('result.departamento_id') || 'N/A'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Afiliación y Salud */}
                    <div className="space-y-3 border-t border-border/50 pt-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Afiliación y Salud</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pl-5">
                        <div>
                          <div className="text-muted-foreground mb-1">Estado</div>
                          <div className="font-medium">{getTopusValue('result.estado') || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Estado Afiliación</div>
                          <div className="font-medium text-[10px] leading-tight">
                            {getTopusValue('result.estado_afiliacion') || 'N/A'}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground mb-1">EPS</div>
                          <div className="font-medium">{getTopusValue('result.eps') || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Tipo Régimen</div>
                          <div className="font-medium text-[10px] leading-tight">
                            {getTopusValue('result.eps_tipo') || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Código EPS</div>
                          <div className="font-medium">{getTopusValue('result.eps_codigo') || 'N/A'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Contacto */}
                    <div className="space-y-3 border-t border-border/50 pt-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Contacto</span>
                      </div>
                      
                      <div className="pl-5">
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


          {/* Mis Documentos Cargados - Botón tipo tarjeta */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="cursor-pointer hover:shadow-md transition-all bg-background border"
                onClick={() => setShowDocumentLibrary(true)}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {isProfesional && activePatient ? "Documentos del Paciente" : "Mis Documentos Cargados"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ver todos tus documentos médicos cargados</p>
            </TooltipContent>
          </Tooltip>

          {/* Upload Section - Quick Upload*/}
          <div className="space-y-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all shadow-md" 
                  size="lg"
                  onClick={() => setShowQuickUploadModal(true)}
                >
                  <FilePlus2 className="w-4 h-4" />
                  {isProfesional && activePatient ? "Cargar Documentos del Paciente" : "Carga Rápida de Documentos"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sube múltiples documentos de forma rápida. Se procesarán en segundo plano.</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-xs text-muted-foreground text-center">
              Carga múltiple - Se procesan automáticamente
            </p>
          </div>


          {/* Botón consultar/actualizar HiSmart */}
          <div className="space-y-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="cursor-pointer hover:shadow-md transition-all bg-gradient-card"
                  onClick={() => setShowUpdateClinicalData(true)}
                >
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">
                        {hismartLastFetch 
                          ? (isProfesional && activePatient ? 'Actualizar Datos del Paciente' : 'Actualizar Datos Clínicos')
                          : (isProfesional && activePatient ? 'Consultar Datos del Paciente' : 'Consultar Datos Clínicos')
                        }
                      </h3>
                      {hismartLastFetch && (
                        <p className="text-xs text-muted-foreground">
                          Última consulta: {hismartLastFetch}
                        </p>
                      )}
                      {!hismartLastFetch && (
                        <p className="text-xs text-muted-foreground">
                          {isProfesional && activePatient ? 'Obtener datos del paciente' : 'Obtener datos de Historia Clínica'}
                        </p>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
                  </div>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sincronizar tus datos médicos desde el sistema de Historia Clínica</p>
              </TooltipContent>
            </Tooltip>
          </div>
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
                  src={selectedDocPreview.publicUrl || selectedDocPreview.file_url}
                  className="w-full h-[400px] rounded border"
                  title="Vista previa del PDF"
                />
              ) : selectedDocPreview?.file_type?.startsWith('image/') ? (
                <img
                  src={selectedDocPreview.publicUrl || selectedDocPreview.file_url}
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
      {/* Dialog para contraseña de PDF */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PDF Protegido con Contraseña</DialogTitle>
            <DialogDescription>
              Este documento está protegido. Ingresa la contraseña o intenta con tu número de documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Contraseña del PDF"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && pdfPassword.trim() && confirmPassword()}
              />
              <p className="text-xs text-muted-foreground">
                💡 Sugerencia: Muchos documentos médicos usan tu número de documento como contraseña
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setPdfPassword(profile?.identification || '')}
                disabled={!profile?.identification}
              >
                Probar con mi documento
              </Button>
              <Button variant="ghost" onClick={cancelPassword}>Cancelar</Button>
              <Button onClick={confirmPassword} disabled={!pdfPassword.trim()}>Desbloquear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Upload Modal */}
      <QuickUploadModal
        open={showQuickUploadModal}
        onOpenChange={setShowQuickUploadModal}
        onSuccess={handleUploadSuccess}
      />

      {/* Secure Upload Modal (legacy) */}
      <SecureUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onSuccess={handleUploadSuccess}
      />

      {/* Document Library Modal */}
      <DocumentLibraryModal
        open={showDocumentLibrary}
        onOpenChange={setShowDocumentLibrary}
      />

      {/* Update Clinical Data Modal */}
      <UpdateClinicalDataModal
        open={showUpdateClinicalData}
        onOpenChange={setShowUpdateClinicalData}
        profile={profile}
        onSuccess={handleUpdateSuccess}
        hismartData={hismartData}
      />

      {/* Modal de Búsqueda de Paciente (solo para profesionales) */}
      {isProfesional && user && (
        <PatientSearchModal
          open={showPatientSearchModal}
          onOpenChange={setShowPatientSearchModal}
          onPatientSelected={handlePatientSelected}
          profesionalUserId={user.id}
        />
      )}
      </div>
    </>
  );
};
