import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { DeadlocksAPI } from "../api/resources";
import { LoadingState, ErrorState } from "../components/common/States";
import StatusBadge from "../components/common/StatusBadge";
import ConfidenceScore from "../components/common/ConfidenceScore";
import { formatINR, formatDateTime, faultPartyLabel, rootCauseLabel } from "../utils/format";

export default function DeadlockDetail() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["deadlocks", "detail", id],
    queryFn: () => DeadlocksAPI.get(id!).then((r) => r.data.data),
    refetchInterval: 4000,
  });

  if (isLoading) return <LoadingState label="Loading deadlock" />;
  if (isError || !data) return <ErrorState message="Could not load this deadlock." onRetry={refetch} />;

  const { deadlock, actions } = data;
  const evidence: string[] = typeof deadlock.evidence === "string" ? JSON.parse(deadlock.evidence) : deadlock.evidence;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/deadlocks" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text">
        <ArrowLeft size={13} /> Back to deadlocks
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-display font-semibold font-mono-num">{deadlock.external_id}</h1>
            <StatusBadge status={deadlock.status} size="md" />
          </div>
          <p className="text-xs text-text-muted mt-1">
            {deadlock.customer_name} → {deadlock.vendor_name}
          </p>
        </div>
        <Link to={`/transactions/${deadlock.transaction_id}`} className="text-xs text-ai hover:underline">
          View full payment graph →
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-text-dim mb-1">Fault party</div>
            <div className="text-sm font-medium text-danger">{faultPartyLabel(deadlock.fault_party)}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-dim mb-1">Root cause</div>
            <div className="text-sm font-medium">{rootCauseLabel(deadlock.root_cause)}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-dim mb-1">Amount</div>
            <div className="text-sm font-mono-num font-medium">{formatINR(deadlock.amount)}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-dim mb-1">Confidence</div>
            <ConfidenceScore confidence={deadlock.confidence} />
          </div>
        </div>

        <div>
          <div className="text-[11px] text-text-dim mb-2">Evidence</div>
          <ul className="space-y-1.5">
            {evidence.map((e, i) => (
              <li key={i} className="text-xs text-text-muted flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-ai mt-1.5 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium mb-3">Recovery actions</h2>
        {actions.length === 0 ? (
          <div className="text-xs text-text-dim">No actions executed yet.</div>
        ) : (
          <div className="space-y-2">
            {actions.map((a: any) => (
              <div key={a.id} className="border border-border-soft rounded-lg p-3 text-xs flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium mb-0.5">{a.action_type.replace(/_/g, " ")}</div>
                  <div className="text-text-dim">{a.reason}</div>
                  <div className="text-text-dim mt-1 font-mono-num text-[10px]">{formatDateTime(a.created_at)}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
