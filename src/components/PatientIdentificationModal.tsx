import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PT", label: "Permiso por Protección Temporal" },
];

interface PatientIdentificationModalProps {
  open: boolean;
  onComplete: () => void;
  userId: string;
}

export const PatientIdentificationModal = ({ open, onComplete, userId }: PatientIdentificationModalProps) => {
  const [documentType, setDocumentType] = useState("CC");
  const [identification, setIdentification] = useState("");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");

  const fetchTopusData = async () => {
    const { data, error } = await supabase.functions.invoke('fetch-topus-data', {
      body: { documentType, identification }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Error al consultar Topus');
    
    return data.data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identification.trim()) {
      toast.error("Por favor ingresa tu número de documento");
      return;
    }

    setLoading(true);
    try {
      // Verificar si ya existe un perfil con este documento
      const { data: existingByDoc } = await supabase
        .from("patient_profiles")
        .select("user_id")
        .eq("identification", identification)
        .maybeSingle();

      if (existingByDoc && existingByDoc.user_id !== userId) {
        toast.error("Este número de documento ya está registrado con otra cuenta. Si crees que es un error, por favor contacta a soporte.");
        setLoading(false);
        return;
      }

      // Verificar si ya existe perfil para este usuario
      const { data: existingProfile } = await supabase
        .from("patient_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        toast.success("Perfil ya existe, cargando...");
        window.dispatchEvent(new CustomEvent('profileUpdated'));
        onComplete();
        setLoading(false);
        return;
      }

      // Consultar datos de TOPUS
      toast.info("Consultando tus datos en ADRES...");
      const topusResult = await fetchTopusData();
      
      // Confirmar sesión y obtener user id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Debes iniciar sesión nuevamente.');
        setLoading(false);
        return;
      }

      // Guardar perfil en la base de datos con is_verified = false (no verificado inicialmente)
      const { error } = await supabase
        .from("patient_profiles")
        .insert({
          user_id: user.id,
          document_type: documentType,
          identification: identification,
          topus_data: topusResult,
          full_name: topusResult?.result?.nombre_completo || null,
          age: topusResult?.result?.edad || null,
          eps: topusResult?.result?.eps || null,
          phone: phone || null,
        });

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('unique_user_id')) {
            toast.error("Ya existe un perfil asociado a esta cuenta");
          } else if (error.message.includes('identification')) {
            toast.error("Este número de documento ya está registrado");
          }
          return;
        }
        throw error;
      }

      // Asignar rol de paciente
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: 'paciente'
        }, {
          onConflict: 'user_id,role',
          ignoreDuplicates: true
        });

      if (roleError) {
        console.error('Error asignando rol:', roleError);
      }

      toast.success("¡Perfil creado exitosamente!");
      
      // Disparar evento para actualizar la vista
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      window.dispatchEvent(new CustomEvent('startOnboarding'));
      
      onComplete();
    } catch (error: any) {
      console.error("Error al crear perfil:", error);
      toast.error(error.message || "Error al crear el perfil. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Bienvenido a RiskCare</DialogTitle>
          <DialogDescription>
            Ingresa tu número de documento para comenzar. Consultaremos tu información en ADRES automáticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Tipo de Documento</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="documentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="identification">Número de Documento</Label>
            <Input
              id="identification"
              value={identification}
              onChange={(e) => setIdentification(e.target.value)}
              placeholder="Ej: 1234567890"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono (Opcional)</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 3001234567"
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Consultando ADRES...
              </>
            ) : (
              "Crear Perfil"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Al continuar, tus datos serán consultados en ADRES para validar tu información de salud.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};