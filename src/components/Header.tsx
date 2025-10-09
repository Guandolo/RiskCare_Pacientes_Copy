import { Activity, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Header = () => {
  return (
    <header className="h-16 border-b border-border bg-card shadow-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Activity className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            RiskCare Pacientes
          </h1>
          <p className="text-xs text-muted-foreground">Asistente Clínico Inteligente</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Usuario Demo</span>
        </div>
        <Button variant="ghost" size="icon">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
