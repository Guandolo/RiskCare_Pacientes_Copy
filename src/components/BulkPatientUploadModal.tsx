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

      // Formato: DOC_TIPO DOC_NUMERO [Nombre...]
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

    const processedResults: PatientRow[] = []; const allowedDocTypes = new Set(['CC','TI','CE','PA','RC','NU','CD','CN','SC','PE','PT']);

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      
      // Actualizar estado a "processing"
      setResults(prev => prev.map((p, idx) => 
        idx === i ? { ...p, status: 'processing' } : p
      ));

      try {
        // Validar tipo de documento
        if (!allowedDocTypes.has(patient.documentType)) {
          setResults(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', message: 'Tipo de documento no soportado' } : p));
          processedResults.push({ ...patient, status: 'error', message: 'Tipo de documento no soportado' });
          continue;
        }

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

        // 2. Verificar si ya existe perfil
        const { data: existingProfile } = await supabase
          .from('patient_profiles')
          .select('user_id')
          .eq('document_type', patient.documentType)
          .eq('identification', patient.identification)
          .maybeSingle();

        const fullName = `${topusData.result.nombre || ''} ${topusData.result.s_nombre || ''} ${topusData.result.apellido || ''} ${topusData.result.s_apellido || ''}`.trim();

        // 3. Llamar al backend para crear/asociar
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const { data: adminCreateResp, error: adminCreateErr } = await supabase.functions.invoke('admin-create-patient', {
          body: {
            clinicaId,
            documentType: patient.documentType,
            identification: patient.identification,
            fullName,
            topusData
          },
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (adminCreateErr) throw adminCreateErr;

        const updated: PatientRow = { ...patient, status: 'success', message: existingProfile ? 'Asociado a clínica' : 'Creado y asociado', fullName };
        processedResults.push(updated);
        setResults(prev => prev.map((p, idx) => idx === i ? updated : p));

      } catch (error: any) {
        console.error(`Error processing patient ${i}:`, error);
        const updated: PatientRow = { ...patient, status: 'error', message: error.message || 'Error desconocido' };
        processedResults.push(updated);
        setResults(prev => prev.map((p, idx) => idx === i ? updated : p));
      }

      // Pequeña pausa entre solicitudes para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setProcessing(false);
    const finalResults = processedResults.length ? processedResults : results;
    const successCount = finalResults.filter(r => r.status === 'success').length;
    const errorCount = finalResults.filter(r => r.status === 'error').length;
    setResults(finalResults);

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
            Formato: DOC_TIPO DOC_NUMERO NOMBRE_OPCIONAL (uno por línea)
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Ejemplos (uno por línea):</strong><br />
                CC 1234567890<br />
                TI 9876543210 Juan Pérez<br />
                <span className="text-muted-foreground mt-1 block">
                  Tipos válidos: CC, TI, CE, PA, RC, NU, CD, CN, SC, PE, PT
                </span>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="bulkText">Lista de Pacientes</Label>
              <Textarea
                id="bulkText"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="CC 1234567890 Juan Pérez"
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
