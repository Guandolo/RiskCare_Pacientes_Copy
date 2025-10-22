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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Users, UserPlus, Trash2, Search, Heart, UserCog, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkPatientUploadModal } from "@/components/BulkPatientUploadModal";
import { BulkProfessionalUploadModal } from "@/components/BulkProfessionalUploadModal";
import { AccessLogsTable } from "@/components/AccessLogsTable";

interface Clinica {
  id: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
}

interface Paciente {
  id: string;
  paciente_user_id: string;
  profesional_asignado_user_id: string | null;
  patient_profile: {
    full_name: string | null;
    identification: string;
    age: number | null;
    eps: string | null;
  };
}

interface Profesional {
  id: string;
  profesional_user_id: string;
  profesional: {
    identification: string;
    document_type?: string | null;
    full_name: string | null;
    email?: string | null;
  };
}

export default function ClinicAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdminClinica, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPaciente, setShowAddPaciente] = useState(false);
  const [showAddProfesional, setShowAddProfesional] = useState(false);
  const [showBulkPatients, setShowBulkPatients] = useState(false);
  const [showBulkProfessionals, setShowBulkProfessionals] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pacienteDocument, setPacienteDocument] = useState("");
  const [profesionalDocument, setProfesionalDocument] = useState("");
  const [profesionalEmail, setProfesionalEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdminClinica) {
      navigate("/");
      toast.error("No tienes permisos para acceder a esta página");
    }
  }, [isAdminClinica, roleLoading, navigate]);

  useEffect(() => {
    if (user && isAdminClinica) {
      loadClinicaData();
    }
  }, [user, isAdminClinica]);

  const loadClinicaData = async () => {
    try {
      // Cargar clínica del admin
      const { data: clinicaData, error: clinicaError } = await supabase
        .from('clinicas')
        .select('*')
        .eq('admin_user_id', user!.id)
        .single();

      if (clinicaError) throw clinicaError;
      setClinica(clinicaData);

      // Cargar pacientes
      const { data: pacientesData, error: pacientesError } = await supabase
        .from('clinica_pacientes')
        .select('*')
        .eq('clinica_id', clinicaData.id);

      if (pacientesError) throw pacientesError;
      
      // Cargar perfiles de pacientes
      const pacientesWithProfiles = await Promise.all(
        (pacientesData || []).map(async (cp) => {
          const { data: profile } = await supabase
            .from('patient_profiles')
            .select('full_name, identification, age, eps, topus_data')
            .eq('user_id', cp.paciente_user_id)
            .maybeSingle();
          
          const displayName = (profile?.full_name 
            || (profile as any)?.topus_data?.result?.nombre_completo
            || [
              (profile as any)?.topus_data?.result?.nombre,
              (profile as any)?.topus_data?.result?.s_nombre,
              (profile as any)?.topus_data?.result?.apellido,
              (profile as any)?.topus_data?.result?.s_apellido,
            ].filter(Boolean).join(' ').trim()) ?? null;
          
          return {
            ...cp,
            patient_profile: profile 
              ? { ...profile, full_name: displayName }
              : { full_name: null, identification: '', age: null, eps: null }
          };
        })
      );
      
      setPacientes(pacientesWithProfiles);

      // Cargar profesionales (via backend para obtener email y datos)
      const { data: { session } } = await supabase.auth.getSession();
      const { data: listData, error: listError } = await supabase.functions.invoke('list-clinic-professionals', {
        body: { clinicaId: clinicaData.id },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });
      if (listError) throw listError;
      setProfesionales(listData?.data || []);
    } catch (error: any) {
      console.error('Error loading clinic data:', error);
      toast.error("Error al cargar datos de la clínica");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaciente = async () => {
    if (!pacienteDocument.trim()) {
      toast.error("Por favor ingresa el documento del paciente");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no disponible');

      // Validar y enriquecer con Topus
      const { data: topusResp, error: topusErr } = await supabase.functions.invoke('fetch-topus-data', {
        body: { documentType: 'CC', identification: pacienteDocument.trim() },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (topusErr) throw topusErr;

      const topusData = topusResp?.data ?? null;

      // Crear/asociar mediante backend (evita problemas de RLS)
      const { error: createErr } = await supabase.functions.invoke('admin-create-patient', {
        body: {
          clinicaId: clinica!.id,
          documentType: 'CC',
          identification: pacienteDocument.trim(),
          topusData,
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (createErr) throw createErr;

      toast.success("Paciente agregado exitosamente");
      setShowAddPaciente(false);
      setPacienteDocument("");
      await loadClinicaData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al agregar paciente");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddProfesional = async () => {
    if (!profesionalDocument.trim()) {
      toast.error("Por favor ingresa el documento del profesional");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no disponible');

      const body: any = {
        clinicaId: clinica!.id,
        documentType: 'CC',
        identification: profesionalDocument.trim(),
      };
      if (profesionalEmail.trim()) body.email = profesionalEmail.trim();

      const { error: proErr } = await supabase.functions.invoke('admin-create-professional', {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (proErr) throw proErr;

      toast.success("Profesional agregado exitosamente");
      setShowAddProfesional(false);
      setProfesionalDocument("");
      setProfesionalEmail("");
      await loadClinicaData();
    } catch (error: any) {
      console.error('Error:', error);
      const msg = error?.message || "Error al agregar profesional";
      if (msg.toLowerCase().includes('email') && !profesionalEmail.trim()) {
        toast.error("Si el profesional no existe aún, debes ingresar su email para crearlo.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };
  const handleRemovePaciente = async (id: string) => {
    if (!confirm("¿Estás seguro de remover este paciente?")) return;

    try {
      const { error } = await supabase
        .from('clinica_pacientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Paciente removido exitosamente");
      loadClinicaData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al remover paciente");
    }
  };

  const handleRemoveProfesional = async (id: string) => {
    if (!confirm("¿Estás seguro de remover este profesional?")) return;

    try {
      const { error } = await supabase
        .from('clinica_profesionales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Profesional removido exitosamente");
      loadClinicaData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al remover profesional");
    }
  };

  const filteredPacientes = pacientes.filter(p =>
    p.patient_profile?.identification?.includes(searchTerm) ||
    p.patient_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProfesionales = profesionales.filter(p =>
    p.profesional?.identification?.includes(searchTerm) ||
    p.profesional?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || roleLoading || !isAdminClinica) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{clinica?.nombre}</h1>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {clinica?.nit && (
              <div className="text-sm">
                <span className="text-muted-foreground">NIT:</span>
                <span className="ml-2 font-medium">{clinica.nit}</span>
              </div>
            )}
            {clinica?.telefono && (
              <div className="text-sm">
                <span className="text-muted-foreground">Teléfono:</span>
                <span className="ml-2 font-medium">{clinica.telefono}</span>
              </div>
            )}
            {clinica?.email && (
              <div className="text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-2 font-medium">{clinica.email}</span>
              </div>
            )}
            {clinica?.direccion && (
              <div className="text-sm">
                <span className="text-muted-foreground">Dirección:</span>
                <span className="ml-2 font-medium">{clinica.direccion}</span>
              </div>
            )}
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por documento o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </Card>

        <Tabs defaultValue="pacientes" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pacientes">
              <Heart className="h-4 w-4 mr-2" />
              Pacientes ({pacientes.length})
            </TabsTrigger>
            <TabsTrigger value="profesionales">
              <UserCog className="h-4 w-4 mr-2" />
              Profesionales ({profesionales.length})
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Search className="h-4 w-4 mr-2" />
              Registro de Accesos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pacientes" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Pacientes Asignados</h2>
              <div className="flex gap-2">
                <Button onClick={() => setShowBulkPatients(true)} variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Carga Masiva
                </Button>
                <Button onClick={() => setShowAddPaciente(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar Paciente
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {filteredPacientes.map((paciente) => (
                <Card key={paciente.id} className="p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {paciente.patient_profile?.full_name || "Sin nombre"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          CC: {paciente.patient_profile?.identification}
                        </span>
                        {paciente.patient_profile?.eps && (
                          <span className="text-xs text-muted-foreground">
                            EPS: {paciente.patient_profile.eps}
                          </span>
                        )}
                        {paciente.patient_profile?.age && (
                          <span className="text-xs text-muted-foreground">
                            {paciente.patient_profile.age} años
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemovePaciente(paciente.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
              {filteredPacientes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No hay pacientes registrados
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="profesionales" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Profesionales</h2>
              <div className="flex gap-2">
                <Button onClick={() => setShowAddProfesional(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar Profesional
                </Button>
                <Button variant="outline" onClick={() => setShowBulkProfessionals(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Carga Masiva
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredProfesionales.map((profesional) => (
                <Card key={profesional.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {profesional.profesional?.full_name || "Sin nombre"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {profesional.profesional?.document_type || 'DOC'}: {profesional.profesional?.identification}
                      </p>
                      {profesional.profesional?.email && (
                        <p className="text-sm text-muted-foreground">Email: {profesional.profesional.email}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveProfesional(profesional.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
              {filteredProfesionales.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No hay profesionales registrados
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            {clinica && <AccessLogsTable clinicaId={clinica.id} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Carga Masiva Pacientes */}
      {clinica && (
        <BulkPatientUploadModal
          open={showBulkPatients}
          onOpenChange={setShowBulkPatients}
          clinicaId={clinica.id}
          onSuccess={loadClinicaData}
        />
      )}

      {/* Modal de Carga Masiva Profesionales */}
      {clinica && (
        <BulkProfessionalUploadModal
          open={showBulkProfessionals}
          onOpenChange={setShowBulkProfessionals}
          clinicaId={clinica.id}
          onSuccess={loadClinicaData}
        />
      )}

      {/* Dialog para agregar paciente individual */}
      <Dialog open={showAddPaciente} onOpenChange={setShowAddPaciente}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Paciente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="pacienteDoc">Documento del Paciente *</Label>
              <Input
                id="pacienteDoc"
                value={pacienteDocument}
                onChange={(e) => setPacienteDocument(e.target.value)}
                placeholder="Número de cédula"
              />
              <p className="text-xs text-muted-foreground mt-1">
                El paciente debe estar registrado en la plataforma
              </p>
            </div>

            <Button onClick={handleAddPaciente} disabled={submitting} className="w-full">
              {submitting ? "Agregando..." : "Agregar Paciente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddProfesional} onOpenChange={setShowAddProfesional}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Profesional</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="profesionalDoc">Documento del Profesional *</Label>
              <Input
                id="profesionalDoc"
                value={profesionalDocument}
                onChange={(e) => setProfesionalDocument(e.target.value)}
                placeholder="Número de cédula"
              />
              <p className="text-xs text-muted-foreground mt-1">
                El profesional debe estar registrado y validado en RETHUS
              </p>
            </div>

            <div>
              <Label htmlFor="profesionalEmail">Email del Profesional</Label>
              <Input
                id="profesionalEmail"
                type="email"
                required
                value={profesionalEmail}
                onChange={(e) => setProfesionalEmail(e.target.value)}
                placeholder="usuario@correo.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obligatorio solo si el profesional aún no existe en la plataforma.
              </p>
            </div>

            <Button onClick={handleAddProfesional} disabled={submitting} className="w-full">
              {submitting ? "Agregando..." : "Agregar Profesional"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
