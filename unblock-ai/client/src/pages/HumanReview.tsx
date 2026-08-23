import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { HumanReviewAPI } from "../api/resources";
import { LoadingState, EmptyState } from "../components/common/States";
import { formatINR, faultPartyLabel, rootCauseLabel, timeAgo } from "../utils/format";
import ConfidenceScore from "../components/common/ConfidenceScore";

export default function HumanReview() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["human-review"],
    queryFn: () => HumanReviewAPI.list().then((r) => r.data.data),
    refetchInterval: 5000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["human-review"] });
  const approve = useMutation({ mutationFn: (id: string) => HumanReviewAPI.approve(id), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: (id: string) => HumanReviewAPI.reject(id), onSuccess: invalidate });

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-display font-semibold">Human Review</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Cases below the 70% automation confidence threshold — a human decides.
        </p>
      </div>

      {isLoading ? (
        <LoadingState label="Loading review queue" />
      ) : rows.length === 0 ? (
        <EmptyState title="Review queue is empty" subtitle="Ambiguous or low-confidence deadlocks will appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => (
            <div key={r.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono-num text-sm text-ai">{r.external_id}</span>
                  <span className="text-xs text-text-dim">· {r.customer_name} → {r.vendor_name}</span>
                </div>
                <div className="text-xs text-text-muted">
                  {faultPartyLabel(r.fault_party)} · {rootCauseLabel(r.root_cause)}
                </div>
                <div className="mt-1.5"><ConfidenceScore confidence={r.deadlock_confidence} /></div>
              </div>
              <div className="font-mono-num text-sm font-semibold">{formatINR(r.amount)}</div>
              <div className="text-[11px] text-text-dim font-mono-num">{timeAgo(r.created_at)}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => approve.mutate(r.id)}
                  disabled={approve.isPending}
                  className="flex items-center gap-1 bg-recovered text-bg rounded-lg px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-60"
                >
                  <Check size={13} /> Approve
                </button>
                <button
                  onClick={() => reject.mutate(r.id)}
                  disabled={reject.isPending}
                  className="flex items-center gap-1 border border-danger/40 text-danger rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-danger-dim disabled:opacity-60"
                >
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
