import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import riskCareLogo from "@/assets/riskcare-logo.png";

export const Header = () => {
  return (
    <header className="h-16 border-b border-border bg-card shadow-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <img src={riskCareLogo} alt="RiskCare" className="h-10" />
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
