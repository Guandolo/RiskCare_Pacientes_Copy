import { Network, FlaskConical, Stethoscope, Pill } from "lucide-react";
import { ClinicalNotebookPanel } from "./ClinicalNotebookPanel";

interface CollapsibleNotebookPanelProps {
  isCollapsed: boolean;
}

export const CollapsibleNotebookPanel = ({ isCollapsed }: CollapsibleNotebookPanelProps) => {
  const tools = [
    { icon: Network, label: "Mapa Clínico", key: "clinical-map" },
    { icon: FlaskConical, label: "Paraclínicos", key: "paraclinicos" },
    { icon: Stethoscope, label: "Ayudas Diagnósticas", key: "diagnostic-aids" },
    { icon: Pill, label: "Medicamentos", key: "medicamentos" },
  ];

  return (
    <div className="h-full relative">
      {isCollapsed ? (
        // Vista colapsada - barra de iconos vertical
        <div className="h-full bg-card flex flex-col items-center py-8 gap-6 px-3">
          {tools.map((tool) => (
            <div key={tool.key} className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
                <tool.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] text-muted-foreground max-w-[60px] leading-tight">
                {tool.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        // Vista expandida - contenido completo
        <div className="h-full bg-card overflow-hidden">
          <ClinicalNotebookPanel />
        </div>
      )}
    </div>
  );
};
