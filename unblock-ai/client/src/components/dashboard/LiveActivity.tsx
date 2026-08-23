import { timeAgo } from "../../utils/format";

const EVENT_STYLES: Record<string, string> = {
  DETECTION: "text-danger",
  EVIDENCE: "text-text-muted",
  CLASSIFICATION: "text-ai",
  CONFIDENCE: "text-ai",
  POLICY_CHECK: "text-risk",
  ACTION: "text-ai",
  UPDATE: "text-text-muted",
  RECOVERY: "text-recovered",
  SUCCESS: "text-recovered",
  ESCALATION: "text-danger",
};

interface Log {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
}

export default function LiveActivity({ logs }: { logs: Log[] }) {
  if (!logs.length) {
    return <div className="text-xs text-text-dim py-8 text-center">No activity yet — run the simulator to generate live events.</div>;
  }
  return (
    <div className="space-y-0 max-h-[420px] overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-border-soft last:border-0">
          <span className="font-mono-num text-[10px] text-text-dim mt-0.5 shrink-0 w-16">{timeAgo(log.created_at)}</span>
          <div className="min-w-0">
            <span className={`text-[10px] font-mono-num font-medium tracking-wide ${EVENT_STYLES[log.event_type] ?? "text-text-muted"}`}>
              {log.event_type}
            </span>
            <div className="text-xs text-text truncate">{log.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
