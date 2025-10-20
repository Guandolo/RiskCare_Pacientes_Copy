import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { ProfesionalClinicoModal } from "./ProfesionalClinicoModal";
import { UserCog, Hospital, Shield } from "lucide-react";

export const RoleActions = () => {
  const { roles, isProfesional, isAdminClinica, isSuperAdmin, loading } = useUserRole();
  const [showProfesionalModal, setShowProfesionalModal] = useState(false);

  if (loading) return null;

  return (
    <>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Mis Roles</h3>
          {roles.length > 0 && (
            <div className="flex gap-1 flex-wrap">
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
          )}
        </div>

        {!isProfesional && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              ¿Eres profesional de la salud? Valida tus credenciales para acceder a funciones avanzadas
            </p>
            <Button
              onClick={() => setShowProfesionalModal(true)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <UserCog className="h-4 w-4 mr-2" />
              Validarme como Profesional
            </Button>
          </div>
        )}
      </Card>

      <ProfesionalClinicoModal
        open={showProfesionalModal}
        onOpenChange={setShowProfesionalModal}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </>
  );
};