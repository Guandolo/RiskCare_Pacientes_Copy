import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Users, Edit2, Trash2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Clinica {
  id: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  admin_user_id: string;
  created_at: string;
}

export default function SuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClinica, setEditingClinica] = useState<Clinica | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [clinicaData, setClinicaData] = useState({
    nombre: "",
    nit: "",
    direccion: "",
    telefono: "",
    email: "",
    adminDocument: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) {
      navigate("/");
      toast.error("No tienes permisos para acceder a esta página");
    }
  }, [isSuperAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadClinicas();
    }
  }, [isSuperAdmin]);

  const loadClinicas = async () => {
    try {
      const { data, error } = await supabase
        .from('clinicas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClinicas(data || []);
    } catch (error) {
      console.error('Error loading clinicas:', error);
      toast.error("Error al cargar clínicas");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!clinicaData.nombre || !clinicaData.adminDocument) {
      toast.error("Nombre y documento del administrador son requeridos");
      return;
    }

    setSubmitting(true);
    try {
      const { data: adminUser, error: userError } = await supabase
        .from('patient_profiles')
        .select('user_id')
        .eq('identification', clinicaData.adminDocument)
        .single();

      if (userError || !adminUser) {
        toast.error("No se encontró un usuario con ese documento");
        setSubmitting(false);
        return;
      }

      if (editingClinica) {
        // Update
        const { error } = await supabase
          .from('clinicas')
          .update({
            nombre: clinicaData.nombre,
            nit: clinicaData.nit,
            direccion: clinicaData.direccion,
            telefono: clinicaData.telefono,
            email: clinicaData.email,
            admin_user_id: adminUser.user_id
          })
          .eq('id', editingClinica.id);

        if (error) throw error;
        toast.success("Clínica actualizada exitosamente");
      } else {
        // Create
        const { error } = await supabase
          .from('clinicas')
          .insert({
            nombre: clinicaData.nombre,
            nit: clinicaData.nit,
            direccion: clinicaData.direccion,
            telefono: clinicaData.telefono,
            email: clinicaData.email,
            admin_user_id: adminUser.user_id
          });

        if (error) throw error;

        await supabase
          .from('user_roles')
          .insert({
            user_id: adminUser.user_id,
            role: 'admin_clinica'
          });

        toast.success("Clínica creada exitosamente");
      }

      setShowCreateModal(false);
      setEditingClinica(null);
      setClinicaData({
        nombre: "",
        nit: "",
        direccion: "",
        telefono: "",
        email: "",
        adminDocument: ""
      });
      loadClinicas();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al guardar clínica");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (clinica: Clinica) => {
    setEditingClinica(clinica);
    setClinicaData({
      nombre: clinica.nombre,
      nit: clinica.nit || "",
      direccion: clinica.direccion || "",
      telefono: clinica.telefono || "",
      email: clinica.email || "",
      adminDocument: ""
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta clínica?")) return;

    try {
      const { error } = await supabase
        .from('clinicas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Clínica eliminada exitosamente");
      loadClinicas();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al eliminar clínica");
    }
  };

  const filteredClinicas = clinicas.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || roleLoading || !isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Portal SuperAdmin</h1>
            <p className="text-muted-foreground mt-1">Gestión de clínicas y administradores</p>
          </div>
          <Button onClick={() => {
            setEditingClinica(null);
            setClinicaData({
              nombre: "",
              nit: "",
              direccion: "",
              telefono: "",
              email: "",
              adminDocument: ""
            });
            setShowCreateModal(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Clínica
          </Button>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o NIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Cargando clínicas...</p>
          </div>
        ) : filteredClinicas.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay clínicas registradas</h3>
            <p className="text-muted-foreground mb-4">Crea la primera clínica para comenzar</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Clínica
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredClinicas.map((clinica) => (
              <Card key={clinica.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{clinica.nombre}</h3>
                      <Badge variant="secondary">Activa</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {clinica.nit && (
                        <div>
                          <span className="text-muted-foreground">NIT:</span>
                          <span className="ml-2 font-medium">{clinica.nit}</span>
                        </div>
                      )}
                      {clinica.telefono && (
                        <div>
                          <span className="text-muted-foreground">Teléfono:</span>
                          <span className="ml-2 font-medium">{clinica.telefono}</span>
                        </div>
                      )}
                      {clinica.email && (
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <span className="ml-2 font-medium">{clinica.email}</span>
                        </div>
                      )}
                      {clinica.direccion && (
                        <div>
                          <span className="text-muted-foreground">Dirección:</span>
                          <span className="ml-2 font-medium">{clinica.direccion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(clinica)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(clinica.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClinica ? "Editar Clínica" : "Crear Nueva Clínica/IPS"}
            </DialogTitle>
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
              <Label htmlFor="adminDocument">Documento del Administrador *</Label>
              <Input
                id="adminDocument"
                value={clinicaData.adminDocument}
                onChange={(e) => setClinicaData({ ...clinicaData, adminDocument: e.target.value })}
                placeholder="Documento de identidad"
              />
              <p className="text-xs text-muted-foreground mt-1">
                El usuario debe estar registrado en la plataforma
              </p>
            </div>

            <Button onClick={handleCreateOrUpdate} disabled={submitting} className="w-full">
              {submitting ? "Guardando..." : editingClinica ? "Actualizar Clínica" : "Crear Clínica"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
