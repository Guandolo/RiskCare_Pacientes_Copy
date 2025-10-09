import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "RC", label: "Registro Civil" },
  { value: "NU", label: "No. Único de id. Personal" },
  { value: "CD", label: "Carnet Diplomático" },
  { value: "CN", label: "Certificado de Nacido Vivo" },
  { value: "SC", label: "Salvo Conducto" },
  { value: "PE", label: "Permiso Especial de Permanencia" },
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

  const fetchTopusData = async () => {
    const formdata = new FormData();
    formdata.append("token", "&Th89RjkeGkoWRoanjvedZQxcLJvxfP53=Ex");
    formdata.append("doc_type", documentType);
    formdata.append("identification", identification);

    const response = await fetch("https://topus.com.co/ApiRest/request_ss", {
      method: "POST",
      body: formdata,
    });

    const result = await response.text();
    return JSON.parse(result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identification.trim()) {
      toast.error("Por favor ingresa tu número de documento");
      return;
    }

    setLoading(true);
    try {
      // Consultar API de Topus
      const topusData = await fetchTopusData();
      
      // Guardar perfil en la base de datos
      const { error } = await supabase
        .from("patient_profiles")
        .insert({
          user_id: userId,
          document_type: documentType,
          identification: identification,
          topus_data: topusData,
          full_name: topusData?.nombre_completo || null,
          age: topusData?.edad || null,
          eps: topusData?.eps || null,
        });

      if (error) throw error;

      toast.success("Perfil creado exitosamente");
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
          <DialogTitle>Identificación del Paciente</DialogTitle>
          <DialogDescription>
            Para comenzar, necesitamos verificar tu identidad. Ingresa tu número de documento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
              placeholder="Ingresa tu número de documento"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verificando..." : "Continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
