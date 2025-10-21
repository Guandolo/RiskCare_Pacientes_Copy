import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserCheck } from "lucide-react";
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

  const handleSearch = async () => {
    if (!identification.trim()) {
      toast.error("Por favor ingresa el número de documento");
      return;
    }

    setLoading(true);
    setSearchResult(null);

    try {
      // 1. Buscar el perfil del paciente
      const { data: patientProfile, error: profileError } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('document_type', documentType)
        .eq('identification', identification)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!patientProfile) {
        toast.error("No se encontró un paciente con ese documento");
        return;
      }

      // 2. Verificar que el profesional tiene acceso a este paciente a través de alguna clínica
      const { data: clinicas, error: clinicasError } = await supabase
        .from('clinica_profesionales')
        .select(`
          clinica_id,
          clinicas:clinica_id (
            id,
            nombre
          )
        `)
        .eq('profesional_user_id', profesionalUserId);

      if (clinicasError) throw clinicasError;

      if (!clinicas || clinicas.length === 0) {
        toast.error("No estás asociado a ninguna clínica");
        return;
      }

      // 3. Verificar que el paciente pertenece a alguna de las clínicas del profesional
      const clinicaIds = clinicas.map(c => c.clinica_id);
      
      const { data: pacienteClinica, error: pacienteError } = await supabase
        .from('clinica_pacientes')
        .select('clinica_id, clinicas:clinica_id (nombre)')
        .eq('paciente_user_id', patientProfile.user_id)
        .in('clinica_id', clinicaIds)
        .maybeSingle();

      if (pacienteError) throw pacienteError;

      if (!pacienteClinica) {
        toast.error("Este paciente no pertenece a ninguna de tus clínicas");
        return;
      }

      setSearchResult({
        patient: patientProfile,
        clinica: pacienteClinica
      });

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
      // Registrar el acceso
      await supabase.from('patient_access_logs').insert({
        profesional_user_id: profesionalUserId,
        paciente_user_id: searchResult.patient.user_id,
        clinica_id: searchResult.clinica.clinica_id,
        access_type: 'view',
        access_details: {
          action: 'patient_switched',
          timestamp: new Date().toISOString()
        }
      });

      // Actualizar el contexto del profesional
      const { error: contextError } = await supabase
        .from('profesional_patient_context')
        .upsert({
          profesional_user_id: profesionalUserId,
          current_patient_user_id: searchResult.patient.user_id,
          current_clinica_id: searchResult.clinica.clinica_id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'profesional_user_id'
        });

      if (contextError) throw contextError;

      toast.success(`Paciente seleccionado: ${searchResult.patient.full_name || 'Sin nombre'}`);
      onPatientSelected(searchResult.patient.user_id, searchResult.clinica.clinica_id);
      onOpenChange(false);
      
      // Resetear el formulario
      setIdentification("");
      setSearchResult(null);
      
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
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="space-y-2">
            <Label htmlFor="identification">Número de Documento</Label>
            <div className="flex gap-2">
              <Input
                id="identification"
                value={identification}
                onChange={(e) => setIdentification(e.target.value)}
                placeholder="Ej: 1234567890"
                disabled={loading}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {searchResult && (
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="space-y-2">
                <p className="font-semibold">Paciente encontrado:</p>
                <div className="text-sm space-y-1">
                  <p><strong>Nombre:</strong> {searchResult.patient.full_name || 'Sin nombre'}</p>
                  <p><strong>Documento:</strong> {searchResult.patient.document_type} {searchResult.patient.identification}</p>
                  <p><strong>Edad:</strong> {searchResult.patient.age || 'N/A'} años</p>
                  <p><strong>EPS:</strong> {searchResult.patient.eps || 'N/A'}</p>
                  <p><strong>Clínica:</strong> {searchResult.clinica.clinicas?.nombre}</p>
                </div>
                <Button 
                  onClick={handleSelectPatient} 
                  className="w-full mt-3"
                >
                  Seleccionar este paciente
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
