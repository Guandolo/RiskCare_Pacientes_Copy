import { Network, FlaskConical, Stethoscope, Pill, BookOpen } from "lucide-react";
import { ClinicalNotebookPanel } from "./ClinicalNotebookPanel";

interface CollapsibleNotebookPanelProps {
  isCollapsed: boolean;
}

export const CollapsibleNotebookPanel = ({ isCollapsed }: CollapsibleNotebookPanelProps) => {
  const tools = [
    { icon: Network, label: "Mapa", key: "clinical-map", color: "text-cyan-500" },
    { icon: FlaskConical, label: "Laboratorios", key: "paraclinicos", color: "text-emerald-500" },
    { icon: Stethoscope, label: "Diagnósticos", key: "diagnostic-aids", color: "text-amber-500" },
    { icon: Pill, label: "Medicamentos", key: "medicamentos", color: "text-rose-500" },
  ];

  return (
    <div className="h-full relative">
      {isCollapsed ? (
        // Vista colapsada - barra de iconos vertical elegante
        <div className="h-full bg-muted/30 flex flex-col items-center py-8 gap-4 px-2 border-l border-border">
          <div className="mb-4">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          {tools.map((tool) => (
            <div 
              key={tool.key} 
              className="group relative flex flex-col items-center gap-1.5 cursor-pointer"
              title={tool.label}
            >
              <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group-hover:scale-110">
                <tool.icon className={`w-4 h-4 ${tool.color}`} />
              </div>
              <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight max-w-[50px]">
                {tool.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        // Vista expandida - contenido completo
        <div className="h-full overflow-hidden">
          <ClinicalNotebookPanel />
        </div>
      )}
    </div>
  );
};
