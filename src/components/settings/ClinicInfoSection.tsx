import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Mail, Phone, MapPin, FileText } from "lucide-react";

interface Clinica {
  id: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
}

export const ClinicInfoSection = () => {
  const { user } = useAuth();
  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadClinicaData();
    }
  }, [user]);

  const loadClinicaData = async () => {
    try {
      const { data, error } = await supabase
        .from('clinicas')
        .select('*')
        .eq('admin_user_id', user!.id)
        .single();

      if (error) throw error;
      setClinica(data);
    } catch (error: any) {
      console.error('Error loading clinic data:', error);
      toast.error("Error al cargar datos de la clínica");
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

  if (!clinica) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se encontró información de la clínica
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Información General</h1>
        <p className="text-muted-foreground mt-1">Información básica de tu clínica o IPS</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{clinica.nombre}</h2>
            <p className="text-sm text-muted-foreground">Clínica / IPS</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clinica.nit && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NIT</p>
                <p className="font-medium">{clinica.nit}</p>
              </div>
            </div>
          )}

          {clinica.telefono && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="font-medium">{clinica.telefono}</p>
              </div>
            </div>
          )}

          {clinica.email && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{clinica.email}</p>
              </div>
            </div>
          )}

          {clinica.direccion && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dirección</p>
                <p className="font-medium">{clinica.direccion}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
