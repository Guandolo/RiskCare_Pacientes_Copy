import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Calendar, Building2, Award, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ViewProfesionalDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rethusData: any;
  fechaValidacion: string;
}

export const ViewProfesionalDataModal = ({ 
  open, 
  onOpenChange, 
  rethusData,
  fechaValidacion 
}: ViewProfesionalDataModalProps) => {
  const datosAcademicos = rethusData?.datos_academicos || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Información Profesional RETHUS
          </DialogTitle>
          <DialogDescription>
            Detalles completos de tu validación profesional
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Información de la validación */}
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  <strong>Última validación:</strong> {new Date(fechaValidacion).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
                <Badge variant="outline" className="ml-2">
                  {datosAcademicos.length} {datosAcademicos.length === 1 ? 'Título' : 'Títulos'}
                </Badge>
              </div>
            </AlertDescription>
          </Alert>

          {/* Títulos académicos */}
          {datosAcademicos.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Award className="h-4 w-4" />
                Títulos Académicos Registrados
              </h3>
              
              {datosAcademicos.map((dato: any, index: number) => (
                <div 
                  key={index}
                  className="p-4 border border-border rounded-lg space-y-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {dato.tipo_programa || 'N/A'}
                        </Badge>
                        {dato.origen_obtencion_titulo && (
                          <Badge variant="outline" className="text-xs">
                            {dato.origen_obtencion_titulo}
                          </Badge>
                        )}
                      </h4>
                      
                      <div className="space-y-2 text-sm">
                        {dato.profesion_u_ocupacion && (
                          <div className="flex items-start gap-2">
                            <GraduationCap className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">Profesión u Ocupación</p>
                              <p className="font-medium">{dato.profesion_u_ocupacion}</p>
                            </div>
                          </div>
                        )}

                        {dato.acto_administrativo && (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">Acto Administrativo</p>
                              <p className="font-medium">{dato.acto_administrativo}</p>
                            </div>
                          </div>
                        )}

                        {dato.entidad_reportadora && (
                          <div className="flex items-start gap-2">
                            <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">Entidad Reportadora</p>
                              <p className="font-medium">{dato.entidad_reportadora}</p>
                            </div>
                          </div>
                        )}

                        {dato.fecha_inicio_ejercer_acto_administrativo && (
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">Fecha Inicio Ejercer</p>
                              <p className="font-medium">
                                {new Date(dato.fecha_inicio_ejercer_acto_administrativo).toLocaleDateString('es-CO')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No se encontraron títulos académicos registrados.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
