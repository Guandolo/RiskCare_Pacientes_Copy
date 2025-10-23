import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AccessLogsTable } from "@/components/AccessLogsTable";

export const ClinicAccessLogsSection = () => {
  const { user } = useAuth();
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadClinicaId();
    }
  }, [user]);

  const loadClinicaId = async () => {
    try {
      const { data, error } = await supabase
        .from('clinicas')
        .select('id')
        .eq('admin_user_id', user!.id)
        .single();

      if (error) throw error;
      setClinicaId(data.id);
    } catch (error: any) {
      console.error('Error loading clinic ID:', error);
      toast.error("Error al cargar información de la clínica");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!clinicaId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se encontró información de la clínica
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Registro de Accesos</h1>
        <p className="text-muted-foreground mt-1">Auditoría de accesos a los datos de pacientes</p>
      </div>

      <AccessLogsTable clinicaId={clinicaId} />
    </div>
  );
};
