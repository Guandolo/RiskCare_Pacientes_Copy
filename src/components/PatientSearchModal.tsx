import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PatientSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientSelected: (patientUserId: string, clinicaId: string) => void;
  profesionalUserId: string;
}

export const PatientSearchModal = ({ open, onOpenChange, onPatientSelected, profesionalUserId }: PatientSearchModalProps) => {
  const [documentType, setDocumentType] = useState("CC");
  const [identification, setIdentification] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchLevel, setSearchLevel] = useState<number>(0);
  const [requiresDocType, setRequiresDocType] = useState(false);

  const handleSearch = async () => {
    if (!identification.trim()) {
      toast.error("Por favor ingresa el número de documento");
      return;
    }

    setLoading(true);
    setSearchResult(null);
    setSearchLevel(0);

    try {
      const { data, error } = await supabase.functions.invoke('search-patient-cascade', {
        body: {
          identification: identification.trim(),
          profesionalUserId,
          documentType: requiresDocType ? documentType : undefined
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Nivel 3 - requiere tipo de documento
      if (data.requireDocumentType) {
        setRequiresDocType(true);
        setSearchLevel(3);
        toast.info(data.message);
        return;
      }

      // Nivel 4 - no encontrado
      if (data.level === 4) {
        toast.error(data.message);
        return;
      }

      // Niveles 1, 2 y 3 - paciente encontrado
      setSearchResult(data);
      setSearchLevel(data.level);
      
      if (data.level === 1) {
        toast.success(data.message);
      } else if (data.level === 2 || data.level === 3) {
        toast.info(data.message);
      }

    } catch (error) {
      console.error('Error searching patient:', error);
      toast.error("Error al buscar el paciente");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async () => {
    if (!searchResult) return;

    try {
      const accessType = searchLevel === 1 ? 'clinic_local' : 'global_or_external';
      const isAuditable = searchLevel === 2 || searchLevel === 3;

      // Registrar el acceso con auditoría apropiada
      await supabase.from('patient_access_logs').insert({
        profesional_user_id: profesionalUserId,
        paciente_user_id: searchResult.patient.user_id,
        clinica_id: searchResult.clinica.clinica_id || searchResult.clinica[0]?.clinica_id,
        access_type: accessType,
        access_details: {
          action: 'patient_accessed',
          search_level: searchLevel,
          auditable_for_patient: isAuditable,
          timestamp: new Date().toISOString(),
          is_new_patient: searchResult.isNew || false
        }
      });

      // Actualizar el contexto del profesional
      const { error: contextError } = await supabase
        .from('profesional_patient_context')
        .upsert({
          profesional_user_id: profesionalUserId,
          current_patient_user_id: searchResult.patient.user_id,
          current_clinica_id: searchResult.clinica.clinica_id || searchResult.clinica[0]?.clinica_id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'profesional_user_id'
        });

      if (contextError) throw contextError;

      const patientName = searchResult.patient.full_name || 'Sin nombre';
      toast.success(`Acceso otorgado a paciente: ${patientName}`);
      
      if (isAuditable) {
        toast.info("Se ha registrado este acceso en el historial del paciente", { duration: 4000 });
      }

      onPatientSelected(
        searchResult.patient.user_id, 
        searchResult.clinica.clinica_id || searchResult.clinica[0]?.clinica_id
      );
      onOpenChange(false);
      
      // Resetear el formulario
      setIdentification("");
      setSearchResult(null);
      setSearchLevel(0);
      setRequiresDocType(false);
      
    } catch (error) {
      console.error('Error selecting patient:', error);
      toast.error("Error al seleccionar el paciente");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Buscar Paciente</DialogTitle>
          <DialogDescription>
            Ingresa el número de documento del paciente. El sistema buscará en tu clínica y en toda la plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {requiresDocType && (
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription>
                <p className="text-sm">
                  El paciente no se encuentra en la plataforma. Para buscar en fuentes externas, selecciona el tipo de documento.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {requiresDocType && (
            <div className="space-y-2">
              <Label htmlFor="documentType">Tipo de Documento</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                  <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                  <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                  <SelectItem value="PA">Pasaporte</SelectItem>
                  <SelectItem value="RC">Registro Civil</SelectItem>
                  <SelectItem value="NU">No. Único de id. Personal</SelectItem>
                  <SelectItem value="CD">Carnet Diplomático</SelectItem>
                  <SelectItem value="CN">Certificado de Nacido Vivo</SelectItem>
                  <SelectItem value="SC">Salvo Conducto</SelectItem>
                  <SelectItem value="PE">Permiso Especial de Permanencia</SelectItem>
                  <SelectItem value="PT">Permiso por Protección Temporal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="identification">Número de Documento</Label>
            <div className="flex gap-2">
              <Input
                id="identification"
                value={identification}
                onChange={(e) => setIdentification(e.target.value)}
                placeholder="Ej: 1234567890"
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {searchResult && (
            <Alert className={
              searchLevel === 1 
                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
            }>
              <UserCheck className={
                searchLevel === 1 
                  ? "h-4 w-4 text-green-600 dark:text-green-400"
                  : "h-4 w-4 text-blue-600 dark:text-blue-400"
              } />
              <AlertDescription className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Paciente encontrado</p>
                  {searchLevel > 1 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      {searchLevel === 2 ? 'Plataforma' : 'Fuente externa'}
                    </span>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Nombre:</strong> {searchResult.patient.full_name || 'Sin nombre'}</p>
                  <p><strong>Documento:</strong> {searchResult.patient.document_type} {searchResult.patient.identification}</p>
                  <p><strong>Edad:</strong> {searchResult.patient.age || 'N/A'} años</p>
                  <p><strong>EPS:</strong> {searchResult.patient.eps || 'N/A'}</p>
                </div>
                {(searchLevel === 2 || searchLevel === 3) && (
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-xs mt-2">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">⚠️ Acceso con auditoría</p>
                    <p className="text-blue-800 dark:text-blue-200">
                      Este acceso será registrado en el historial visible del paciente según normativas de privacidad.
                    </p>
                  </div>
                )}
                <Button 
                  onClick={handleSelectPatient} 
                  className="w-full mt-3"
                >
                  {searchLevel === 1 ? 'Seleccionar este paciente' : 'Acceder a información del paciente'}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
