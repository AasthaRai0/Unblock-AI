import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap } from "lucide-react";
import { SimulatorAPI } from "../../api/resources";

const SCENARIOS = [
  { key: "CUSTOMER_CARD_FAILURE", label: "Customer card failure" },
  { key: "VENDOR_KYC_EXPIRED", label: "Vendor KYC expired" },
  { key: "VENDOR_INVALID_IFSC", label: "Vendor invalid IFSC" },
  { key: "PLATFORM_GATEWAY_OUTAGE", label: "Platform gateway outage" },
  { key: "SPLIT_MISMATCH", label: "Split calculation mismatch" },
  { key: "MULTI_VENDOR_OUTAGE", label: "Multiple vendors failing" },
  { key: "AMBIGUOUS_FAILURE", label: "Ambiguous failure" },
];

const BATCH_SIZES = [100, 500, 1000, 5000];

export default function SimulationCenter() {
  const queryClient = useQueryClient();
  const [scenario, setScenario] = useState(SCENARIOS[0].key);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  const inject = useMutation({
    mutationFn: () => SimulatorAPI.createDeadlock(scenario),
    onSuccess: (res) => {
      const d = res.data.data.deadlock;
      setLastResult(`${d.fault_party} fault · ${(d.confidence * 100).toFixed(0)}% confidence`);
      invalidateAll();
    },
  });

  const generate = useMutation({
    mutationFn: (count: number) => SimulatorAPI.runBatch(count),
    onSuccess: (res, count) => {
      setLastResult(`Generated ${count} transactions, ${res.data.data.deadlocksCreated} deadlocks detected`);
      invalidateAll();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] text-text-muted block mb-1.5">Inject a scenario</label>
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-ai/50"
        >
          {SCENARIOS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => inject.mutate()}
          disabled={inject.isPending}
          className="w-full mt-2 flex items-center justify-center gap-1.5 bg-ai text-white rounded-lg py-2 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {inject.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
          Inject Deadlock
        </button>
      </div>

      <div className="pt-3 border-t border-border-soft">
        <label className="text-[11px] text-text-muted block mb-1.5">Generate batch</label>
        <div className="grid grid-cols-4 gap-1.5">
          {BATCH_SIZES.map((n) => (
            <button
              key={n}
              onClick={() => generate.mutate(n)}
              disabled={generate.isPending}
              className="text-[11px] font-mono-num py-1.5 rounded-md border border-border hover:border-ai/50 hover:text-ai transition-colors disabled:opacity-50"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {(inject.isPending || generate.isPending) && (
        <div className="text-[11px] text-ai flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" /> Processing…
        </div>
      )}

      {lastResult && !inject.isPending && !generate.isPending && (
        <div className="text-[11px] text-text-muted bg-surface-2 rounded-lg px-2.5 py-2 leading-relaxed">
          {lastResult}
        </div>
      )}
    </div>
  );
}
