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
    <div className="px-4 py-3 rounded-lg border border-destructive bg-destructive/10 shadow-md min-w-[160px]">
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
    <div className="px-4 py-3 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md min-w-[160px]">
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
    <div className="px-4 py-3 rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30 shadow-md min-w-[160px]">
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
    <div className="px-4 py-3 rounded-lg border border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md min-w-[160px]">
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
  // Convertir los nodos al formato de ReactFlow con layout automático
  const layoutNodes = (nodes: any[]): Node[] => {
    return nodes.map((node, index) => {
      const type = node.type || 'default';
      const isPatient = type === 'patient';
      
      // Layout en círculo para nodos alrededor del paciente
      const angle = isPatient ? 0 : (2 * Math.PI * index) / (nodes.length - 1);
      const radius = isPatient ? 0 : 300;
      
      return {
        id: node.id,
        type: type,
        position: {
          x: isPatient ? 400 : 400 + radius * Math.cos(angle),
          y: isPatient ? 300 : 300 + radius * Math.sin(angle),
        },
        data: {
          label: node.label,
          description: node.description,
          ...node.data,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });
  };

  const layoutEdges = (edges: any[]): Edge[] => {
    return edges.map((edge) => ({
      id: edge.id || `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      style: {
        strokeWidth: 2,
      },
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
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};
