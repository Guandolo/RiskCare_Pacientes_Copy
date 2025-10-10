import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataSourcesPanel } from "./DataSourcesPanel";

export const CollapsibleDataPanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="h-full relative">
      {isCollapsed ? (
        // Vista colapsada - solo iconos
        <div className="h-full bg-card flex flex-col items-center py-4 gap-6">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsCollapsed(false)}
            className="w-8 h-8"
            title="Expandir panel"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      ) : (
        // Vista expandida - contenido completo
        <div className="h-full bg-card overflow-hidden relative">
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
