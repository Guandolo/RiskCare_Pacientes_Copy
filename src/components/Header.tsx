import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import riskCareLogo from "@/assets/riskcare-logo.png";

export const Header = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Sesión cerrada exitosamente");
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card shadow-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <img 
          src={riskCareLogo} 
          alt="RiskCare" 
          className="h-10" 
          width="206" 
          height="100"
          loading="eager"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{user?.email || "Usuario"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
