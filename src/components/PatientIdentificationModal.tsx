import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
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
  const [scanMode, setScanMode] = useState<'select' | 'capture' | 'review'>('select');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [editableData, setEditableData] = useState<any>(null);
  
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
      });
      
      // Precargar datos en el formulario
      setDocumentType(data.data.tipoDocumento || 'CC');
      setIdentification(data.data.numeroDocumento || '');
      
      setScanMode('review');
      toast.success("Documento procesado exitosamente");
    } catch (error: any) {
      console.error('Error procesando documento:', error);
      toast.error(error.message || "Error al procesar el documento. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identification.trim()) {
      toast.error("Por favor ingresa tu número de documento");
      return;
    }

    setLoading(true);
    try {
      // Primero verificar si ya existe un perfil para este usuario
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
        return;
      }

      // Consultar API de Topus
      const topusData = await fetchTopusData();
      
      // Preparar nombre completo desde datos escaneados o TOPUS
      let fullName = topusData?.nombre_completo || null;
      if (editableData && editableData.nombres && editableData.apellidos) {
        fullName = `${editableData.nombres} ${editableData.apellidos}`.trim();
      }
      
      // Guardar perfil en la base de datos
      const { error } = await supabase
        .from("patient_profiles")
        .insert({
          user_id: userId,
          document_type: documentType,
          identification: identification,
          topus_data: {
            ...topusData,
            ...(editableData || {})
          },
          full_name: fullName,
          age: topusData?.edad || null,
          eps: topusData?.eps || null,
        });

      if (error) {
        // Si el error es por duplicado de user_id, informar al usuario
        if (error.code === '23505' && error.message.includes('unique_user_id')) {
          toast.error("Ya existe un perfil asociado a esta cuenta");
          return;
        }
        throw error;
      }

      toast.success("Perfil creado exitosamente");
      
      // Disparar evento para actualizar la vista del panel
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      
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
            {scanMode === 'review' && "Revisa y confirma que tu información es correcta. Puedes editar cualquier campo si es necesario."}
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
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="documentType">Tipo de Documento</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger id="documentType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                <Label>Reverso del Documento (Opcional)</Label>
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
              disabled={!frontImage || loading}
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

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    onValueChange={(v) => {
                      setEditableData({...editableData, tipoDocumento: v});
                      setDocumentType(v);
                    }}
                  >
                    <SelectTrigger id="tipoDocumento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                    onChange={(e) => {
                      setEditableData({...editableData, numeroDocumento: e.target.value});
                      setIdentification(e.target.value);
                    }}
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
                <p className="text-sm font-medium mb-2">⚠️ Importante</p>
                <p className="text-xs text-muted-foreground">
                  Por favor revisa cuidadosamente que todos tus datos sean correctos antes de continuar.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando y guardando..." : "Confirmar y Continuar"}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
