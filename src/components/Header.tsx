import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Sun, Moon, LogOut, MessageCircle, UserCog, Hospital, Shield, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import riskCareIcon from "@/assets/riskcare-icon.png";
import { ProfesionalClinicoModal } from "./ProfesionalClinicoModal";
import { SuperAdminPanel } from "./SuperAdminPanel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export const Header = () => {
  const { user, signOut } = useAuth();
  const { roles, isProfesional, isAdminClinica, isSuperAdmin } = useUserRole();
  const [showProfesionalModal, setShowProfesionalModal] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();


  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Sesión cerrada exitosamente");
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(' ');
      return names.map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "U";
  };

  const handleWhatsAppSupport = () => {
    window.open('https://api.whatsapp.com/send/?phone=573106014893&text=Buenos+d%C3%ADas%2C+me+gustar%C3%ADa+conocer+un+poco+m%C3%A1s++de+lo+que+hace+Ingenier%C3%ADa+365&type=phone_number&app_absent=0', '_blank');
  };

  return (
    <header className="h-16 border-b border-border bg-card shadow-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <img 
          src={riskCareIcon} 
          alt="RiskCare" 
          className="h-10 w-10 object-contain cursor-pointer"
          onClick={() => navigate("/")}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-auto py-2 px-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{user?.email || "Usuario"}</span>
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Cuenta</h4>
                <p className="text-sm text-muted-foreground">
                  {user?.user_metadata?.full_name || user?.email}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>

              {/* Roles del usuario */}
              {roles.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Mis Roles</h4>
                    <div className="flex gap-2 flex-wrap">
                      {isProfesional && (
                        <Badge variant="secondary" className="text-xs">
                          <UserCog className="h-3 w-3 mr-1" />
                          Profesional
                        </Badge>
                      )}
                      {isAdminClinica && (
                        <Badge variant="secondary" className="text-xs">
                          <Hospital className="h-3 w-3 mr-1" />
                          Admin Clínica
                        </Badge>
                      )}
                      {isSuperAdmin && (
                        <Badge variant="default" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          SuperAdmin
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Validarse como profesional */}
              {!isProfesional && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      ¿Eres profesional de la salud?
                    </p>
                    <Button
                      onClick={() => setShowProfesionalModal(true)}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <UserCog className="h-4 w-4 mr-2" />
                      Validarme como Profesional
                    </Button>
                  </div>
                </>
              )}

              {/* Panel SuperAdmin */}
              {isSuperAdmin && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Administración</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/superadmin")}
                      className="w-full justify-start"
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      Portal SuperAdmin
                    </Button>
                    <SuperAdminPanel />
                  </div>
                </>
              )}

              {/* Panel Admin Clínica */}
              {isAdminClinica && !isSuperAdmin && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Administración</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/admin-clinica")}
                      className="w-full justify-start"
                    >
                      <Hospital className="h-4 w-4 mr-2" />
                      Mi Clínica
                    </Button>
                  </div>
                </>
              )}
              
              <Separator />

              <Button
                variant="outline"
                size="sm"
                onClick={handleWhatsAppSupport}
                className="w-full justify-start"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Solicitar Ayuda
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="w-full justify-start text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
              
              <Separator />
              
              <div className="text-xs text-muted-foreground text-center">
                <a 
                  href="https://ingenieria365.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Esta plataforma pertenece a Ingenieria 365
                </a>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <ProfesionalClinicoModal
          open={showProfesionalModal}
          onOpenChange={setShowProfesionalModal}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      </div>
    </header>
  );
};
