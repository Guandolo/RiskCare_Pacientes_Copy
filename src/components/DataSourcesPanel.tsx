import { Upload, FileText, Calendar, Heart, Edit2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PatientProfile {
  full_name: string | null;
  identification: string;
  document_type: string;
  age: number | null;
  eps: string | null;
  phone: string | null;
  topus_data: any;
}

export const DataSourcesPanel = () => {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setPhoneValue(data.phone || "");
    } catch (error) {
      console.error('Error cargando perfil:', error);
      toast.error('Error cargando información del paciente');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneUpdate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('patient_profiles')
        .update({ phone: phoneValue })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Teléfono actualizado');
      setEditingPhone(false);
      loadProfile();
    } catch (error) {
      console.error('Error actualizando teléfono:', error);
      toast.error('Error actualizando teléfono');
    }
  };

  // Extraer datos relevantes de topus_data
  const getTopusValue = (path: string) => {
    if (!profile?.topus_data) return null;
    const keys = path.split('.');
    let value = profile.topus_data;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground mb-1">Mis Documentos Clínicos</h2>
        <p className="text-xs text-muted-foreground">Fuentes de datos consolidadas</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Patient Info Card */}
          <Card className="p-4 bg-gradient-card shadow-card border-primary/20">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Información del Paciente</h3>
                <p className="text-xs text-muted-foreground">Datos demográficos básicos</p>
              </div>
            </div>
            
            {loading ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cargando...</span>
                </div>
              </div>
            ) : profile ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nombre:</span>
                  <span className="font-medium">{profile.full_name || getTopusValue('primer_nombre') + ' ' + getTopusValue('primer_apellido')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cédula:</span>
                  <span className="font-medium">{profile.identification}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Edad:</span>
                  <span className="font-medium">{profile.age || getTopusValue('edad') || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EPS:</span>
                  <span className="font-medium">{profile.eps || getTopusValue('administradora') || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Teléfono:</span>
                  {editingPhone ? (
                    <div className="flex gap-1">
                      <Input
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        className="h-6 text-xs w-24"
                        placeholder="Celular"
                      />
                      <Button size="sm" className="h-6 px-2" onClick={handlePhoneUpdate}>
                        ✓
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingPhone(false)}>
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <span className="font-medium">{profile.phone || '-'}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => setEditingPhone(true)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </Card>

          {/* Upload Section */}
          <div className="space-y-2">
            <Button className="w-full gap-2 bg-primary hover:bg-primary-dark transition-all" size="lg">
              <Upload className="w-4 h-4" />
              Subir Documentos
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              PDF, JPG, PNG - Máx 10MB
            </p>
          </div>

          {/* Documents List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Historial Consolidado
            </h3>
            
            {/* Sample documents */}
            {[
              { type: "Laboratorio", date: "2024-03-15", name: "Hemograma completo" },
              { type: "Consulta", date: "2024-03-10", name: "Cardiología - Control" },
              { type: "Imagen", date: "2024-02-28", name: "Radiografía de tórax" },
            ].map((doc, idx) => (
              <Card key={idx} className="p-3 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{doc.type}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{doc.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
