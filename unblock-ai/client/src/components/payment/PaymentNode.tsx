import { Handle, Position } from "reactflow";
import { CheckCircle2, XCircle, Clock, PauseCircle } from "lucide-react";

const NODE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  PAYMENT_GATEWAY: "Payment Gateway",
  PLATFORM: "Platform",
  SPLIT: "Split Engine",
  VENDOR: "Vendor",
  BANK: "Vendor Bank",
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  SUCCESS: { color: "#2FD69B", bg: "rgba(47,214,155,0.08)", icon: CheckCircle2 },
  FAILED: { color: "#F0555A", bg: "rgba(240,85,90,0.08)", icon: XCircle },
  PENDING: { color: "#F5A623", bg: "rgba(245,166,35,0.08)", icon: Clock },
  PAUSED: { color: "#F5A623", bg: "rgba(245,166,35,0.08)", icon: PauseCircle },
};

export default function PaymentNode({ data }: { data: any }) {
  const cfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  const clickable = data.status === "FAILED";

  return (
    <div
      onClick={() => clickable && data.onClick?.(data.nodeType)}
      className={`rounded-xl border px-4 py-3 min-w-[180px] transition-transform ${clickable ? "cursor-pointer hover:scale-[1.03]" : ""}`}
      style={{ borderColor: cfg.color, background: cfg.bg }}
    >
      <Handle type="target" position={Position.Top} style={{ background: cfg.color, border: "none", width: 6, height: 6 }} />
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} color={cfg.color} />
        <span className="text-xs font-medium" style={{ color: cfg.color }}>
          {NODE_LABELS[data.nodeType] ?? data.nodeType}
        </span>
      </div>
      {data.amount != null && (
        <div className="font-mono-num text-sm font-semibold text-text">₹{Number(data.amount).toLocaleString("en-IN")}</div>
      )}
      {data.errorCode && <div className="text-[10px] text-danger mt-1 font-mono-num truncate max-w-[150px]">{data.errorCode}</div>}
      {data.timestamp && <div className="text-[10px] text-text-dim mt-1 font-mono-num">{data.timestamp}</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: cfg.color, border: "none", width: 6, height: 6 }} />
    </div>
  );
}
