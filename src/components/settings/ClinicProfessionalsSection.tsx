import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCog, UserPlus, Trash2, Search, Upload } from "lucide-react";
import { BulkProfessionalUploadModal } from "@/components/BulkProfessionalUploadModal";

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

export const ClinicProfessionalsSection = () => {
  const { user } = useAuth();
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddProfesional, setShowAddProfesional] = useState(false);
  const [showBulkProfessionals, setShowBulkProfessionals] = useState(false);
  const [profesionalDocument, setProfesionalDocument] = useState("");
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

      // Load professionals via backend
      const { data: { session } } = await supabase.auth.getSession();
      const { data: listData, error: listError } = await supabase.functions.invoke('list-clinic-professionals', {
        body: { clinicaId: clinicaData.id },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });
      if (listError) throw listError;
      setProfesionales(listData?.data || []);
    } catch (error: any) {
      console.error('Error loading professionals:', error);
      toast.error("Error al cargar profesionales");
    } finally {
      setLoading(false);
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

      const { data, error: proErr } = await supabase.functions.invoke('admin-associate-professional', {
        body: {
          clinicaId: clinicaId,
          numeroDocumento: profesionalDocument.trim(),
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (proErr) {
        const errorCode = proErr.context?.code || proErr.code;
        const errorMessage = proErr.message || "Error al asociar profesional";
        
        if (errorCode === 'PROFESSIONAL_NOT_FOUND') {
          toast.error("No se encontró un profesional clínico registrado con el documento ingresado. Por favor, verifique el número o indique al profesional que debe completar su registro y validación en la plataforma.");
        } else if (errorCode === 'ALREADY_ASSOCIATED') {
          toast.error(errorMessage);
        } else if (errorCode === 'NOT_PROFESSIONAL_ROLE') {
          toast.error("El usuario encontrado no tiene el rol de profesional clínico. Por favor, verifique el documento.");
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      const successMessage = data?.message || "Profesional asociado exitosamente";
      toast.success(successMessage);
      
      setShowAddProfesional(false);
      setProfesionalDocument("");
      await loadData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error("Ocurrió un error inesperado al intentar agregar al profesional. Por favor, intente más tarde.");
    } finally {
      setSubmitting(false);
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
      loadData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Error al remover profesional");
    }
  };

  const filteredProfesionales = profesionales.filter(p =>
    p.profesional?.identification?.includes(searchTerm) ||
    p.profesional?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1 className="text-3xl font-bold">Profesionales de Clínica</h1>
        <p className="text-muted-foreground mt-1">Gestión de profesionales clínicos de tu clínica</p>
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
          {filteredProfesionales.length} profesional(es) encontrado(s)
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddProfesional(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Asociar Profesional
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCog className="h-5 w-5 text-primary" />
                </div>
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
          <Card className="p-12 text-center">
            <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No hay profesionales</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No se encontraron profesionales con ese criterio" : "Aún no has asociado profesionales a tu clínica"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowAddProfesional(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Asociar Primer Profesional
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Bulk Upload Modal */}
      {clinicaId && (
        <BulkProfessionalUploadModal
          open={showBulkProfessionals}
          onOpenChange={setShowBulkProfessionals}
          clinicaId={clinicaId}
          onSuccess={loadData}
        />
      )}

      {/* Add Professional Modal */}
      <Dialog open={showAddProfesional} onOpenChange={setShowAddProfesional}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asociar Profesional</DialogTitle>
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
                Ingrese el documento del profesional clínico que desea agregar a su clínica.
              </p>
            </div>

            <Button onClick={handleAddProfesional} disabled={submitting} className="w-full">
              {submitting ? "Asociando..." : "Asociar Profesional"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
