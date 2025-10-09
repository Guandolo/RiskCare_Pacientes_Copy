import { Network, FlaskConical, Scan, Pill, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export const ClinicalNotebookPanel = () => {
  const tools = [
    {
      icon: Network,
      title: "Mapa Clínico",
      description: "Visualiza conexiones entre condiciones, medicamentos y especialistas",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: FlaskConical,
      title: "Paraclínicos",
      description: "Gráficas de tendencia de resultados de laboratorio",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      icon: Scan,
      title: "Ayudas Diagnósticas",
      description: "Línea de tiempo de estudios de imagenología",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: Pill,
      title: "Medicamentos",
      description: "Historial de formulaciones médicas",
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground mb-1">Bitácora Clínica</h2>
        <p className="text-xs text-muted-foreground">Herramientas de análisis</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {tools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Card 
                key={idx} 
                className="p-4 hover:shadow-lg transition-all cursor-pointer group border-border/50 hover:border-primary/30"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${tool.bgColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 ${tool.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      {tool.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                >
                  Generar análisis
                </Button>
              </Card>
            );
          })}

          {/* Saved Notes Section */}
          <div className="pt-4 border-t border-border mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Notas Guardadas
              </h3>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <Card className="p-3 border-dashed border-border/50">
                <p className="text-xs text-muted-foreground text-center py-2">
                  Guarda análisis generados como notas para referencia futura
                </p>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
