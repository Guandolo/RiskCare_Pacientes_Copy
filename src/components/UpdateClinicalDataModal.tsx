import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, ChevronRight, CheckCircle2, AlertCircle, Activity, Pill, ChevronDown } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClinicalRecordsModal } from "./ClinicalRecordsModal";

interface UpdateClinicalDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  onSuccess: (data: any, fetchDate: string) => void;
  hismartData: any;
}

// Componente recursivo para renderizar árbol de datos
const DataTree = ({ data, level = 0 }: { data: any; level?: number }) => {
  const [isOpen, setIsOpen] = useState(level === 0);

  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof data !== 'object') {
    return <span className="font-medium">{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground italic">[]</span>;
    }

    return (
      <div className="space-y-1">
        {data.map((item, idx) => (
          <div key={idx} className="pl-4 border-l-2 border-border/50">
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground min-w-[30px]">[{idx}]</span>
              <DataTree data={item} level={level + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <span className="text-muted-foreground italic">{'{}'}</span>;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-primary hover:underline text-sm">
        <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        <span>{entries.length} {entries.length === 1 ? 'campo' : 'campos'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="pl-4 border-l-2 border-border/50">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">{key}:</span>
              <div className="pl-2">
                <DataTree data={value} level={level + 1} />
              </div>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const UpdateClinicalDataModal = ({ open, onOpenChange, profile, onSuccess, hismartData }: UpdateClinicalDataModalProps) => {
  const [loading, setLoading] = useState(false);
  const [localHismartData, setLocalHismartData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClinicalRecords, setShowClinicalRecords] = useState(false);
  const [showPrescriptions, setShowPrescriptions] = useState(false);

  // Usar los datos que ya existen si están disponibles
  const displayData = localHismartData || hismartData;

  const handleFetch = async () => {
    if (!profile) return;
    
    setLoading(true);
    setError(null);
    setLocalHismartData(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke('fetch-hismart-data', {
        body: {
          documentType: profile.document_type,
          identification: profile.identification
        }
      });

      if (error) throw error;

      console.log('Datos de HiSmart:', data);
      if (data.success && data.data?.result?.data) {
        const hismartInfo = data.data.result.data;
        setLocalHismartData(hismartInfo);
        
        const fetchDate = new Date().toLocaleString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Guardar datos de HiSmart en la base de datos
        const { error: updateError } = await supabase
          .from('patient_profiles')
          .update({
            topus_data: {
              ...profile.topus_data,
              hismart_data: hismartInfo,
              hismart_last_fetch: fetchDate
            }
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error guardando datos de HiSmart:', updateError);
        }

        // Disparar evento para actualizar sugerencias
        window.dispatchEvent(new CustomEvent('documentsUpdated'));

        toast.success('Datos clínicos consultados exitosamente');
        onSuccess(hismartInfo, fetchDate);
      } else {
        setError('No se encontraron datos clínicos');
        toast.error('No se encontraron datos clínicos');
      }
    } catch (error) {
      console.error('Error consultando HiSmart:', error);
      const errorMsg = 'Error consultando datos clínicos';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Actualizar Datos Clínicos
          </DialogTitle>
          <DialogDescription>
            Consulta y visualiza tus datos clínicos desde el sistema de Historia Clínica
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-[70vh]">
          {!displayData && !error && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Consultar Datos Clínicos</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Obtendremos tu información clínica desde el sistema de Historia Clínica en tiempo real.
                  </p>
                </div>
                <Button
                  onClick={handleFetch}
                  disabled={loading || !profile}
                  size="lg"
                  className="w-full gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Iniciar Consulta
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">No se encontraron datos</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {error}
                  </p>
                </div>
                <Button
                  onClick={handleFetch}
                  disabled={loading}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Intentar de nuevo
                </Button>
              </div>
            </div>
          )}

          {displayData && (
            <div className="flex-1 flex flex-col">
              <div className="px-6 py-3 bg-muted/50 border-b flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Datos obtenidos exitosamente</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {/* Botones de acceso rápido */}
                  <div className="space-y-2">
                    {/* Registros Clínicos */}
                    {displayData.clinical_records && displayData.clinical_records.length > 0 && (
                      <Card 
                        className="cursor-pointer hover:shadow-md transition-all bg-gradient-card"
                        onClick={() => setShowClinicalRecords(true)}
                      >
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                            <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-foreground">Registros Clínicos</h4>
                            <p className="text-xs text-muted-foreground">
                              {displayData.clinical_records.length} {displayData.clinical_records.length === 1 ? 'registro' : 'registros'}
                            </p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
                        </div>
                      </Card>
                    )}

                    {/* Prescripciones */}
                    {displayData.prescription_records && displayData.prescription_records.length > 0 && (
                      <Card 
                        className="cursor-pointer hover:shadow-md transition-all bg-gradient-card"
                        onClick={() => setShowPrescriptions(true)}
                      >
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <Pill className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-foreground">Prescripciones</h4>
                            <p className="text-xs text-muted-foreground">
                              {displayData.prescription_records.length} {displayData.prescription_records.length === 1 ? 'prescripción' : 'prescripciones'}
                            </p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Datos completos */}
                  <div className="bg-muted rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3">Datos Completos de Historia Clínica</h3>
                    <DataTree data={displayData} />
                  </div>
                  
                  <div className="mt-4 flex gap-2 justify-end">
                    <Button
                      onClick={handleFetch}
                      disabled={loading}
                      variant="outline"
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Actualizar
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>
                      Cerrar
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Clinical Records Modal */}
        {displayData?.clinical_records && (
          <ClinicalRecordsModal
            open={showClinicalRecords}
            onOpenChange={setShowClinicalRecords}
            records={displayData.clinical_records}
          />
        )}

        {/* Prescriptions Modal */}
        {displayData?.prescription_records && (
          <ClinicalRecordsModal
            open={showPrescriptions}
            onOpenChange={setShowPrescriptions}
            records={displayData.prescription_records}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
