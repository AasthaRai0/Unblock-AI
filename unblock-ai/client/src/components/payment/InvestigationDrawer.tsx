import { X, Brain, Send, RefreshCcw, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ConfidenceScore from "../common/ConfidenceScore";
import { DeadlocksAPI } from "../../api/resources";
import { faultPartyLabel, rootCauseLabel } from "../../utils/format";

interface Deadlock {
  id: string;
  fault_party: string;
  root_cause: string;
  confidence: number;
  evidence: string[] | string;
  alternative_hypotheses: { cause: string; confidence: number }[] | string;
  recommended_action: string;
  status: string;
}

export default function InvestigationDrawer({
  deadlock,
  onClose,
}: {
  deadlock: Deadlock;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const evidence: string[] = typeof deadlock.evidence === "string" ? JSON.parse(deadlock.evidence) : deadlock.evidence;
  const alternatives: { cause: string; confidence: number }[] =
    typeof deadlock.alternative_hypotheses === "string"
      ? JSON.parse(deadlock.alternative_hypotheses)
      : deadlock.alternative_hypotheses;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["deadlocks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const resolve = useMutation({
    mutationFn: () => DeadlocksAPI.resolve(deadlock.id),
    onSuccess: invalidate,
  });
  const markRecovered = useMutation({
    mutationFn: () => DeadlocksAPI.markRecovered(deadlock.id),
    onSuccess: invalidate,
  });
  const escalate = useMutation({
    mutationFn: () => DeadlocksAPI.escalate(deadlock.id, "Manually escalated from investigation drawer"),
    onSuccess: invalidate,
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm h-full bg-surface border-l border-border overflow-y-auto animate-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-ai" />
            <h2 className="text-sm font-medium">AI Investigation</h2>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="text-[11px] text-text-dim mb-1">Fault</div>
            <div className="text-lg font-display font-semibold text-danger">{faultPartyLabel(deadlock.fault_party)}</div>
          </div>

          <div>
            <div className="text-[11px] text-text-dim mb-1">Root cause</div>
            <div className="text-sm font-medium">{rootCauseLabel(deadlock.root_cause)}</div>
          </div>

          <div>
            <div className="text-[11px] text-text-dim mb-1.5">Confidence</div>
            <ConfidenceScore confidence={deadlock.confidence} />
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

          {alternatives?.length > 0 && (
            <div>
              <div className="text-[11px] text-text-dim mb-2">Alternative hypotheses</div>
              <div className="space-y-1.5">
                {alternatives.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{faultPartyLabel(a.cause)}</span>
                    <span className="font-mono-num text-text-dim">{(a.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] text-text-dim mb-1">Recommended action</div>
            <div className="text-sm font-medium text-ai">{deadlock.recommended_action?.replace(/_/g, " ")}</div>
          </div>

          {deadlock.status !== "RESOLVED" && (
            <div className="pt-4 border-t border-border space-y-2">
              <button
                onClick={() => resolve.mutate()}
                disabled={resolve.isPending}
                className="w-full flex items-center justify-center gap-2 bg-ai text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                <Send size={14} />
                {deadlock.fault_party === "VENDOR" ? "Notify Vendor" : deadlock.fault_party === "CUSTOMER" ? "Retry Payment" : "Execute Recommended Action"}
              </button>
              <button
                onClick={() => markRecovered.mutate()}
                disabled={markRecovered.isPending}
                className="w-full flex items-center justify-center gap-2 border border-recovered/40 text-recovered rounded-lg py-2 text-xs font-medium hover:bg-recovered-dim disabled:opacity-60"
              >
                <RefreshCcw size={13} />
                Retry Settlement / Mark Recovered
              </button>
              <button
                onClick={() => escalate.mutate()}
                disabled={escalate.isPending}
                className="w-full flex items-center justify-center gap-2 border border-danger/40 text-danger rounded-lg py-2 text-xs font-medium hover:bg-danger-dim disabled:opacity-60"
              >
                <AlertTriangle size={13} />
                Escalate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
