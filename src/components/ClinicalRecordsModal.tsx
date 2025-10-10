import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, Calendar, FileText } from "lucide-react";
import { useState } from "react";

interface ClinicalRecordsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: any[];
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

export const ClinicalRecordsModal = ({ open, onOpenChange, records }: ClinicalRecordsModalProps) => {
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin fecha';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Registros Clínicos
          </DialogTitle>
          <DialogDescription>
            {selectedRecord 
              ? 'Datos completos del registro seleccionado'
              : `${records.length} ${records.length === 1 ? 'registro encontrado' : 'registros encontrados'}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-[70vh]">
          {/* Lista de registros */}
          <div className={`${selectedRecord ? 'w-1/3' : 'w-full'} border-r transition-all`}>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {records.map((record, idx) => (
                  <Card
                    key={idx}
                    className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                      selectedRecord === record ? 'ring-2 ring-primary bg-accent/10' : 'hover:bg-accent/5'
                    }`}
                    onClick={() => setSelectedRecord(selectedRecord === record ? null : record)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(record.registration_date || record.date_of_attention)}</span>
                      </div>
                      
                      {record.diagnoses && (
                        <p className="text-sm font-medium line-clamp-2">{record.diagnoses}</p>
                      )}
                      
                      {record.id_company && (
                        <p className="text-xs text-muted-foreground">
                          ID: {record.id_company}
                        </p>
                      )}
                      
                      {!selectedRecord && record.details && record.details.length > 0 && (
                        <p className="text-xs text-primary">
                          {record.details.length} {record.details.length === 1 ? 'detalle' : 'detalles'}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Panel de detalles */}
          {selectedRecord && (
            <div className="w-2/3">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Datos del Registro</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <DataTree data={selectedRecord} />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
