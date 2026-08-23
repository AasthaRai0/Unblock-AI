import { useQuery } from "@tanstack/react-query";
import { DashboardAPI } from "../api/resources";
import RevenueChart from "../components/dashboard/RevenueChart";
import FaultDistribution from "../components/dashboard/FaultDistribution";
import { LoadingState } from "../components/common/States";
import { formatINR, formatPercent, faultPartyLabel } from "../utils/format";

export default function Analytics() {
  const summaryQ = useQuery({ queryKey: ["dashboard", "summary"], queryFn: () => DashboardAPI.summary().then((r) => r.data.data) });
  const trendQ = useQuery({ queryKey: ["dashboard", "trend"], queryFn: () => DashboardAPI.revenueTrend().then((r) => r.data.data) });
  const faultQ = useQuery({ queryKey: ["dashboard", "fault-distribution"], queryFn: () => DashboardAPI.faultDistribution().then((r) => r.data.data) });

  if (summaryQ.isLoading || trendQ.isLoading || faultQ.isLoading) return <LoadingState label="Loading analytics" />;

  const totalFaultAmount = (faultQ.data ?? []).reduce((s: number, f: any) => s + Number(f.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-display font-semibold">Analytics</h1>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium mb-2">Revenue trend</h2>
          <RevenueChart data={trendQ.data} />
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium mb-2">Fault distribution</h2>
          <FaultDistribution data={faultQ.data} />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">Fault breakdown by revenue impact</h2>
        <div className="space-y-3">
          {(faultQ.data ?? []).map((f: any) => {
            const pct = totalFaultAmount > 0 ? (Number(f.amount) / totalFaultAmount) * 100 : 0;
            return (
              <div key={f.fault_party}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text-muted">{faultPartyLabel(f.fault_party)}</span>
                  <span className="font-mono-num">{formatINR(f.amount)} · {f.count} deadlocks</span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-ai rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="Recovery rate" value={formatPercent(summaryQ.data.recoveryRate)} />
        <SummaryStat label="AI accuracy" value={formatPercent(summaryQ.data.aiAttributionAccuracy)} />
        <SummaryStat label="Revenue recovered" value={formatINR(summaryQ.data.revenueRecovered, true)} />
        <SummaryStat label="Revenue at risk" value={formatINR(summaryQ.data.revenueAtRisk, true)} />
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-[11px] text-text-dim mb-1">{label}</div>
      <div className="text-lg font-display font-semibold font-mono-num">{value}</div>
    </div>
  );
}
