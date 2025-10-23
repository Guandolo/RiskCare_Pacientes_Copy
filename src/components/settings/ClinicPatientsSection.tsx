import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Search, Upload } from "lucide-react";
import { BulkPatientUploadModal } from "@/components/BulkPatientUploadModal";

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

export const ClinicPatientsSection = () => {
  const { user } = useAuth();
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPaciente, setShowAddPaciente] = useState(false);
  const [showBulkPatients, setShowBulkPatients] = useState(false);
  const [pacienteDocument, setPacienteDocument] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Get clinic ID
      const { data: clinicaData, error: clinicaError } = await supabase
        .from('clinicas')
        .select('id')
        .eq('admin_user_id', user!.id)
        .single();

      if (clinicaError) throw clinicaError;
      setClinicaId(clinicaData.id);

      // Load patients
      const { data: pacientesData, error: pacientesError } = await supabase
        .from('clinica_pacientes')
        .select('*')
        .eq('clinica_id', clinicaData.id);

      if (pacientesError) throw pacientesError;

      // Load patient profiles
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
    } catch (error: any) {
      console.error('Error loading patients:', error);
      toast.error("Error al cargar pacientes");
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

      // Validate with Topus
      const { data: topusResp, error: topusErr } = await supabase.functions.invoke('fetch-topus-data', {
        body: { documentType: 'CC', identification: pacienteDocument.trim() },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (topusErr) throw topusErr;

      const topusData = topusResp?.data ?? null;

      // Create/associate via backend
      const { error: createErr } = await supabase.functions.invoke('admin-create-patient', {
        body: {
          clinicaId: clinicaId,
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
      await loadData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al agregar paciente");
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
      loadData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al remover paciente");
    }
  };

  const filteredPacientes = pacientes.filter(p =>
    p.patient_profile?.identification?.includes(searchTerm) ||
    p.patient_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pacientes Asignados</h1>
        <p className="text-muted-foreground mt-1">Gestión de pacientes vinculados a tu clínica</p>
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

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {filteredPacientes.length} paciente(s) encontrado(s)
        </div>
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
          <Card key={paciente.id} className="p-4">
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
          <Card className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No hay pacientes</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No se encontraron pacientes con ese criterio" : "Aún no has agregado pacientes a tu clínica"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowAddPaciente(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar Primer Paciente
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Bulk Upload Modal */}
      {clinicaId && (
        <BulkPatientUploadModal
          open={showBulkPatients}
          onOpenChange={setShowBulkPatients}
          clinicaId={clinicaId}
          onSuccess={loadData}
        />
      )}

      {/* Add Patient Modal */}
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
    </div>
  );
};
