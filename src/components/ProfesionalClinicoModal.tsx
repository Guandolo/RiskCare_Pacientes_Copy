import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, GraduationCap, Award } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProfesionalClinicoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ProfesionalClinicoModal = ({ open, onOpenChange, onSuccess }: ProfesionalClinicoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [patientProfile, setPatientProfile] = useState<{document_type: string; identification: string; full_name: string} | null>(null);
  const [validationResult, setValidationResult] = useState<{success: boolean; message: string; rethusData?: any} | null>(null);

  useEffect(() => {
    const fetchPatientProfile = async () => {
      if (!open) return;
      
      setLoadingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('patient_profiles')
          .select('document_type, identification, full_name')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setPatientProfile(data);
      } catch (error) {
        console.error('Error fetching patient profile:', error);
        toast.error("No se pudo cargar tu perfil de paciente");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchPatientProfile();
  }, [open]);

  const handleValidate = async () => {
    if (!patientProfile) {
      toast.error("No se pudo obtener tu información de paciente");
      return;
    }

    setLoading(true);
    setValidationResult(null);

    try {
      const tipoDocumentoMap: Record<string, string> = {
        "CC": "Cédula de Ciudadanía",
        "CE": "Cédula de Extranjería",
        "PT": "Permiso por protección temporal",
        "TI": "Tarjeta de Identidad"
      };

      const { data, error } = await supabase.functions.invoke('validar-rethus', {
        body: {
          tipoDocumento: tipoDocumentoMap[patientProfile.document_type] || patientProfile.document_type,
          numeroDocumento: patientProfile.identification
        }
      });

      if (error) throw error;

      setValidationResult({
        success: data.success,
        message: data.message,
        rethusData: data.rethusData
      });

      if (data.success) {
        toast.success("¡Validación exitosa! Ahora eres profesional clínico");
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 3000);
      } else {
        toast.error("No se encontró registro profesional en RETHUS");
      }
    } catch (error) {
      console.error('Error validating professional:', error);
      toast.error("Error al validar credenciales profesionales");
      setValidationResult({
        success: false,
        message: "Error al conectar con el sistema de validación"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Validar como Profesional Clínico</DialogTitle>
          <DialogDescription>
            Valida tus credenciales profesionales en el Registro RETHUS para acceder a funciones avanzadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : patientProfile ? (
            <>
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Se validará con tu documento registrado:</p>
                    <div className="text-sm">
                      <p><strong>Nombre:</strong> {patientProfile.full_name}</p>
                      <p><strong>Tipo:</strong> {patientProfile.document_type}</p>
                      <p><strong>Número:</strong> {patientProfile.identification}</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {validationResult && (
                <div className={`space-y-3 p-4 rounded-lg border ${
                  validationResult.success 
                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                    : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {validationResult.success ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-2">
                      <p className={`text-sm font-medium ${
                        validationResult.success 
                          ? 'text-green-900 dark:text-green-100' 
                          : 'text-red-900 dark:text-red-100'
                      }`}>
                        {validationResult.message}
                      </p>
                      
                      {validationResult.success && validationResult.rethusData && (
                        <div className="mt-3 space-y-2 text-sm text-green-800 dark:text-green-200">
                          <div className="flex items-start gap-2">
                            <GraduationCap className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">Información Académica:</p>
                              {validationResult.rethusData.profesion && (
                                <p>• <strong>Profesión:</strong> {validationResult.rethusData.profesion}</p>
                              )}
                              {validationResult.rethusData.especialidad && (
                                <p>• <strong>Especialidad:</strong> {validationResult.rethusData.especialidad}</p>
                              )}
                              {validationResult.rethusData.registroProfesional && (
                                <p>• <strong>Registro:</strong> {validationResult.rethusData.registroProfesional}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleValidate} 
                disabled={loading || loadingProfile}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Validando...' : 'Validar Credenciales'}
              </Button>
            </>
          ) : (
            <Alert>
              <AlertDescription>
                No se encontró tu perfil de paciente. Debes completar tu perfil primero.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};