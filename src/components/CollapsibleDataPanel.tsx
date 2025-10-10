import { Upload, FileText, Database, Activity, User, FolderOpen } from "lucide-react";
import { DataSourcesPanel } from "./DataSourcesPanel";

interface CollapsibleDataPanelProps {
  isCollapsed: boolean;
}

export const CollapsibleDataPanel = ({ isCollapsed }: CollapsibleDataPanelProps) => {
  const tools = [
    { icon: FolderOpen, label: "Documentos", key: "documents", color: "text-blue-500" },
    { icon: Upload, label: "Subir", key: "upload", color: "text-green-500" },
    { icon: Database, label: "Topus", key: "topus", color: "text-purple-500" },
    { icon: Activity, label: "HiSmart", key: "hismart", color: "text-orange-500" },
    { icon: User, label: "Paciente", key: "patient", color: "text-pink-500" },
  ];

  return (
    <div className="h-full relative">
      {isCollapsed ? (
        // Vista colapsada - barra de iconos vertical elegante
        <div className="h-full bg-muted/30 flex flex-col items-center py-8 gap-4 px-2 border-r border-border">
          <div className="mb-4">
            <FileText className="w-6 h-6 text-primary" />
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
              <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {tool.label.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        // Vista expandida - contenido completo
        <div className="h-full bg-muted/30 overflow-hidden">
          <DataSourcesPanel />
        </div>
      )}
    </div>
  );
};
