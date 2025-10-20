import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface ProfesionalClinicoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ProfesionalClinicoModal = ({ open, onOpenChange, onSuccess }: ProfesionalClinicoModalProps) => {
  const [tipoDocumento, setTipoDocumento] = useState<string>("CC");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{success: boolean; message: string} | null>(null);

  const handleValidate = async () => {
    if (!numeroDocumento.trim()) {
      toast.error("Por favor ingresa tu número de documento");
      return;
    }

    setLoading(true);
    setValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validar-rethus', {
        body: {
          tipoDocumento: tipoDocumento === "CC" ? "Cédula de Ciudadanía" : 
                        tipoDocumento === "CE" ? "Cédula de Extranjería" :
                        tipoDocumento === "PT" ? "Permiso por protección temporal" :
                        "Tarjeta de Identidad",
          numeroDocumento: numeroDocumento.trim()
        }
      });

      if (error) throw error;

      setValidationResult({
        success: data.success,
        message: data.message
      });

      if (data.success) {
        toast.success("¡Validación exitosa! Ahora eres profesional clínico");
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 2000);
      } else {
        toast.error("No se encontró registro profesional en RETHUS");
      }
    } catch (error) {
      console.error('Error validating professional:', error);
      toast.error("Error al validar credenciales profesionales");
      setValidationResult({
        success: false,
        message: "Error al conectar con el sistema de validación"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Validar como Profesional Clínico</DialogTitle>
          <DialogDescription>
            Valida tus credenciales profesionales en el Registro RETHUS para acceder a funciones avanzadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tipo-documento">Tipo de Documento</Label>
            <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
              <SelectTrigger id="tipo-documento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                <SelectItem value="PT">Permiso por protección temporal</SelectItem>
                <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numero-documento">Número de Documento</Label>
            <Input
              id="numero-documento"
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ingresa tu número de documento"
              disabled={loading}
            />
          </div>

          {validationResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              validationResult.success 
                ? 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100' 
                : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100'
            }`}>
              {validationResult.success ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm">{validationResult.message}</p>
            </div>
          )}

          <Button 
            onClick={handleValidate} 
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Validando...' : 'Validar Credenciales'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};