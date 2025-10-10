import { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Activity, Pill, FileText, User, Stethoscope } from 'lucide-react';

const nodeTypes = {
  patient: ({ data }: any) => (
    <div className="px-6 py-4 rounded-xl border-2 border-primary bg-primary/10 shadow-lg min-w-[200px]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <User className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-bold text-sm text-foreground">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-1">{data.description}</div>
          )}
        </div>
      </div>
    </div>
  ),
  condition: ({ data }: any) => (
    <div className="px-4 py-3 rounded-xl border-2 border-destructive/40 bg-destructive/5 shadow-sm hover:shadow-md transition-shadow min-w-[160px]">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-destructive" />
        <div>
          <div className="font-semibold text-xs text-foreground">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{data.description}</div>
          )}
        </div>
      </div>
    </div>
  ),
  medication: ({ data }: any) => (
    <div className="px-4 py-3 rounded-xl border-2 border-blue-400/40 bg-blue-50 dark:bg-blue-950/30 shadow-sm hover:shadow-md transition-shadow min-w-[160px]">
      <div className="flex items-center gap-2">
        <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <div>
          <div className="font-semibold text-xs text-foreground">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{data.description}</div>
          )}
        </div>
      </div>
    </div>
  ),
  paraclinical: ({ data }: any) => (
    <div className="px-4 py-3 rounded-xl border-2 border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 shadow-sm hover:shadow-md transition-shadow min-w-[160px]">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <div>
          <div className="font-semibold text-xs text-foreground">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{data.description}</div>
          )}
        </div>
      </div>
    </div>
  ),
  specialist: ({ data }: any) => (
    <div className="px-4 py-3 rounded-xl border-2 border-green-400/40 bg-green-50 dark:bg-green-950/30 shadow-sm hover:shadow-md transition-shadow min-w-[160px]">
      <div className="flex items-center gap-2">
        <Stethoscope className="w-4 h-4 text-green-600 dark:text-green-400" />
        <div>
          <div className="font-semibold text-xs text-foreground">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{data.description}</div>
          )}
        </div>
      </div>
    </div>
  ),
};

interface ClinicalMapViewerProps {
  mapData: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      description?: string;
      data?: any;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
    }>;
  };
}

export const ClinicalMapViewer = ({ mapData }: ClinicalMapViewerProps) => {
  // Convertir los nodos al formato de ReactFlow con layout mejorado
  const layoutNodes = (nodes: any[]): Node[] => {
    const patient = nodes.find(n => n.type === 'patient');
    const conditions = nodes.filter(n => n.type === 'condition');
    const medications = nodes.filter(n => n.type === 'medication');
    const paraclinicals = nodes.filter(n => n.type === 'paraclinical');
    const specialists = nodes.filter(n => n.type === 'specialist');
    
    const positioned: Node[] = [];
    const centerX = 500;
    const centerY = 300;
    
    // Paciente en el centro
    if (patient) {
      positioned.push({
        id: patient.id,
        type: patient.type,
        position: { x: centerX, y: centerY },
        data: { label: patient.label, description: patient.description, ...patient.data },
      });
    }
    
    // Condiciones en círculo alrededor del paciente (radio 250px)
    conditions.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(conditions.length, 1);
      positioned.push({
        id: node.id,
        type: node.type,
        position: {
          x: centerX + 280 * Math.cos(angle) - 80,
          y: centerY + 280 * Math.sin(angle) - 20,
        },
        data: { label: node.label, description: node.description, ...node.data },
      });
    });
    
    // Medicamentos a la izquierda en columna
    medications.forEach((node, i) => {
      positioned.push({
        id: node.id,
        type: node.type,
        position: {
          x: 50,
          y: 50 + i * 80,
        },
        data: { label: node.label, description: node.description, ...node.data },
      });
    });
    
    // Paraclínicos arriba en fila
    paraclinicals.forEach((node, i) => {
      positioned.push({
        id: node.id,
        type: node.type,
        position: {
          x: 300 + i * 220,
          y: 20,
        },
        data: { label: node.label, description: node.description, ...node.data },
      });
    });
    
    // Especialistas a la derecha en columna
    specialists.forEach((node, i) => {
      positioned.push({
        id: node.id,
        type: node.type,
        position: {
          x: 950,
          y: 100 + i * 100,
        },
        data: { label: node.label, description: node.description, ...node.data },
      });
    });
    
    return positioned;
  };

  const layoutEdges = (edges: any[]): Edge[] => {
    return edges.map((edge) => ({
      id: edge.id || `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep', // Curvas suaves tipo NotebookLM
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: 'hsl(var(--primary) / 0.6)',
      },
      style: {
        strokeWidth: 3,
        stroke: 'hsl(var(--primary) / 0.85)',
      },
      labelStyle: {
        fontSize: 10,
        fontWeight: 500,
        fill: 'hsl(var(--foreground))',
      },
      labelBgStyle: {
        fill: 'hsl(var(--background))',
        fillOpacity: 0.95,
      },
      labelBgPadding: [8, 6] as [number, number],
      labelBgBorderRadius: 6,
    }));
  };

  const [nodes, , onNodesChange] = useNodesState(layoutNodes(mapData.nodes || []));
  const [edges, , onEdgesChange] = useEdgesState(layoutEdges(mapData.edges || []));

  return (
    <div className="w-full h-full bg-background rounded-lg border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};
