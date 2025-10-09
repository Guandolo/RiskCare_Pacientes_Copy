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
              <div className="space-y-3 text-xs">
                {/* Nombre completo */}
                <div className="pb-2 border-b border-border/50">
                  <div className="text-base font-bold text-foreground">
                    {getTopusValue('result.nombre')} {getTopusValue('result.s_nombre')} {getTopusValue('result.apellido')} {getTopusValue('result.s_apellido')}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Cédula de Ciudadanía: {profile.identification}
                  </div>
                </div>

                {/* Fila 1: Estado y Sexo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground mb-1">Estado</div>
                    <div className="font-medium">{getTopusValue('result.estado') || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Sexo</div>
                    <div className="font-medium">{getTopusValue('result.sexo') || 'N/A'}</div>
                  </div>
                </div>

                {/* Fila 2: Edad y Fecha de Nacimiento */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground mb-1">Edad</div>
                    <div className="font-medium">{getTopusValue('result.edad')} años</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Fecha de Nacimiento</div>
                    <div className="font-medium">{getTopusValue('result.fecha_nacimiento') || 'N/A'}</div>
                  </div>
                </div>

                {/* Fila 3: Ubicación */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground mb-1">Ubicación</div>
                    <div className="font-medium">
                      {getTopusValue('result.municipio_id')}, {getTopusValue('result.departamento_id')}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Estado Afiliación</div>
                    <div className="font-medium text-[10px] leading-tight">
                      {getTopusValue('result.estado_afiliacion') || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Fila 4: EPS y Tipo Régimen */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground mb-1">EPS</div>
                    <div className="font-medium">{getTopusValue('result.eps') || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Tipo Régimen</div>
                    <div className="font-medium text-[10px] leading-tight">
                      {getTopusValue('result.eps_tipo') || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Fila 5: Código EPS y EPS Homologada */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground mb-1">Código EPS</div>
                    <div className="font-medium">{getTopusValue('result.eps_codigo') || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">EPS Homologada</div>
                    <div className="font-medium text-[10px] leading-tight">
                      {getTopusValue('result.eps_homologada') || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Fila 6: NIT Homologado y Teléfono */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground mb-1">NIT Homologado</div>
                    <div className="font-medium">{getTopusValue('result.nit_homologado') || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Teléfono</div>
                    {editingPhone ? (
                      <div className="flex gap-1">
                        <Input
                          value={phoneValue}
                          onChange={(e) => setPhoneValue(e.target.value)}
                          className="h-6 text-xs"
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
                        <span className="font-medium">{profile.phone || 'Sin registrar'}</span>
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
