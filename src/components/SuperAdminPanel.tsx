import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, UserPlus, Users, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export const SuperAdminPanel = () => {
  const { isSuperAdmin, loading } = useUserRole();
  const [showCreateClinica, setShowCreateClinica] = useState(false);
  const [clinicaData, setClinicaData] = useState({
    nombre: "",
    nit: "",
    direccion: "",
    telefono: "",
    email: "",
    adminEmail: ""
  });
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (!isSuperAdmin) return null;

  const handleCreateClinica = async () => {
    console.log('=== INICIO handleCreateClinica ===');
    console.log('Datos de clínica:', clinicaData);
    
    if (!clinicaData.nombre || !clinicaData.adminEmail) {
      console.log('Validación fallida - falta nombre o documento');
      toast.error("Nombre y documento del administrador son requeridos");
      return;
    }

    setSubmitting(true);
    try {
      console.log('Buscando usuario con documento:', clinicaData.adminEmail);
      
      // Buscar usuario por documento de identidad
      const { data: adminUser, error: userError } = await supabase
        .from('patient_profiles')
        .select('user_id')
        .eq('identification', clinicaData.adminEmail)
        .single();

      console.log('Resultado búsqueda usuario:', { adminUser, userError });

      if (userError || !adminUser) {
        toast.error("No se encontró un usuario con ese documento. El administrador debe estar registrado primero.");
        setSubmitting(false);
        return;
      }

      console.log('Creando clínica con admin_user_id:', adminUser.user_id);

      // Crear clínica
      const { data: clinica, error: clinicaError } = await supabase
        .from('clinicas')
        .insert({
          nombre: clinicaData.nombre,
          nit: clinicaData.nit,
          direccion: clinicaData.direccion,
          telefono: clinicaData.telefono,
          email: clinicaData.email,
          admin_user_id: adminUser.user_id
        })
        .select()
        .single();

      console.log('Resultado creación clínica:', { clinica, clinicaError });

      if (clinicaError) throw clinicaError;

      console.log('Asignando rol admin_clinica al usuario:', adminUser.user_id);

      // Asignar rol de admin_clinica al usuario
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: adminUser.user_id,
          role: 'admin_clinica'
        });

      console.log('Resultado asignación rol:', { roleError });

      if (roleError) throw roleError;

      toast.success("Clínica creada exitosamente");
      setShowCreateClinica(false);
      setClinicaData({
        nombre: "",
        nit: "",
        direccion: "",
        telefono: "",
        email: "",
        adminEmail: ""
      });
    } catch (error: any) {
      console.error('Error creating clinica:', error);
      toast.error(error.message || "Error al crear clínica");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Button onClick={() => setShowCreateClinica(true)} variant="outline" size="sm" className="w-full">
          <Building2 className="h-4 w-4 mr-2" />
          Crear Nueva Clínica/IPS
        </Button>
      </div>

      <Dialog open={showCreateClinica} onOpenChange={setShowCreateClinica}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Clínica/IPS</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre de la Clínica *</Label>
              <Input
                id="nombre"
                value={clinicaData.nombre}
                onChange={(e) => setClinicaData({ ...clinicaData, nombre: e.target.value })}
                placeholder="Ej: Clínica Santa María"
              />
            </div>

            <div>
              <Label htmlFor="nit">NIT</Label>
              <Input
                id="nit"
                value={clinicaData.nit}
                onChange={(e) => setClinicaData({ ...clinicaData, nit: e.target.value })}
                placeholder="Ej: 900123456-1"
              />
            </div>

            <div>
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={clinicaData.direccion}
                onChange={(e) => setClinicaData({ ...clinicaData, direccion: e.target.value })}
                placeholder="Ej: Calle 123 #45-67"
              />
            </div>

            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={clinicaData.telefono}
                onChange={(e) => setClinicaData({ ...clinicaData, telefono: e.target.value })}
                placeholder="Ej: 3001234567"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={clinicaData.email}
                onChange={(e) => setClinicaData({ ...clinicaData, email: e.target.value })}
                placeholder="contacto@clinica.com"
              />
            </div>

            <div>
              <Label htmlFor="adminEmail">Documento del Administrador *</Label>
              <Input
                id="adminEmail"
                value={clinicaData.adminEmail}
                onChange={(e) => setClinicaData({ ...clinicaData, adminEmail: e.target.value })}
                placeholder="Documento de identidad del admin"
              />
              <p className="text-xs text-muted-foreground mt-1">
                El usuario debe estar registrado en la plataforma
              </p>
            </div>

            <Button onClick={handleCreateClinica} disabled={submitting} className="w-full">
              {submitting ? "Creando..." : "Crear Clínica"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};