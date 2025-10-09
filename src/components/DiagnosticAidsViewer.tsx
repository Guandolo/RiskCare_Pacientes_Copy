import { Calendar, FileText, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DiagnosticStudy {
  id: string;
  type: string;
  date: string;
  summary: string;
  findings: string[];
  conclusion: string;
  doctor?: string;
  source: string;
}

interface DiagnosticAidsData {
  studies: DiagnosticStudy[];
}

interface DiagnosticAidsViewerProps {
  data: DiagnosticAidsData;
}

export const DiagnosticAidsViewer = ({ data }: DiagnosticAidsViewerProps) => {
  if (!data?.studies || data.studies.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No se encontraron estudios de imagenología</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-6">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
          
          {/* Studies */}
          <div className="space-y-6">
            {data.studies.map((study, index) => (
              <div key={study.id} className="relative pl-16">
                {/* Timeline dot */}
                <div className="absolute left-6 top-6 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                
                <Card className="p-5 hover:shadow-lg transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground mb-1">
                        {study.type}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(study.date).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</span>
                        </div>
                        {study.doctor && (
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            <span>{study.doctor}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {study.source}
                    </Badge>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-foreground mb-3 leading-relaxed">
                    {study.summary}
                  </p>

                  {/* Findings */}
                  {study.findings && study.findings.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-foreground mb-2">Hallazgos:</h4>
                      <ul className="space-y-1">
                        {study.findings.map((finding, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span className="flex-1">{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Conclusion */}
                  {study.conclusion && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <h4 className="text-sm font-medium text-foreground mb-1">Conclusión:</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {study.conclusion}
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
