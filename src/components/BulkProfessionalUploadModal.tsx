import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BulkProfessionalUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicaId: string;
  onSuccess: () => void;
}

interface Row {
  documentType: string;
  identification: string;
  email?: string;
  fullName?: string;
  status?: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
}

const ALLOWED = new Set(['CC','TI','CE','PA','RC','NU','CD','CN','SC','PE','PT']);

export const BulkProfessionalUploadModal = ({ open, onOpenChange, clinicaId, onSuccess }: BulkProfessionalUploadModalProps) => {
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [showResults, setShowResults] = useState(false);

  const parse = (): Row[] => {
    const lines = text.trim().split('\n');
    const out: Row[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/[\s,]+/).filter(Boolean);
      // Formato: DOC IDENT EMAIL [Nombre...]
      if (parts.length >= 3) {
        out.push({
          documentType: parts[0].toUpperCase(),
          identification: parts[1],
          email: parts[2],
          fullName: parts.slice(3).join(' ') || undefined,
          status: 'pending'
        });
      }
    }
    return out;
  };

  const handleProcess = async () => {
    const entries = parse();
    if (entries.length === 0) {
      toast.error("No se encontraron filas válidas");
      return;
    }

    setProcessing(true);
    setShowResults(true);
    setRows(entries);

    const processed: Row[] = [];

    for (let i = 0; i < entries.length; i++) {
      const r = entries[i];
      setRows(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'processing' } : p));

      try {
        if (!ALLOWED.has(r.documentType)) {
          const upd: Row = { ...r, status: 'error', message: 'Tipo de documento no soportado' };
          processed.push(upd);
          setRows(prev => prev.map((p, idx) => idx === i ? upd : p));
          continue;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const { error, data } = await supabase.functions.invoke('admin-create-professional', {
          body: {
            clinicaId,
            documentType: r.documentType,
            identification: r.identification,
            email: r.email,
            fullName: r.fullName,
          },
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (error) throw error;

        const upd: Row = { ...r, status: 'success', message: 'Creado/Asociado' };
        processed.push(upd);
        setRows(prev => prev.map((p, idx) => idx === i ? upd : p));
      } catch (e: any) {
        const upd: Row = { ...r, status: 'error', message: e.message || 'Error' };
        processed.push(upd);
        setRows(prev => prev.map((p, idx) => idx === i ? upd : p));
      }

      await new Promise(res => setTimeout(res, 400));
    }

    setProcessing(false);
    setRows(processed);

    const ok = processed.filter(r => r.status === 'success').length;
    const ko = processed.filter(r => r.status === 'error').length;
    toast.success(`Proceso completado: ${ok} exitosos, ${ko} errores`);
    if (ok > 0) onSuccess();
  };

  const handleClose = () => {
    setText('');
    setRows([]);
    setShowResults(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Carga Masiva de Profesionales
          </DialogTitle>
          <DialogDescription>
            Formato: DOC_TIPO DOC_NUMERO EMAIL NOMBRE_OPCIONAL (uno por línea)
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div>
                  <strong>Ejemplos (uno por línea):</strong><br />
                  CC 12345678 user1@acme.com Juan Pérez<br />
                  TI 9876543 user2@acme.com<br />
                  <span className="text-muted-foreground mt-1 block">Tipos válidos: CC, TI, CE, PA, RC, NU, CD, CN, SC, PE, PT</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulkProText">Lista de Profesionales</Label>
              <Textarea id="bulkProText" value={text} onChange={(e) => setText(e.target.value)} placeholder="CC 12345678 user@acme.com Juan Pérez" className="min-h-[200px] font-mono text-sm" disabled={processing} />
              <p className="text-xs text-muted-foreground">{parse().length} filas detectadas</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={processing}>Cancelar</Button>
              <Button onClick={handleProcess} disabled={processing || !text.trim()}>
                {processing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>) : (<><Upload className="mr-2 h-4 w-4" />Cargar Profesionales</>)}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {rows.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{r.documentType} {r.identification} • {r.email}</p>
                      {r.fullName && <p className="text-xs text-muted-foreground">{r.fullName}</p>}
                      {r.message && <p className="text-xs text-muted-foreground mt-1">{r.message}</p>}
                    </div>
                    <div>
                      {r.status === 'pending' && (<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-muted-foreground" /></div>)}
                      {r.status === 'processing' && (<Loader2 className="h-5 w-5 animate-spin text-blue-500" />)}
                      {r.status === 'success' && (<CheckCircle2 className="h-5 w-5 text-green-500" />)}
                      {r.status === 'error' && (<XCircle className="h-5 w-5 text-red-500" />)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end">
              <Button onClick={handleClose} disabled={processing}>{processing ? 'Procesando...' : 'Cerrar'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};