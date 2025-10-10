import { Upload, FileText, Database, Activity, User } from "lucide-react";
import { DataSourcesPanel } from "./DataSourcesPanel";

interface CollapsibleDataPanelProps {
  isCollapsed: boolean;
}

export const CollapsibleDataPanel = ({ isCollapsed }: CollapsibleDataPanelProps) => {
  const tools = [
    { icon: Upload, label: "Subir documentos", key: "upload" },
    { icon: FileText, label: "Mis documentos", key: "documents" },
    { icon: Database, label: "Topus", key: "topus" },
    { icon: Activity, label: "HiSmart", key: "hismart" },
    { icon: User, label: "Datos paciente", key: "patient" },
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
          <DataSourcesPanel />
        </div>
      )}
    </div>
  );
};
