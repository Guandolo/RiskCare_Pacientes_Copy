import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AccessLog {
  id: string;
  created_at: string;
  access_type: string;
  profesional_user_id: string;
  paciente_user_id: string;
  access_details: any;
  profesional_name?: string;
  profesional_document?: string;
  paciente_name?: string;
  paciente_document?: string;
}

interface AccessLogsTableProps {
  clinicaId: string;
}

export const AccessLogsTable = ({ clinicaId }: AccessLogsTableProps) => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccessLogs();
  }, [clinicaId]);

  const loadAccessLogs = async () => {
    try {
      setLoading(true);
      
      // Obtener logs de acceso
      const { data: logsData, error: logsError } = await supabase
        .from('patient_access_logs')
        .select('*')
        .eq('clinica_id', clinicaId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Obtener información de profesionales
      const profesionalIds = [...new Set(logsData?.map(log => log.profesional_user_id) || [])];
      const { data: profesionalesData } = await supabase
        .from('profesionales_clinicos')
        .select('user_id, rethus_data')
        .in('user_id', profesionalIds);

      // Obtener información de pacientes
      const pacienteIds = [...new Set(logsData?.map(log => log.paciente_user_id) || [])];
      const { data: pacientesData } = await supabase
        .from('patient_profiles')
        .select('user_id, full_name, identification, document_type')
        .in('user_id', pacienteIds);

      // Combinar datos
      const enrichedLogs = logsData?.map(log => {
        const profesional = profesionalesData?.find(p => p.user_id === log.profesional_user_id);
        const paciente = pacientesData?.find(p => p.user_id === log.paciente_user_id);
        
        const rethusData = profesional?.rethus_data as any;
        
        return {
          ...log,
          profesional_name: rethusData?.nombreCompleto || 'Desconocido',
          profesional_document: rethusData?.numeroIdentificacion || '',
          paciente_name: paciente?.full_name || 'Desconocido',
          paciente_document: `${paciente?.document_type || ''} ${paciente?.identification || ''}`.trim()
        };
      }) || [];

      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Error loading access logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccessTypeBadge = (type: string) => {
    const badges: Record<string, { variant: "default" | "secondary" | "outline", label: string }> = {
      'search': { variant: 'default', label: 'Búsqueda' },
      'view_documents': { variant: 'secondary', label: 'Ver Documentos' },
      'view_chat': { variant: 'outline', label: 'Ver Chat' },
      'view_profile': { variant: 'default', label: 'Ver Perfil' }
    };

    const badge = badges[type] || { variant: 'outline' as const, label: type };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registro de Accesos</CardTitle>
          <CardDescription>Últimos 100 accesos a información de pacientes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Accesos</CardTitle>
        <CardDescription>Últimos 100 accesos a información de pacientes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo de Acceso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No hay registros de acceso
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.profesional_name}</div>
                        {log.profesional_document && (
                          <div className="text-sm text-muted-foreground">{log.profesional_document}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.paciente_name}</div>
                        {log.paciente_document && (
                          <div className="text-sm text-muted-foreground">{log.paciente_document}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getAccessTypeBadge(log.access_type)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
