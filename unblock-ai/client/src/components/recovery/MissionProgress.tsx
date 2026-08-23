const STAGES = ["SCANNING", "CORRELATING", "ATTRIBUTING", "PLANNING", "EXECUTING", "VERIFYING", "RECOVERED"];

export default function MissionProgress({ currentStage }: { currentStage: string | null }) {
  const idx = currentStage ? STAGES.indexOf(currentStage) : -1;
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, i) => {
        const active = i === idx;
        const done = idx > i;
        return (
          <div key={stage} className="flex items-center shrink-0">
            <div
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono-num font-medium whitespace-nowrap transition-colors ${
                active
                  ? "bg-ai text-white"
                  : done
                  ? "bg-recovered-dim text-recovered"
                  : "bg-surface-3 text-text-dim"
              }`}
            >
              {stage}
            </div>
            {i < STAGES.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${done ? "bg-recovered" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
