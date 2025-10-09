import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Pill, Calendar, User, FileText, Clock } from "lucide-react";

interface Medicamento {
  id: string;
  nombre: string;
  nombreComercial?: string;
  categoria: string;
  dosis: string;
  frecuencia: string;
  via: string;
  duracion?: string;
  fechaFormulacion: string;
  medico?: string;
  indicacion?: string;
  activo: boolean;
  fuente: string;
}

interface Props {
  data: Medicamento[];
}

export const MedicamentosViewer = ({ data }: Props) => {
  // Ordenar por fecha de formulación (más reciente primero)
  const medicamentosOrdenados = [...data].sort((a, b) => 
    new Date(b.fechaFormulacion).getTime() - new Date(a.fechaFormulacion).getTime()
  );

  // Agrupar por año
  const medicamentosPorAño = medicamentosOrdenados.reduce((acc, med) => {
    const año = new Date(med.fechaFormulacion).getFullYear();
    if (!acc[año]) acc[año] = [];
    acc[año].push(med);
    return acc;
  }, {} as Record<number, Medicamento[]>);

  const años = Object.keys(medicamentosPorAño).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Historial de Medicamentos</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {data.filter(m => m.activo).length} activos de {data.length} total
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Timeline */}
          <div className="relative">
            {años.map((año, añoIdx) => (
              <div key={año} className="mb-8">
                {/* Año Header */}
                <div className="sticky top-0 bg-background z-10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <h4 className="font-bold text-sm">{año}</h4>
                  </div>
                </div>

                {/* Medicamentos del año */}
                <div className="ml-4 border-l-2 border-border pl-6 space-y-4 mt-2">
                  {medicamentosPorAño[Number(año)].map((med, idx) => (
                    <div key={med.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-[29px] top-4 w-3 h-3 rounded-full bg-primary border-2 border-background"></div>

                      {/* Card */}
                      <Card className={`p-4 ${med.activo ? 'border-primary/50' : 'opacity-60'}`}>
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-sm">{med.nombre}</h5>
                              {med.activo ? (
                                <Badge className="text-xs">Activo</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Inactivo</Badge>
                              )}
                            </div>
                            {med.nombreComercial && (
                              <p className="text-xs text-muted-foreground">
                                Comercial: {med.nombreComercial}
                              </p>
                            )}
                            <Badge variant="secondary" className="text-xs mt-1">
                              {med.categoria}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold">
                              {new Date(med.fechaFormulacion).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Dosificación */}
                        <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-muted/30 rounded-lg">
                          <div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <Pill className="w-3 h-3" />
                              <span>Dosis</span>
                            </div>
                            <p className="text-xs font-medium">{med.dosis}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <Clock className="w-3 h-3" />
                              <span>Frecuencia</span>
                            </div>
                            <p className="text-xs font-medium">{med.frecuencia}</p>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Vía</div>
                            <p className="text-xs font-medium">{med.via}</p>
                          </div>
                          {med.duracion && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Duración</div>
                              <p className="text-xs font-medium">{med.duracion}</p>
                            </div>
                          )}
                        </div>

                        {/* Indicación */}
                        {med.indicacion && (
                          <div className="mb-3">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <FileText className="w-3 h-3" />
                              <span>Indicación</span>
                            </div>
                            <p className="text-xs">{med.indicacion}</p>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="pt-3 border-t border-border/50 space-y-2">
                          {med.medico && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span>{med.medico}</span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Fuente: {med.fuente}
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {data.length === 0 && (
            <div className="text-center py-12">
              <Pill className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">No se encontraron medicamentos</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
