import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { VendorsAPI } from "../api/resources";
import { LoadingState, ErrorState } from "../components/common/States";
import StatusBadge from "../components/common/StatusBadge";
import { formatINR, formatPercent, rootCauseLabel, timeAgo } from "../utils/format";

export default function VendorDetail() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendors", "detail", id],
    queryFn: () => VendorsAPI.health(id!).then((r) => r.data.data),
  });

  if (isLoading) return <LoadingState label="Loading vendor" />;
  if (isError || !data) return <ErrorState message="Could not load this vendor." onRetry={refetch} />;

  const { vendor, deadlockHistory, revenueAtRisk, failurePatterns, recommendation } = data;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/vendors" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text">
        <ArrowLeft size={13} /> Back to vendors
      </Link>

      <div>
        <h1 className="text-lg font-display font-semibold">{vendor.name}</h1>
        <p className="text-xs text-text-muted mt-1">
          {vendor.bank_name} •••• {vendor.account_last4} · {vendor.ifsc}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Payout success rate" value={formatPercent(vendor.payout_success_rate)} />
        <MetricCard label="KYC status" value={vendor.kyc_status.replace(/_/g, " ")} danger={vendor.kyc_status !== "VERIFIED"} />
        <MetricCard label="Bank status" value={vendor.account_status.replace(/_/g, " ")} danger={vendor.account_status !== "ACTIVE"} />
        <MetricCard label="Revenue at risk" value={formatINR(revenueAtRisk)} danger={revenueAtRisk > 0} />
      </div>

      <div className="bg-ai-dim border border-ai/30 rounded-xl p-4 flex gap-3">
        <Lightbulb size={16} className="text-ai shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-medium text-ai mb-1">AI recommendation</div>
          <div className="text-sm text-text">{recommendation}</div>
        </div>
      </div>

      {failurePatterns.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium mb-3">Failure patterns</h2>
          <div className="space-y-2">
            {failurePatterns.map((f: any) => (
              <div key={f.root_cause} className="flex items-center justify-between text-xs">
                <span className="text-text-muted">{rootCauseLabel(f.root_cause)}</span>
                <span className="font-mono-num">{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">Deadlock history</h2>
        {deadlockHistory.length === 0 ? (
          <div className="text-xs text-text-dim">No deadlocks recorded for this vendor.</div>
        ) : (
          <div className="space-y-2">
            {deadlockHistory.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between border border-border-soft rounded-lg px-3 py-2 text-xs">
                <span className="text-text-muted">{rootCauseLabel(d.root_cause)}</span>
                <span className="text-text-dim font-mono-num">{timeAgo(d.detected_at)}</span>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <div className="text-[11px] text-text-dim mb-1">{label}</div>
      <div className={`text-sm font-mono-num font-semibold ${danger ? "text-danger" : "text-text"}`}>{value}</div>
    </div>
  );
}
