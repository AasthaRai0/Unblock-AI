import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { RecoveryAPI } from "../api/resources";
import { LoadingState, EmptyState } from "../components/common/States";
import RecoveryMissionCard from "../components/recovery/RecoveryMissionCard";
import { useEffect, useState as useState2 } from "react";
import { getSocket } from "../sockets/socket";

export default function RecoveryMissions() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [liveStages, setLiveStages] = useState2<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: () => RecoveryAPI.listMissions().then((r) => r.data.data),
    refetchInterval: 3000,
  });

  useEffect(() => {
    const socket = getSocket();
    const handler = (payload: any) => {
      if (payload?.missionId) {
        setLiveStages((prev) => ({ ...prev, [payload.missionId]: payload.stage }));
      }
    };
    socket.on("mission:progress", handler);
    return () => {
      socket.off("mission:progress", handler);
    };
  }, []);

  const [form, setForm] = useState({
    name: "",
    objective: "",
    maxRetries: 3,
    maxAutomatedAmount: 50000,
    minimumConfidence: 0.7,
    recoveryWindowHours: 72,
  });

  const create = useMutation({
    mutationFn: () => RecoveryAPI.createMission(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      setShowForm(false);
      setForm({ name: "", objective: "", maxRetries: 3, maxAutomatedAmount: 50000, minimumConfidence: 0.7, recoveryWindowHours: 72 });
    },
  });

  const missions = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-semibold">Recovery Missions</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Detect → diagnose → attribute → decide → act → verify → recover → audit
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-ai text-white rounded-lg px-3 py-2 text-xs font-medium hover:opacity-90"
        >
          <Plus size={14} /> Start Recovery Mission
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">New recovery mission</h2>
            <button onClick={() => setShowForm(false)} className="text-text-dim hover:text-text">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mission name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Q1 Recovery Sweep"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ai/50"
              />
            </Field>
            <Field label="Objective">
              <input
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                placeholder="Recover stuck revenue across the marketplace"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ai/50"
              />
            </Field>
            <Field label="Maximum retries">
              <input
                type="number"
                value={form.maxRetries}
                onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ai/50"
              />
            </Field>
            <Field label="Maximum automated amount (₹)">
              <input
                type="number"
                value={form.maxAutomatedAmount}
                onChange={(e) => setForm({ ...form, maxAutomatedAmount: Number(e.target.value) })}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ai/50"
              />
            </Field>
            <Field label="Minimum AI confidence">
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={form.minimumConfidence}
                onChange={(e) => setForm({ ...form, minimumConfidence: Number(e.target.value) })}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ai/50"
              />
            </Field>
            <Field label="Recovery window (hours)">
              <input
                type="number"
                value={form.recoveryWindowHours}
                onChange={(e) => setForm({ ...form, recoveryWindowHours: Number(e.target.value) })}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ai/50"
              />
            </Field>
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={!form.name || create.isPending}
            className="mt-4 bg-ai text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            Create Mission
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Loading missions" />
      ) : missions.length === 0 ? (
        <EmptyState title="No recovery missions yet" subtitle="Start one to sweep failed transactions and recover revenue with guardrails." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {missions.map((m: any) => (
            <RecoveryMissionCard key={m.id} mission={m} liveStage={liveStages[m.id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-text-muted block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
