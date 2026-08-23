import { useMemo } from "react";
import ReactFlow, { Background, MarkerType } from "reactflow";
import type { Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
import PaymentNode from "./PaymentNode";
import { formatTime } from "../../utils/format";

const nodeTypes = { paymentNode: PaymentNode };

const ORDER = ["CUSTOMER", "PAYMENT_GATEWAY", "PLATFORM", "SPLIT", "VENDOR", "BANK"];

interface TxNode {
  node_type: string;
  status: string;
  error_code: string | null;
  created_at: string;
}

export default function PaymentGraph({
  nodes,
  amount,
  onNodeClick,
}: {
  nodes: TxNode[];
  amount: number;
  onNodeClick: (nodeType: string) => void;
}) {
  const { flowNodes, flowEdges } = useMemo(() => {
    const byType = new Map(nodes.map((n) => [n.node_type, n]));
    const flowNodes: Node[] = ORDER.map((type, i) => {
      const n = byType.get(type);
      return {
        id: type,
        type: "paymentNode",
        position: { x: 0, y: i * 110 },
        data: {
          nodeType: type,
          status: n?.status ?? "PENDING",
          errorCode: n?.error_code,
          timestamp: n ? formatTime(n.created_at) : null,
          amount: type === "CUSTOMER" || type === "PAYMENT_GATEWAY" || type === "PLATFORM" ? amount : undefined,
          onClick: onNodeClick,
        },
        draggable: false,
      };
    });

    const flowEdges: Edge[] = ORDER.slice(0, -1).map((type, i) => {
      const next = ORDER[i + 1];
      const nStatus = byType.get(type)?.status ?? "PENDING";
      const isFailurePoint = nStatus === "FAILED";
      return {
        id: `${type}-${next}`,
        source: type,
        target: next,
        animated: nStatus === "SUCCESS",
        style: {
          stroke: isFailurePoint ? "#F0555A" : nStatus === "SUCCESS" ? "#2FD69B" : "#232A38",
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: isFailurePoint ? "#F0555A" : nStatus === "SUCCESS" ? "#2FD69B" : "#232A38" },
      };
    });

    return { flowNodes, flowEdges };
  }, [nodes, amount, onNodeClick]);

  return (
    <div style={{ height: 620 }} className="bg-surface-2/30 rounded-xl border border-border">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnScroll
        zoomOnScroll={false}
      >
        <Background color="#1A2029" gap={20} />
      </ReactFlow>
    </div>
  );
}
