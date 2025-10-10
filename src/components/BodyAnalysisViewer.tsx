import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface BodyMeasurement {
  fecha: string;
  valor: number;
  fuente?: string;
}

interface BloodPressureMeasurement {
  fecha: string;
  sistolica: number;
  diastolica: number;
  fuente?: string;
}

interface IMCMeasurement {
  fecha: string;
  valor: number;
  peso: number;
  talla: number;
}

interface BodyAnalysisData {
  medidas: {
    peso?: BodyMeasurement[];
    talla?: BodyMeasurement[];
    presionArterial?: BloodPressureMeasurement[];
    frecuenciaCardiaca?: BodyMeasurement[];
    imc?: IMCMeasurement[];
  };
  ultimosValores?: {
    peso?: number;
    talla?: number;
    imc?: number;
    presionSistolica?: number;
    presionDiastolica?: number;
    frecuenciaCardiaca?: number;
  };
}

interface Props {
  data: BodyAnalysisData;
}

export const BodyAnalysisViewer = ({ data }: Props) => {
  const { medidas, ultimosValores } = data;

  // Función para clasificar IMC
  const getIMCCategory = (imc: number) => {
    if (imc < 18.5) return { label: "Bajo peso", color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" };
    if (imc < 25) return { label: "Normal", color: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" };
    if (imc < 30) return { label: "Sobrepeso", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
    return { label: "Obesidad", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" };
  };

  // Función para clasificar presión arterial
  const getBPCategory = (sistolica: number, diastolica: number) => {
    if (sistolica < 120 && diastolica < 80) return { label: "Normal", color: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" };
    if (sistolica < 130 && diastolica < 80) return { label: "Elevada", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
    if (sistolica < 140 || diastolica < 90) return { label: "HTA Etapa 1", color: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200" };
    return { label: "HTA Etapa 2", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" };
  };

  // Preparar datos para gráficos
  const prepareChartData = (measurements: BodyMeasurement[]) => {
    return measurements.map(m => ({
      fecha: new Date(m.fecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
      valor: m.valor,
      fullDate: m.fecha
    })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  };

  const prepareBPChartData = (measurements: BloodPressureMeasurement[]) => {
    return measurements.map(m => ({
      fecha: new Date(m.fecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
      sistolica: m.sistolica,
      diastolica: m.diastolica,
      fullDate: m.fecha
    })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  };

  const pesoData = medidas.peso && medidas.peso.length > 0 ? prepareChartData(medidas.peso) : null;
  const imcData = medidas.imc && medidas.imc.length > 0 ? medidas.imc.map(m => ({
    fecha: new Date(m.fecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
    valor: m.valor,
    fullDate: m.fecha
  })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()) : null;
  const bpData = medidas.presionArterial && medidas.presionArterial.length > 0 ? prepareBPChartData(medidas.presionArterial) : null;

  const imcCategory = ultimosValores?.imc ? getIMCCategory(ultimosValores.imc) : null;
  const bpCategory = ultimosValores?.presionSistolica && ultimosValores?.presionDiastolica 
    ? getBPCategory(ultimosValores.presionSistolica, ultimosValores.presionDiastolica) 
    : null;

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-6 space-y-6">
        {/* Resumen de Valores Recientes */}
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Valores Más Recientes</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ultimosValores?.peso && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Peso</p>
                <p className="text-2xl font-bold text-foreground">{ultimosValores.peso} kg</p>
              </div>
            )}
            {ultimosValores?.talla && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Talla</p>
                <p className="text-2xl font-bold text-foreground">{ultimosValores.talla} cm</p>
              </div>
            )}
            {ultimosValores?.imc && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">IMC</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{ultimosValores.imc.toFixed(1)}</p>
                  {imcCategory && <Badge className={imcCategory.color}>{imcCategory.label}</Badge>}
                </div>
              </div>
            )}
            {ultimosValores?.presionSistolica && ultimosValores?.presionDiastolica && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Presión Arterial</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">
                    {ultimosValores.presionSistolica}/{ultimosValores.presionDiastolica}
                  </p>
                  {bpCategory && <Badge className={bpCategory.color}>{bpCategory.label}</Badge>}
                </div>
              </div>
            )}
            {ultimosValores?.frecuenciaCardiaca && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Frecuencia Cardíaca</p>
                <p className="text-2xl font-bold text-foreground">{ultimosValores.frecuenciaCardiaca} lpm</p>
              </div>
            )}
          </div>
        </Card>

        {/* Gráfico de Evolución de Peso */}
        {pesoData && pesoData.length > 1 && (
          <Card className="p-6">
            <h4 className="font-semibold mb-4">Evolución del Peso</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pesoData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="fecha" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'kg', position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Gráfico de Evolución de IMC */}
        {imcData && imcData.length > 1 && (
          <Card className="p-6">
            <h4 className="font-semibold mb-4">Evolución del IMC</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={imcData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="fecha" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={[15, 35]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <ReferenceLine y={18.5} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine y={25} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground justify-center">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-muted-foreground"></div>
                <span>Bajo peso (&lt;18.5)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-muted-foreground"></div>
                <span>Normal (18.5-25)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-muted-foreground"></div>
                <span>Sobrepeso (25-30)</span>
              </div>
            </div>
          </Card>
        )}

        {/* Gráfico de Evolución de Presión Arterial */}
        {bpData && bpData.length > 1 && (
          <Card className="p-6">
            <h4 className="font-semibold mb-4">Evolución de la Presión Arterial</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bpData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="fecha" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'mmHg', position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <ReferenceLine y={120} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine y={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="sistolica" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  name="Sistólica"
                  dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="diastolica" 
                  stroke="hsl(var(--chart-4))" 
                  strokeWidth={2}
                  name="Diastólica"
                  dot={{ fill: 'hsl(var(--chart-4))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              <p>Rangos de referencia: Normal &lt; 120/80 mmHg</p>
            </div>
          </Card>
        )}

        {/* Clasificaciones */}
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Interpretación de Valores Actuales</h4>
          <div className="space-y-3">
            {imcCategory && ultimosValores?.imc && (
              <div className="flex items-start gap-3">
                <Badge className={imcCategory.color}>{imcCategory.label}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">Índice de Masa Corporal: {ultimosValores.imc.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ultimosValores.imc < 18.5 && "Se recomienda consultar con nutricionista para alcanzar un peso saludable."}
                    {ultimosValores.imc >= 18.5 && ultimosValores.imc < 25 && "Tu peso está en un rango saludable. Mantén una dieta balanceada y actividad física regular."}
                    {ultimosValores.imc >= 25 && ultimosValores.imc < 30 && "Considera adoptar hábitos más saludables. Consulta con un profesional de la salud."}
                    {ultimosValores.imc >= 30 && "Es importante que consultes con un médico para desarrollar un plan de salud personalizado."}
                  </p>
                </div>
              </div>
            )}
            {bpCategory && ultimosValores?.presionSistolica && ultimosValores?.presionDiastolica && (
              <div className="flex items-start gap-3">
                <Badge className={bpCategory.color}>{bpCategory.label}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Presión Arterial: {ultimosValores.presionSistolica}/{ultimosValores.presionDiastolica} mmHg
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bpCategory.label === "Normal" && "Tu presión arterial está en un rango óptimo."}
                    {bpCategory.label === "Elevada" && "Monitorea tu presión y considera cambios en el estilo de vida."}
                    {bpCategory.label.includes("HTA") && "Consulta con tu médico para evaluación y posible tratamiento."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </ScrollArea>
  );
};
