import { formatDateTime } from "../../utils/format";

const EVENT_STYLES: Record<string, string> = {
  DETECTION: "border-danger bg-danger-dim text-danger",
  EVIDENCE: "border-border text-text-muted",
  CLASSIFICATION: "border-ai bg-ai-dim text-ai",
  CONFIDENCE: "border-ai bg-ai-dim text-ai",
  POLICY_CHECK: "border-risk bg-risk-dim text-risk",
  ACTION: "border-ai bg-ai-dim text-ai",
  UPDATE: "border-border text-text-muted",
  RECOVERY: "border-recovered bg-recovered-dim text-recovered",
  SUCCESS: "border-recovered bg-recovered-dim text-recovered",
  ESCALATION: "border-danger bg-danger-dim text-danger",
};

interface Log {
  id: string;
  event_type: string;
  message: string;
  confidence: number | null;
  created_at: string;
}

export default function TransactionTimeline({ logs }: { logs: Log[] }) {
  if (!logs.length) {
    return <div className="text-xs text-text-dim py-6 text-center">No audit events yet for this transaction.</div>;
  }
  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
      <div className="space-y-4">
        {logs.map((log) => {
          const style = EVENT_STYLES[log.event_type] ?? "border-border text-text-muted";
          return (
            <div key={log.id} className="relative">
              <span className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 bg-surface ${style.split(" ")[0]}`} />
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-mono-num font-medium px-1.5 py-0.5 rounded ${style}`}>{log.event_type}</span>
                <span className="text-[10px] text-text-dim font-mono-num">{formatDateTime(log.created_at)}</span>
                {log.confidence != null && (
                  <span className="text-[10px] text-text-dim font-mono-num">{(log.confidence * 100).toFixed(0)}%</span>
                )}
              </div>
              <div className="text-xs text-text">{log.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
