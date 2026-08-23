import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import { RecoveryAPI } from "../../api/resources";
import { formatINR, formatPercent } from "../../utils/format";
import MissionProgress from "./MissionProgress";

export default function RecoveryMissionCard({ mission, liveStage }: { mission: any; liveStage: string | null }) {
  const queryClient = useQueryClient();

  const start = useMutation({
    mutationFn: () => RecoveryAPI.startMission(mission.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["missions"] }),
  });
  const stop = useMutation({
    mutationFn: () => RecoveryAPI.stopMission(mission.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["missions"] }),
  });

  const recoveryPct =
    mission.deadlocks_detected > 0 ? (mission.successful_recoveries / mission.deadlocks_detected) * 100 : 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium">{mission.name}</h3>
          {mission.objective && <p className="text-[11px] text-text-dim mt-0.5">{mission.objective}</p>}
        </div>
        <StatusBadge status={mission.status} />
      </div>

      {mission.status === "RUNNING" && <MissionProgress currentStage={liveStage} />}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Stat label="Scanned" value={String(mission.transactions_scanned ?? 0)} />
        <Stat label="Deadlocks" value={String(mission.deadlocks_detected ?? 0)} />
        <Stat label="Recoverable" value={String(mission.recoverable_count ?? 0)} />
        <Stat label="Actions" value={String(mission.actions_executed ?? 0)} />
        <Stat label="Recovered" value={String(mission.successful_recoveries ?? 0)} />
        <Stat label="Success rate" value={formatPercent(recoveryPct)} />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border-soft">
        <div>
          <div className="text-[10px] text-text-dim">Revenue at risk</div>
          <div className="text-sm font-mono-num font-semibold text-risk">{formatINR(mission.amount_at_risk ?? 0, true)}</div>
        </div>
        <div>
          <div className="text-[10px] text-text-dim">Revenue recovered</div>
          <div className="text-sm font-mono-num font-semibold text-recovered">{formatINR(mission.amount_recovered ?? 0, true)}</div>
        </div>
      </div>

      <div className="text-[10px] text-text-dim font-mono-num pt-1">
        Max retries {mission.max_retries} · Min confidence {(mission.minimum_confidence * 100).toFixed(0)}% · Max auto ₹{Number(mission.max_automated_amount).toLocaleString("en-IN")} · Window {mission.recovery_window_hours}h
      </div>

      <div className="flex gap-2">
        {mission.status !== "RUNNING" ? (
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 bg-ai text-white rounded-lg py-2 text-xs font-medium hover:opacity-90 disabled:opacity-60"
          >
            <Play size={12} /> Start Mission
          </button>
        ) : (
          <button
            onClick={() => stop.mutate()}
            disabled={stop.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 border border-danger/40 text-danger rounded-lg py-2 text-xs font-medium hover:bg-danger-dim disabled:opacity-60"
          >
            <Square size={12} /> Stop
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-text-dim">{label}</div>
      <div className="font-mono-num font-medium">{value}</div>
    </div>
  );
}
