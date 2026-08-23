import { useQuery } from "@tanstack/react-query";
import { AlertCircle, TrendingUp, Unlink, RefreshCcw, Brain, UserCheck, Sparkles } from "lucide-react";
import { DashboardAPI } from "../api/resources";
import KPICard from "../components/dashboard/KPICard";
import RevenueChart from "../components/dashboard/RevenueChart";
import FaultDistribution from "../components/dashboard/FaultDistribution";
import LiveActivity from "../components/dashboard/LiveActivity";
import { formatINR, formatPercent } from "../utils/format";
import { LoadingState } from "../components/common/States";
import SimulationCenter from "../components/dashboard/SimulationCenter";

export default function Dashboard() {
  const summaryQ = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => DashboardAPI.summary().then((r) => r.data.data),
    refetchInterval: 8000,
  });
  const trendQ = useQuery({
    queryKey: ["dashboard", "trend"],
    queryFn: () => DashboardAPI.revenueTrend().then((r) => r.data.data),
  });
  const faultQ = useQuery({
    queryKey: ["dashboard", "fault-distribution"],
    queryFn: () => DashboardAPI.faultDistribution().then((r) => r.data.data),
  });
  const eventsQ = useQuery({
    queryKey: ["dashboard", "events"],
    queryFn: () => DashboardAPI.recentEvents(20).then((r) => r.data.data),
    refetchInterval: 5000,
  });

  if (summaryQ.isLoading) return <LoadingState label="Loading command center" />;
  const s = summaryQ.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-semibold">Command Center</h1>
          <p className="text-xs text-text-muted mt-0.5">Where is the money stuck — and what should we do next?</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard
          label="Revenue at Risk"
          value={formatINR(s.revenueAtRisk, true)}
          icon={<AlertCircle size={14} />}
          accent="risk"
        />
        <KPICard
          label="Revenue Recovered"
          value={formatINR(s.revenueRecovered, true)}
          icon={<TrendingUp size={14} />}
          accent="recovered"
        />
        <KPICard
          label="Active Deadlocks"
          value={String(s.activeDeadlocks)}
          icon={<Unlink size={14} />}
          accent="danger"
        />
        <KPICard
          label="Recovery Rate"
          value={formatPercent(s.recoveryRate)}
          icon={<RefreshCcw size={14} />}
          accent="ai"
        />
        <KPICard
          label="AI Attribution Accuracy"
          value={formatPercent(s.aiAttributionAccuracy)}
          icon={<Brain size={14} />}
          accent="ai"
        />
        <KPICard
          label="Human Review"
          value={String(s.humanReviewQueue)}
          icon={<UserCheck size={14} />}
          accent="risk"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">Revenue trend (14 days)</h2>
            <div className="flex items-center gap-3 text-[11px] text-text-dim">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-risk inline-block" />At risk</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-recovered inline-block" />Recovered</span>
            </div>
          </div>
          {trendQ.data && <RevenueChart data={trendQ.data} />}
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium mb-2">Fault distribution</h2>
          {faultQ.data && <FaultDistribution data={faultQ.data} />}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium">Live activity</h2>
            <span className="text-[10px] text-text-dim font-mono-num flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-recovered pulse-dot" /> streaming
            </span>
          </div>
          {eventsQ.data && <LiveActivity logs={eventsQ.data} />}
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-ai" />
            <h2 className="text-sm font-medium">Simulation Center</h2>
          </div>
          <SimulationCenter />
        </div>
      </div>
    </div>
  );
}
