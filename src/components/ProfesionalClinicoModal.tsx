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
  isRevalidation?: boolean;
}

export const ProfesionalClinicoModal = ({ open, onOpenChange, onSuccess, isRevalidation = false }: ProfesionalClinicoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [patientProfile, setPatientProfile] = useState<{document_type: string; identification: string; full_name: string; topus_data?: any} | null>(null);
  const [validationResult, setValidationResult] = useState<{success: boolean; message: string; rethusData?: any} | null>(null);
  const [previousValidation, setPreviousValidation] = useState<{fecha: string; totalTitulos: number} | null>(null);

  useEffect(() => {
    const fetchPatientProfile = async () => {
      if (!open) return;
      
      setLoadingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('patient_profiles')
          .select('document_type, identification, full_name, topus_data')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setPatientProfile(data);

        // Si es re-validación, obtener la última validación
        if (isRevalidation) {
          const { data: profesional } = await supabase
            .from('profesionales_clinicos')
            .select('fecha_validacion, rethus_data')
            .eq('user_id', user.id)
            .single();

          if (profesional) {
            const rethusData = profesional.rethus_data as any;
            setPreviousValidation({
              fecha: profesional.fecha_validacion,
              totalTitulos: rethusData?.datos_academicos?.length || 0
            });
          }
        }
      } catch (error) {
        console.error('Error fetching patient profile:', error);
        toast.error("No se pudo cargar tu perfil de paciente");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchPatientProfile();
  }, [open, isRevalidation]);

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
        toast.success("¡Validación exitosa!");
      } else {
        toast.error("No se encontró registro profesional en RETHUS");
      }
    } catch (error) {
      console.error('Error validating professional:', error);
      toast.error("Error al validar. La función está reintentando automáticamente...");
      setValidationResult({
        success: false,
        message: "Error al conectar con RETHUS. Por favor intenta nuevamente."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRevalidation ? 'Actualizar Validación Profesional' : 'Validar como Profesional Clínico'}</DialogTitle>
          <DialogDescription>
            {isRevalidation 
              ? 'Actualiza tu información profesional si has obtenido nuevos títulos o certificaciones' 
              : 'Valida tus credenciales profesionales en el Registro RETHUS para acceder a funciones avanzadas'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : patientProfile ? (
            <>
              {previousValidation && (
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Última validación:</p>
                      <p>• Fecha: {new Date(previousValidation.fecha).toLocaleDateString('es-CO')}</p>
                      <p>• Títulos registrados: {previousValidation.totalTitulos}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {isRevalidation ? 'Se actualizará con tu documento registrado:' : 'Se validará con tu documento registrado:'}
                    </p>
                    <div className="text-sm">
                      <p><strong>Nombre:</strong> {
                        patientProfile.full_name || 
                        (() => {
                          const topusData = patientProfile.topus_data as any;
                          if (topusData?.result) {
                            const { nombre, s_nombre, apellido, s_apellido } = topusData.result;
                            return `${nombre || ''} ${s_nombre || ''} ${apellido || ''} ${s_apellido || ''}`.trim();
                          }
                          return 'No disponible';
                        })()
                      }</p>
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
                        <div className="mt-3 space-y-3 text-sm text-green-800 dark:text-green-200">
                          <div className="flex items-start gap-2">
                            <GraduationCap className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div className="space-y-3 flex-1">
                              <p className="font-semibold">Información Académica Validada:</p>
                              
                              {/* Mostrar TODOS los títulos */}
                              {validationResult.rethusData.datosAcademicos && validationResult.rethusData.datosAcademicos.length > 0 ? (
                                <div className="space-y-3">
                                  {validationResult.rethusData.datosAcademicos.map((titulo: any, index: number) => (
                                    <div key={index} className="pl-2 space-y-1.5 border-l-2 border-green-300 dark:border-green-700 pb-3">
                                      <p className="font-medium text-xs text-green-900 dark:text-green-100">
                                        Título {index + 1} de {validationResult.rethusData.datosAcademicos.length}
                                      </p>
                                      
                                      {titulo.profesion_u_ocupacion && (
                                        <p>• <strong>Profesión u Ocupación:</strong> {titulo.profesion_u_ocupacion}</p>
                                      )}
                                      {titulo.tipo_programa && (
                                        <p>• <strong>Tipo Programa:</strong> {titulo.tipo_programa}</p>
                                      )}
                                      {titulo.acto_administrativo && (
                                        <p>• <strong>Acto Administrativo:</strong> {titulo.acto_administrativo}</p>
                                      )}
                                      {titulo.entidad_reportadora && (
                                        <p>• <strong>Entidad Reportadora:</strong> {titulo.entidad_reportadora}</p>
                                      )}
                                      {titulo.fecha_inicio_ejercer_acto_administrativo && (
                                        <p>• <strong>Fecha Inicio Ejercer:</strong> {new Date(titulo.fecha_inicio_ejercer_acto_administrativo).toLocaleDateString('es-CO')}</p>
                                      )}
                                      {titulo.origen_obtencion_titulo && (
                                        <p>• <strong>Origen Título:</strong> {titulo.origen_obtencion_titulo}</p>
                                      )}
                                    </div>
                                  ))}
                                  
                                  <p className="mt-2 pt-2 border-t border-green-300 dark:border-green-700 font-medium">
                                    Total de títulos académicos: {validationResult.rethusData.datosAcademicos.length}
                                  </p>
                                </div>
                              ) : null}
                              <Alert className="mt-3 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                                <AlertDescription className="text-xs text-green-900 dark:text-green-100">
                                  <p className="font-medium mb-1">Por favor verifica que esta información sea correcta.</p>
                                  <p>Si los datos mostrados corresponden a tu información académica, haz clic en "Confirmar" para completar la validación.</p>
                                </AlertDescription>
                              </Alert>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!validationResult?.success && (
                <Button 
                  onClick={handleValidate} 
                  disabled={loading || loadingProfile}
                  className="w-full"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Validando...' : isRevalidation ? 'Actualizar Validación' : 'Validar Credenciales'}
                </Button>
              )}

              {validationResult?.success && (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setValidationResult(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Validar Nuevamente
                  </Button>
                  <Button 
                    onClick={() => {
                      onSuccess();
                      onOpenChange(false);
                    }}
                    className="flex-1"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmar
                  </Button>
                </div>
              )}
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