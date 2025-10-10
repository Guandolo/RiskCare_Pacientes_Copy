import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataSourcesPanel } from "./DataSourcesPanel";

export const CollapsibleDataPanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`h-full transition-all duration-300 ${isCollapsed ? 'w-14' : 'w-full'}`}>
      {isCollapsed ? (
        // Vista colapsada - solo iconos
        <div className="h-full border-r border-border bg-card flex flex-col items-center py-4 gap-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsCollapsed(false)}
            className="w-8 h-8"
            title="Expandir panel"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <FileText className="w-5 h-5" />
            <span className="text-xs writing-mode-vertical rotate-180">Documentos</span>
          </div>
        </div>
      ) : (
        // Vista expandida - contenido completo
        <div className="h-full border-r border-border bg-card overflow-hidden relative">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsCollapsed(true)}
            className="absolute top-2 right-2 z-10 w-8 h-8"
            title="Colapsar panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <DataSourcesPanel />
        </div>
      )}
    </div>
  );
};
