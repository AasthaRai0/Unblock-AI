import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DeadlocksAPI } from "../api/resources";
import StatusBadge from "../components/common/StatusBadge";
import ConfidenceScore from "../components/common/ConfidenceScore";
import { LoadingState, EmptyState } from "../components/common/States";
import { formatINR, faultPartyLabel, rootCauseLabel, timeAgo } from "../utils/format";

const FAULT_FILTERS = ["", "CUSTOMER", "VENDOR", "PLATFORM", "GATEWAY", "AMBIGUOUS"];
const STATUS_FILTERS = ["", "OPEN", "INVESTIGATING", "RECOVERING", "RESOLVED", "ESCALATED"];

export default function Deadlocks() {
  const [page, setPage] = useState(1);
  const [faultParty, setFaultParty] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["deadlocks", page, faultParty, status],
    queryFn: () =>
      DeadlocksAPI.list({ page, pageSize: 20, faultParty: faultParty || undefined, status: status || undefined }).then(
        (r) => r.data
      ),
  });

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-semibold">Deadlocks</h1>
        <span className="text-xs text-text-dim font-mono-num">{total.toLocaleString("en-IN")} total</span>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] text-text-dim mr-1">Fault:</span>
          {FAULT_FILTERS.map((f) => (
            <button
              key={f || "all"}
              onClick={() => { setFaultParty(f); setPage(1); }}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                faultParty === f ? "border-ai/50 bg-ai-dim text-ai" : "border-border text-text-muted hover:text-text"
              }`}
            >
              {f ? faultPartyLabel(f) : "All"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] text-text-dim mr-1">Status:</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || "all"}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                status === s ? "border-ai/50 bg-ai-dim text-ai" : "border-border text-text-muted hover:text-text"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <LoadingState label="Loading deadlocks" />
        ) : rows.length === 0 ? (
          <EmptyState title="No deadlocks found" subtitle="Inject a scenario from the Command Center to see live detection." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-text-dim">
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 font-medium">Fault</th>
                <th className="px-4 py-3 font-medium">Root cause</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d: any) => (
                <tr key={d.id} className="border-b border-border-soft last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/deadlocks/${d.id}`} className="font-mono-num text-ai hover:underline">
                      {d.external_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{faultPartyLabel(d.fault_party)}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{rootCauseLabel(d.root_cause)}</td>
                  <td className="px-4 py-3"><ConfidenceScore confidence={d.confidence} /></td>
                  <td className="px-4 py-3 font-mono-num">{formatINR(d.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-text-dim text-xs font-mono-num">{timeAgo(d.detected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2.5 py-1 rounded-md border border-border disabled:opacity-40 hover:border-ai/50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-2.5 py-1 rounded-md border border-border disabled:opacity-40 hover:border-ai/50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
