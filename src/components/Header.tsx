import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Sun, Moon, LogOut, MessageCircle, UserCog, Hospital, Shield, Building2, GraduationCap, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import riskCareIcon from "@/assets/riskcare-icon.png";
import { ProfesionalClinicoModal } from "./ProfesionalClinicoModal";
import { ViewProfesionalDataModal } from "./ViewProfesionalDataModal";
import { SuperAdminPanel } from "./SuperAdminPanel";
import { PatientSearchModal } from "./PatientSearchModal";
import { ShareHistoryModal } from "./ShareHistoryModal";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useProfesionalContext } from "@/hooks/useProfesionalContext";
import { useActivePatient } from "@/hooks/useActivePatient";
import { Users } from "lucide-react";

export const Header = () => {
  const { user, signOut } = useAuth();
  const { roles, isProfesional, isAdminClinica, isSuperAdmin } = useUserRole();
  const { setPatientContext } = useProfesionalContext();
  const { activePatient, setActivePatient } = useActivePatient();
  const [showProfesionalModal, setShowProfesionalModal] = useState(false);
  const [showViewDataModal, setShowViewDataModal] = useState(false);
  const [showPatientSearchModal, setShowPatientSearchModal] = useState(false);
  const [showShareHistoryModal, setShowShareHistoryModal] = useState(false);
  const [profesionalData, setProfesionalData] = useState<any>(null);
  const [fullRethusData, setFullRethusData] = useState<any>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const fetchProfesionalData = async () => {
      if (!isProfesional || !user) return;

      try {
        const { data, error } = await supabase
          .from('profesionales_clinicos')
          .select('rethus_data, fecha_validacion')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        
        // Guardar datos completos para el modal de vista
        setFullRethusData(data?.rethus_data);
        
        // Extraer información del último registro académico
        const rethusData = data?.rethus_data as any;
        console.log('RETHUS Data completo:', rethusData);
        
        if (rethusData?.datos_academicos && Array.isArray(rethusData.datos_academicos) && rethusData.datos_academicos.length > 0) {
          const ultimoDato = rethusData.datos_academicos[0];
          console.log('Último dato académico:', ultimoDato);
          
          setProfesionalData({
            profesion: ultimoDato.profesion_u_ocupacion || 'No especificada',
            especialidad: ultimoDato.tipo_programa || 'No especificada',
            registroProfesional: ultimoDato.acto_administrativo || 'No especificado',
            institucion: ultimoDato.entidad_reportadora || 'No especificada',
            totalTitulos: rethusData.datos_academicos.length,
            fechaValidacion: data.fecha_validacion
          });
        } else {
          console.warn('No se encontraron datos académicos en rethus_data');
        }
      } catch (error) {
        console.error('Error fetching professional data:', error);
      }
    };

    fetchProfesionalData();
  }, [isProfesional, user]);

  const handlePatientSelected = async (patientUserId: string, clinicaId: string) => {
    // El setPatientContext del store ya maneja todo:
    // 1. Actualiza el contexto en BD
    // 2. Actualiza el estado local en el store
    // 3. Carga el perfil completo del paciente
    await setPatientContext(patientUserId, clinicaId);
    
    // Verificar que se haya cargado correctamente
    if (activePatient?.user_id === patientUserId) {
      toast.success(`Paciente activo: ${activePatient.full_name || 'Sin nombre'}`);
    } else {
      // Dar un poco de tiempo para que el store se actualice
      setTimeout(() => {
        const patient = activePatient;
        if (patient?.user_id === patientUserId) {
          toast.success(`Paciente activo: ${patient.full_name || 'Sin nombre'}`);
        }
      }, 100);
    }
  };


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
                    
                    {isProfesional && profesionalData && (
                      <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <GraduationCap className="h-3.5 w-3.5" />
                            <span>Información Profesional</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowViewDataModal(true)}
                              className="h-auto py-1 px-2 text-xs"
                            >
                              Ver Datos
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowProfesionalModal(true)}
                              className="h-auto py-1 px-2 text-xs"
                            >
                              Actualizar
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 ml-5">
                          {profesionalData.profesion && profesionalData.profesion !== 'No especificada' && (
                            <p><strong>Profesión:</strong> {profesionalData.profesion}</p>
                          )}
                          {profesionalData.registroProfesional && profesionalData.registroProfesional !== 'No especificado' && (
                            <p><strong>Registro:</strong> {profesionalData.registroProfesional}</p>
                          )}
                          {profesionalData.fechaValidacion && (
                            <p className="text-[10px] mt-1 pt-1 border-t opacity-70">
                              Última validación: {new Date(profesionalData.fechaValidacion).toLocaleDateString('es-CO')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
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
                      onClick={() => navigate("/settings?section=manage-clinics")}
                      className="w-full justify-start"
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      Administración Global
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
                      onClick={() => navigate("/settings?section=clinic-info")}
                      className="w-full justify-start"
                    >
                      <Hospital className="h-4 w-4 mr-2" />
                      Configuración de Clínica
                    </Button>
                  </div>
                </>
              )}
              
              <Separator />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareHistoryModal(true)}
                className="w-full justify-start"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Compartir Mi Historial
              </Button>

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
          isRevalidation={isProfesional}
          onSuccess={() => {
            window.location.reload();
          }}
        />

        {/* Modal de Ver Datos Profesionales */}
        {fullRethusData && profesionalData && (
          <ViewProfesionalDataModal
            open={showViewDataModal}
            onOpenChange={setShowViewDataModal}
            rethusData={fullRethusData}
            fechaValidacion={profesionalData.fechaValidacion}
          />
        )}

        {/* Modal de Búsqueda de Paciente (solo para profesionales) */}
        {isProfesional && user && (
          <PatientSearchModal
            open={showPatientSearchModal}
            onOpenChange={setShowPatientSearchModal}
            onPatientSelected={handlePatientSelected}
            profesionalUserId={user.id}
          />
        )}

        {/* Modal de Compartir Historial */}
        <ShareHistoryModal
          open={showShareHistoryModal}
          onOpenChange={setShowShareHistoryModal}
        />
      </div>
    </header>
  );
};
