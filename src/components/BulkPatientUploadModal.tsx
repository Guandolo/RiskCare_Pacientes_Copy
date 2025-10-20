import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkPatientUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicaId: string;
  onSuccess: () => void;
}

interface PatientRow {
  documentType: string;
  identification: string;
  fullName?: string;
  status?: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
}

export const BulkPatientUploadModal = ({ open, onOpenChange, clinicaId, onSuccess }: BulkPatientUploadModalProps) => {
  const [bulkText, setBulkText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<PatientRow[]>([]);
  const [showResults, setShowResults] = useState(false);

  const parseBulkText = (): PatientRow[] => {
    const lines = bulkText.trim().split('\n');
    const patients: PatientRow[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Formato esperado: CC 1234567890 o CC,1234567890 o CC,1234567890,Nombre Completo
      // Soportar espacio o coma como separador
      const parts = trimmed.split(/[\s,]+/).filter(p => p.length > 0);
      
      if (parts.length >= 2) {
        patients.push({
          documentType: parts[0].toUpperCase(),
          identification: parts[1],
          fullName: parts.slice(2).join(' ') || undefined,
          status: 'pending'
        });
      }
    }

    return patients;
  };

  const validateWithTopus = async (documentType: string, identification: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke('fetch-topus-data', {
        body: { documentType, identification },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log('Topus validation response:', data);

      // El edge function retorna { success: true, data: topusData }
      if (!data || !data.success || !data.data) {
        console.error('Invalid Topus response structure:', data);
        return null;
      }

      return data.data;
    } catch (error) {
      console.error('Error validating with Topus:', error);
      return null;
    }
  };

  const handleBulkUpload = async () => {
    const patients = parseBulkText();
    
    if (patients.length === 0) {
      toast.error("No se encontraron pacientes válidos en el texto");
      return;
    }

    setProcessing(true);
    setShowResults(true);
    setResults(patients);

    const processedResults: PatientRow[] = [];

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      
      // Actualizar estado a "processing"
      setResults(prev => prev.map((p, idx) => 
        idx === i ? { ...p, status: 'processing' } : p
      ));

      try {
        // 1. Validar con Topus
        const topusData = await validateWithTopus(patient.documentType, patient.identification);
        
        console.log('Topus validation result:', topusData);
        
        if (!topusData || !topusData.result) {
          const errorMsg = !topusData 
            ? 'No se pudo validar con Topus' 
            : 'Datos incompletos de Topus';
          
          setResults(prev => prev.map((p, idx) => 
            idx === i ? { 
              ...p, 
              status: 'error', 
              message: errorMsg
            } : p
          ));
          continue;
        }

        // 2. Crear o actualizar perfil del paciente
        const { data: existingProfile } = await supabase
          .from('patient_profiles')
          .select('user_id')
          .eq('document_type', patient.documentType)
          .eq('identification', patient.identification)
          .maybeSingle();

        let patientUserId = existingProfile?.user_id;

        if (!existingProfile) {
          // Crear usuario y perfil
          const email = `paciente.${patient.identification}@riskcare.temp`;
          
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: Math.random().toString(36).slice(-12),
            email_confirm: true,
            user_metadata: {
              is_patient: true,
              document_type: patient.documentType,
              identification: patient.identification
            }
          });

          if (authError) throw authError;
          patientUserId = authData.user.id;

          // Crear perfil
          const fullName = `${topusData.result.nombre || ''} ${topusData.result.s_nombre || ''} ${topusData.result.apellido || ''} ${topusData.result.s_apellido || ''}`.trim();
          
          const { error: profileError } = await supabase
            .from('patient_profiles')
            .insert({
              user_id: patientUserId,
              document_type: patient.documentType,
              identification: patient.identification,
              full_name: fullName,
              age: topusData.result.edad,
              eps: topusData.result.eps,
              topus_data: topusData
            });

          if (profileError) throw profileError;

          // Asignar rol de paciente
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: patientUserId,
              role: 'paciente'
            });

          if (roleError) throw roleError;
        }

        // 3. Asociar a la clínica
        const { error: clinicaError } = await supabase
          .from('clinica_pacientes')
          .upsert({
            clinica_id: clinicaId,
            paciente_user_id: patientUserId!
          }, {
            onConflict: 'clinica_id,paciente_user_id'
          });

        if (clinicaError) throw clinicaError;

        const displayName = `${topusData.result.nombre || ''} ${topusData.result.s_nombre || ''} ${topusData.result.apellido || ''} ${topusData.result.s_apellido || ''}`.trim();
        
        setResults(prev => prev.map((p, idx) => 
          idx === i ? { 
            ...p, 
            status: 'success', 
            message: existingProfile ? 'Asociado a clínica' : 'Creado y asociado',
            fullName: displayName
          } : p
        ));

      } catch (error: any) {
        console.error(`Error processing patient ${i}:`, error);
        setResults(prev => prev.map((p, idx) => 
          idx === i ? { 
            ...p, 
            status: 'error', 
            message: error.message || 'Error desconocido' 
          } : p
        ));
      }

      // Pequeña pausa entre solicitudes para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setProcessing(false);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    toast.success(`Proceso completado: ${successCount} exitosos, ${errorCount} errores`);
    
    if (successCount > 0) {
      onSuccess();
    }
  };

  const handleClose = () => {
    setBulkText("");
    setResults([]);
    setShowResults(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Carga Masiva de Pacientes
          </DialogTitle>
          <DialogDescription>
            Ingresa los datos de los pacientes en formato: TIPO_DOC,NUMERO,NOMBRE (uno por línea)
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Formato esperado (uno por línea):</strong><br />
                CC 1234567890 (con espacio)<br />
                TI,9876543210 (con coma)<br />
                CE 1122334455 Nombre Completo (nombre opcional)<br />
                <span className="text-muted-foreground mt-1 block">
                  Los datos se validarán automáticamente con Topus
                </span>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="bulkText">Lista de Pacientes</Label>
              <Textarea
                id="bulkText"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="CC 1234567890&#10;TI 9876543210 Juan Pérez&#10;CE 1122334455"
                className="min-h-[200px] font-mono text-sm"
                disabled={processing}
              />
              <p className="text-xs text-muted-foreground">
                {parseBulkText().length} pacientes detectados
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={processing}>
                Cancelar
              </Button>
              <Button onClick={handleBulkUpload} disabled={processing || !bulkText.trim()}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Cargar Pacientes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {results.map((patient, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {patient.documentType} {patient.identification}
                      </p>
                      {patient.fullName && (
                        <p className="text-xs text-muted-foreground">{patient.fullName}</p>
                      )}
                      {patient.message && (
                        <p className="text-xs text-muted-foreground mt-1">{patient.message}</p>
                      )}
                    </div>
                    <div>
                      {patient.status === 'pending' && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        </div>
                      )}
                      {patient.status === 'processing' && (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      )}
                      {patient.status === 'success' && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {patient.status === 'error' && (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end">
              <Button onClick={handleClose} disabled={processing}>
                {processing ? "Procesando..." : "Cerrar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
