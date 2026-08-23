interface Props {
  confidence: number; // 0-1
  showLabel?: boolean;
}

export default function ConfidenceScore({ confidence, showLabel = true }: Props) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? "var(--color-recovered)" : pct >= 40 ? "var(--color-risk)" : "var(--color-danger)";
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="font-mono-num text-xs tabular-nums" style={{ color }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
