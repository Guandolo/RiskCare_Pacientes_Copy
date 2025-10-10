import { LogOut, User, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import riskCareLogo from "@/assets/riskcare-logo.png";

export const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      <div className="flex items-center gap-6">
        <img 
          src={riskCareLogo} 
          alt="RiskCare" 
          className="h-10 w-auto object-contain cursor-pointer"
          onClick={() => navigate("/")}
        />
        
        {/* Navegación */}
        <nav className="hidden md:flex items-center gap-2">
          <Button
            variant={location.pathname === "/" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Asistente
          </Button>
          <Button
            variant={location.pathname === "/documents" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate("/documents")}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Documentos
          </Button>
        </nav>
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
