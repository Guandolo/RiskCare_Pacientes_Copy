import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ParaclinicoValor {
  fecha: string;
  valor: number;
  anormal: boolean;
  fuente: string;
}

interface Paraclinico {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  rangoNormal?: string;
  valores: ParaclinicoValor[];
}

interface Props {
  data: Paraclinico[];
}

export const ParaclinicosViewer = ({ data }: Props) => {
  // Agrupar por categoría
  const categorias = Array.from(new Set(data.map(p => p.categoria)));
  
  const getTrend = (valores: ParaclinicoValor[]) => {
    if (valores.length < 2) return null;
    const ultimo = valores[valores.length - 1].valor;
    const penultimo = valores[valores.length - 2].valor;
    if (ultimo > penultimo) return 'up';
    if (ultimo < penultimo) return 'down';
    return 'stable';
  };

  const parseRangoNormal = (rango: string | undefined) => {
    if (!rango) return null;
    const match = rango.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    if (match) {
      return {
        min: parseFloat(match[1]),
        max: parseFloat(match[2])
      };
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs defaultValue={categorias[0]} className="flex-1 flex flex-col">
        <div className="border-b px-4 py-2">
          <TabsList className="w-full justify-start overflow-x-auto">
            {categorias.map(categoria => (
              <TabsTrigger key={categoria} value={categoria} className="text-xs">
                {categoria}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {categorias.map(categoria => (
            <TabsContent key={categoria} value={categoria} className="m-0 p-4 space-y-4">
              {data
                .filter(p => p.categoria === categoria)
                .map(paraclinico => {
                  const trend = getTrend(paraclinico.valores);
                  const ultimoValor = paraclinico.valores[paraclinico.valores.length - 1];
                  const rango = parseRangoNormal(paraclinico.rangoNormal);
                  
                  // Preparar datos para la gráfica
                  const chartData = paraclinico.valores.map(v => ({
                    fecha: new Date(v.fecha).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
                    valor: v.valor,
                    anormal: v.anormal
                  }));

                  return (
                    <Card key={paraclinico.id} className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{paraclinico.nombre}</h3>
                            {trend === 'up' && <TrendingUp className="w-4 h-4 text-orange-500" />}
                            {trend === 'down' && <TrendingDown className="w-4 h-4 text-blue-500" />}
                            {trend === 'stable' && <Minus className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {paraclinico.rangoNormal && `Rango normal: ${paraclinico.rangoNormal} ${paraclinico.unidad}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {ultimoValor.valor}
                          </div>
                          <div className="text-xs text-muted-foreground">{paraclinico.unidad}</div>
                          {ultimoValor.anormal && (
                            <Badge variant="destructive" className="mt-1 text-xs">Anormal</Badge>
                          )}
                        </div>
                      </div>

                      {/* Gráfica */}
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="fecha" 
                              tick={{ fontSize: 11 }}
                              className="text-muted-foreground"
                            />
                            <YAxis 
                              tick={{ fontSize: 11 }}
                              className="text-muted-foreground"
                              domain={['auto', 'auto']}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                fontSize: '12px'
                              }}
                              formatter={(value: number) => [`${value} ${paraclinico.unidad}`, 'Valor']}
                            />
                            
                            {/* Líneas de referencia para rango normal */}
                            {rango && (
                              <>
                                <ReferenceLine 
                                  y={rango.min} 
                                  stroke="hsl(var(--muted-foreground))" 
                                  strokeDasharray="3 3"
                                  label={{ value: 'Min', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <ReferenceLine 
                                  y={rango.max} 
                                  stroke="hsl(var(--muted-foreground))" 
                                  strokeDasharray="3 3"
                                  label={{ value: 'Max', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                />
                              </>
                            )}

                            <Line 
                              type="monotone" 
                              dataKey="valor" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={payload.anormal ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                  />
                                );
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Lista de valores */}
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Historial</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {paraclinico.valores.slice().reverse().map((valor, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                              <span className="text-muted-foreground">
                                {new Date(valor.fecha).toLocaleDateString('es-CO')}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={valor.anormal ? 'text-destructive font-semibold' : 'text-foreground'}>
                                  {valor.valor} {paraclinico.unidad}
                                </span>
                                {valor.anormal && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">!</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  );
};
