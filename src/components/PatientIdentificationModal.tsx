import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, ArrowLeft, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "RC", label: "Registro Civil" },
  { value: "NU", label: "No. Único de id. Personal" },
  { value: "CD", label: "Carnet Diplomático" },
  { value: "CN", label: "Certificado de Nacido Vivo" },
  { value: "SC", label: "Salvo Conducto" },
  { value: "PE", label: "Permiso Especial de Permanencia" },
  { value: "PT", label: "Permiso por Protección Temporal" },
];

interface PatientIdentificationModalProps {
  open: boolean;
  onComplete: () => void;
  userId: string;
}

export const PatientIdentificationModal = ({ open, onComplete, userId }: PatientIdentificationModalProps) => {
  const [documentType, setDocumentType] = useState("CC");
  const [identification, setIdentification] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Estados para escaneo de documento
  const [scanMode, setScanMode] = useState<'select' | 'capture' | 'review' | 'topus'>('select');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [editableData, setEditableData] = useState<any>(null);
  const [topusData, setTopusData] = useState<any>(null);
  const [adresData, setAdresData] = useState<any>(null);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const fetchTopusData = async () => {
    const { data, error } = await supabase.functions.invoke('fetch-topus-data', {
      body: { documentType, identification }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Error al consultar Topus');
    
    return data.data;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (side === 'front') {
        setFrontImage(base64);
      } else {
        setBackImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const processDocument = async () => {
    if (!frontImage) {
      toast.error("Por favor captura la foto del frente del documento");
      return;
    }
    if (!backImage) {
      toast.error("Por favor captura la foto del reverso del documento");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-document-data', {
        body: { 
          frontImage,
          backImage 
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Error procesando documento');

      setExtractedData(data.data);
      setEditableData({
        nombres: data.data.nombres || '',
        apellidos: data.data.apellidos || '',
        numeroDocumento: data.data.numeroDocumento || '',
        tipoDocumento: data.data.tipoDocumento || 'CC',
        fechaNacimiento: data.data.fechaNacimiento || '',
        tipoSangre: data.data.tipoSangre || '',
        rh: data.data.rh || '',
        sexo: data.data.sexo || ''
      });
      
      // Precargar datos en el formulario
      setDocumentType(data.data.tipoDocumento || 'CC');
      setIdentification(data.data.numeroDocumento || '');
      
      // Guardar ambas imágenes del documento en el storage
      try {
        const timestamp = Date.now();
        const docNumber = data.data.numeroDocumento || 'sin_numero';
        
        // Convertir base64 a blob - FRENTE
        const frontBlob = await fetch(frontImage).then(r => r.blob());
        const frontFile = new File([frontBlob], `documento_identidad_frente_${docNumber}_${timestamp}.jpg`, { type: 'image/jpeg' });
        
        // Subir imagen del FRENTE
        const { data: uploadFrontData, error: uploadFrontError } = await supabase.storage
          .from('clinical-documents')
          .upload(`${userId}/documento_identidad_frente_${docNumber}_${timestamp}.jpg`, frontFile);

        if (uploadFrontError) throw uploadFrontError;

        // Convertir base64 a blob - REVERSO
        const backBlob = await fetch(backImage).then(r => r.blob());
        const backFile = new File([backBlob], `documento_identidad_reverso_${docNumber}_${timestamp}.jpg`, { type: 'image/jpeg' });
        
        // Subir imagen del REVERSO
        const { data: uploadBackData, error: uploadBackError } = await supabase.storage
          .from('clinical-documents')
          .upload(`${userId}/documento_identidad_reverso_${docNumber}_${timestamp}.jpg`, backFile);

        if (uploadBackError) throw uploadBackError;

        // Crear DOS registros en la tabla clinical_documents (uno por cada cara)
        const documentsToInsert = [
          {
            user_id: userId,
            file_name: `Documento de Identidad - Frente (${docNumber})`,
            file_type: 'image/jpeg',
            document_type: 'Documento de Identidad - Frente',
            file_url: uploadFrontData.path,
            structured_data: {
              ...data.data,
              lado: 'frente'
            }
          },
          {
            user_id: userId,
            file_name: `Documento de Identidad - Reverso (${docNumber})`,
            file_type: 'image/jpeg',
            document_type: 'Documento de Identidad - Reverso',
            file_url: uploadBackData.path,
            structured_data: {
              ...data.data,
              lado: 'reverso'
            }
          }
        ];

        const { error: dbError } = await supabase
          .from('clinical_documents')
          .insert(documentsToInsert);

        if (dbError) {
          console.error('Error guardando documentos en BD:', dbError);
        } else {
          console.log('Ambas caras del documento guardadas exitosamente');
        }
      } catch (storageError) {
        console.error('Error guardando imágenes del documento:', storageError);
        // No bloqueamos el flujo si falla el guardado
      }
      
      setScanMode('review');
      toast.success("Documento procesado exitosamente");
    } catch (error: any) {
      console.error('Error procesando documento:', error);
      toast.error(error.message || "Error al procesar el documento. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentConfirm = async () => {
    if (!editableData?.numeroDocumento) {
      toast.error("Por favor verifica el número de documento");
      return;
    }
    if (!editableData?.tipoDocumento) {
      toast.error("Selecciona el tipo de documento");
      return;
    }

    setLoading(true);
    try {
      // Verificar si ya existe un perfil con este documento (cualquier usuario)
      const { data: existingByDoc, error: docCheckError } = await supabase
        .from("patient_profiles")
        .select("user_id")
        .eq("identification", editableData.numeroDocumento)
        .maybeSingle();

      if (docCheckError) throw docCheckError;

      if (existingByDoc && existingByDoc.user_id !== userId) {
        toast.error("Este número de documento ya está registrado con otra cuenta. Si crees que es un error, por favor contacta a soporte.");
        setLoading(false);
        return;
      }

      // Verificar si ya existe un perfil para este usuario
      const { data: existingProfile, error: checkError } = await supabase
        .from("patient_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingProfile) {
        toast.success("Perfil ya existe, cargando...");
        window.dispatchEvent(new CustomEvent('profileUpdated'));
        onComplete();
        setLoading(false);
        return;
      }

      // Actualizar estado para consulta TOPUS
      setDocumentType(editableData.tipoDocumento);
      setIdentification(editableData.numeroDocumento);

      // Pasar al paso de TOPUS
      setScanMode('topus');
      
      // Consultar API de Topus
      const topusResult = await fetchTopusData();
      setTopusData(topusResult);
      setAdresData({
        eps: topusResult?.result?.eps || '',
        eps_tipo: topusResult?.result?.eps_tipo || '',
        estado_afiliacion: topusResult?.result?.estado_afiliacion || '',
        municipio: topusResult?.result?.municipio_id || '',
        departamento: topusResult?.result?.departamento_id || ''
      });
      
      toast.success("Datos consultados exitosamente");
    } catch (error: any) {
      console.error("Error al verificar documento:", error);
      toast.error(error.message || "Error al verificar el documento. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      // Confirmar sesión y obtener user id desde el backend de auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Debes iniciar sesión nuevamente.');
        setLoading(false);
        return;
      }

      // Preparar nombre completo
      let fullName = topusData?.result?.nombre_completo || null;
      if (editableData?.nombres && editableData?.apellidos) {
        fullName = `${editableData.nombres} ${editableData.apellidos}`.trim();
      }
      
      // Guardar perfil en la base de datos
      const { error } = await supabase
        .from("patient_profiles")
        .insert({
          user_id: user.id,
          document_type: editableData.tipoDocumento,
          identification: editableData.numeroDocumento,
          topus_data: {
            ...topusData,
            document_data: editableData,
            adres_overrides: adresData
          },
          full_name: fullName,
          age: topusData?.result?.edad || null,
          eps: (adresData?.eps || topusData?.result?.eps) || null,
        });

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('unique_user_id')) {
            toast.error("Ya existe un perfil asociado a esta cuenta");
          } else if (error.message.includes('identification')) {
            toast.error("Este número de documento ya está registrado");
          }
          return;
        }
        throw error;
      }

      toast.success("¡Perfil creado exitosamente!");
      
      // Disparar evento para actualizar la vista del panel
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      window.dispatchEvent(new CustomEvent('startOnboarding'));
      
      onComplete();
    } catch (error: any) {
      console.error("Error al crear perfil:", error);
      toast.error(error.message || "Error al crear el perfil. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScanMode('select');
    setFrontImage(null);
    setBackImage(null);
    setExtractedData(null);
    setEditableData(null);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Identificación del Paciente</DialogTitle>
          <DialogDescription>
            {scanMode === 'select' && "Elige cómo deseas registrarte: escaneando tu documento o ingresando los datos manualmente."}
            {scanMode === 'capture' && "Captura fotos claras del frente y reverso de tu documento de identidad."}
            {scanMode === 'review' && "Paso 1/2: Revisa y confirma la información de tu documento. Puedes editar cualquier campo si es necesario."}
            {scanMode === 'topus' && "Paso 2/2: Revisión final de tus datos consolidados. Verifica que toda la información sea correcta antes de continuar."}
          </DialogDescription>
        </DialogHeader>

        {scanMode === 'select' && (
          <div className="space-y-4">
            <Tabs defaultValue="scan" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scan">
                  <Camera className="w-4 h-4 mr-2" />
                  Escanear Documento
                </TabsTrigger>
                <TabsTrigger value="manual">Ingreso Manual</TabsTrigger>
              </TabsList>
              
              <TabsContent value="scan" className="space-y-4 mt-4">
                <div className="text-center space-y-4 py-6">
                  <Camera className="w-16 h-16 mx-auto text-primary" />
                  <h3 className="font-semibold text-lg">Registro Rápido</h3>
                  <p className="text-sm text-muted-foreground">
                    Escanea tu documento para autocompletar tu información de forma automática y segura.
                  </p>
                  <Button onClick={() => setScanMode('capture')} className="w-full">
                    Comenzar Escaneo
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="manual" className="mt-4">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!identification.trim()) {
                    toast.error("Por favor ingresa tu número de documento");
                    return;
                  }
                  setLoading(true);
                  try {
                    // Verificar si ya existe un perfil con este documento
                    const { data: existingByDoc } = await supabase
                      .from("patient_profiles")
                      .select("user_id")
                      .eq("identification", identification)
                      .maybeSingle();

                    if (existingByDoc && existingByDoc.user_id !== userId) {
                      toast.error("Este número de documento ya está registrado con otra cuenta. Si crees que es un error, por favor contacta a soporte.");
                      setLoading(false);
                      return;
                    }

                    // Simular datos extraídos para ingreso manual
                    setEditableData({
                      nombres: '',
                      apellidos: '',
                      numeroDocumento: identification,
                      tipoDocumento: documentType,
                      fechaNacimiento: '',
                      tipoSangre: '',
                      rh: '',
                    });
                    
                    setScanMode('topus');
                    const topusResult = await fetchTopusData();
                    setTopusData(topusResult);
                    toast.success("Datos consultados exitosamente");
                  } catch (error: any) {
                    console.error("Error:", error);
                    toast.error(error.message || "Error al verificar el documento");
                  } finally {
                    setLoading(false);
                  }
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="documentType">Tipo de Documento</Label>
                    <Select value={documentType} onValueChange={setDocumentType} required>
                      <SelectTrigger id="documentType">
                        <SelectValue placeholder="Selecciona tipo de documento" />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-popover">
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="identification">Número de Documento</Label>
                    <Input
                      id="identification"
                      value={identification}
                      onChange={(e) => setIdentification(e.target.value)}
                      placeholder="Ingresa tu número de documento"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Verificando..." : "Continuar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {scanMode === 'capture' && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetScan}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frente del Documento</Label>
                <div 
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => frontInputRef.current?.click()}
                >
                  {frontImage ? (
                    <img src={frontImage} alt="Frente" className="max-h-40 mx-auto rounded" />
                  ) : (
                    <div className="py-8">
                      <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click para subir</p>
                    </div>
                  )}
                </div>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, 'front')}
                />
              </div>

              <div className="space-y-2">
                <Label>Reverso del Documento</Label>
                <div 
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => backInputRef.current?.click()}
                >
                  {backImage ? (
                    <img src={backImage} alt="Reverso" className="max-h-40 mx-auto rounded" />
                  ) : (
                    <div className="py-8">
                      <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click para subir</p>
                    </div>
                  )}
                </div>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, 'back')}
                />
              </div>
            </div>

            <Button 
              onClick={processDocument} 
              className="w-full" 
              disabled={!frontImage || !backImage || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Leyendo tu documento...
                </>
              ) : (
                "Procesar Documento"
              )}
            </Button>
          </div>
        )}

        {scanMode === 'review' && editableData && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetScan}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a escanear
            </Button>

            <form onSubmit={(e) => { e.preventDefault(); handleDocumentConfirm(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombres">Nombres</Label>
                  <Input
                    id="nombres"
                    value={editableData.nombres}
                    onChange={(e) => setEditableData({...editableData, nombres: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellidos">Apellidos</Label>
                  <Input
                    id="apellidos"
                    value={editableData.apellidos}
                    onChange={(e) => setEditableData({...editableData, apellidos: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipoDocumento">Tipo de Documento</Label>
                  <Select 
                    value={editableData.tipoDocumento} 
                    onValueChange={(v) => setEditableData({...editableData, tipoDocumento: v})}
                  >
                    <SelectTrigger id="tipoDocumento">
                      <SelectValue placeholder="Selecciona tipo de documento">
                        {editableData.tipoDocumento ? 
                          DOCUMENT_TYPES.find(t => t.value === editableData.tipoDocumento)?.label 
                          : "Selecciona tipo de documento"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroDocumento">Número de Documento</Label>
                  <Input
                    id="numeroDocumento"
                    value={editableData.numeroDocumento}
                    onChange={(e) => setEditableData({...editableData, numeroDocumento: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
                  <Input
                    id="fechaNacimiento"
                    type="date"
                    value={editableData.fechaNacimiento}
                    onChange={(e) => setEditableData({...editableData, fechaNacimiento: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipoSangre">Tipo de Sangre</Label>
                  <Input
                    id="tipoSangre"
                    value={editableData.tipoSangre}
                    onChange={(e) => setEditableData({...editableData, tipoSangre: e.target.value})}
                    placeholder="Ej: O"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rh">RH</Label>
                  <Input
                    id="rh"
                    value={editableData.rh}
                    onChange={(e) => setEditableData({...editableData, rh: e.target.value})}
                    placeholder="Ej: +"
                  />
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">📋 Paso 1 de 2</p>
                <p className="text-xs text-muted-foreground">
                  Revisa cuidadosamente los datos extraídos de tu documento. Al continuar, consultaremos información adicional en ADRES.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Continuar al Paso 2"}
              </Button>
            </form>
          </div>
        )}

        {scanMode === 'topus' && topusData && editableData && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScanMode('review')}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al paso anterior
            </Button>

            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="bg-primary/10 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-sm">Información del Documento</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Nombres:</span>
                    <p className="font-medium">{editableData.nombres}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Apellidos:</span>
                    <p className="font-medium">{editableData.apellidos}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Documento:</span>
                    <p className="font-medium">{editableData.tipoDocumento} {editableData.numeroDocumento}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fecha Nacimiento:</span>
                    <p className="font-medium">{editableData.fechaNacimiento || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/10 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-sm">Información de ADRES</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">EPS:</span>
                    <p className="font-medium">{topusData?.result?.eps || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Régimen:</span>
                    <p className="font-medium">{topusData?.result?.eps_tipo || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estado Afiliación:</span>
                    <p className="font-medium text-[10px] leading-tight">{topusData?.result?.estado_afiliacion || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ubicación:</span>
                    <p className="font-medium text-[10px] leading-tight">{topusData?.result?.municipio_id}, {topusData?.result?.departamento_id}</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">✅ Paso 2 de 2</p>
                <p className="text-xs text-muted-foreground">
                  Revisa que toda la información consolidada sea correcta. Los datos de tu documento tienen prioridad sobre los de ADRES.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando perfil..." : "Confirmar y Crear Perfil"}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
