import { useQuery } from "@tanstack/react-query";
import { AuditAPI } from "../api/resources";
import { LoadingState, EmptyState } from "../components/common/States";
import { formatDateTime } from "../utils/format";

const EVENT_STYLES: Record<string, string> = {
  DETECTION: "border-danger text-danger",
  EVIDENCE: "border-border text-text-muted",
  CLASSIFICATION: "border-ai text-ai",
  CONFIDENCE: "border-ai text-ai",
  POLICY_CHECK: "border-risk text-risk",
  ACTION: "border-ai text-ai",
  UPDATE: "border-border text-text-muted",
  RECOVERY: "border-recovered text-recovered",
  SUCCESS: "border-recovered text-recovered",
  ESCALATION: "border-danger text-danger",
};

export default function AuditLog() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "full"],
    queryFn: () => AuditAPI.list(100, 0).then((r) => r.data.data),
    refetchInterval: 4000,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-display font-semibold">Audit Trail</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Every AI decision and recovery action, in order, streamed live.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        {isLoading ? (
          <LoadingState label="Loading audit trail" />
        ) : rows.length === 0 ? (
          <EmptyState title="No audit events yet" subtitle="Run the simulator to generate a live audit trail." />
        ) : (
          <div className="space-y-0">
            {rows.map((log: any) => {
              const style = EVENT_STYLES[log.event_type] ?? "border-border text-text-muted";
              return (
                <div key={log.id} className="flex items-start gap-4 py-3 border-b border-border-soft last:border-0">
                  <span className="font-mono-num text-[11px] text-text-dim shrink-0 w-24 mt-0.5">
                    {formatDateTime(log.created_at)}
                  </span>
                  <span className={`text-[10px] font-mono-num font-medium px-2 py-0.5 rounded border shrink-0 mt-0.5 ${style}`}>
                    {log.event_type}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-text">{log.message}</div>
                    {log.reason && <div className="text-xs text-text-dim mt-0.5">{log.reason}</div>}
                    {log.confidence != null && (
                      <div className="text-[10px] text-ai font-mono-num mt-0.5">{(log.confidence * 100).toFixed(0)}% confidence</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
