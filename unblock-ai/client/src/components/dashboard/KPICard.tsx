import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  sublabel?: string;
  icon: ReactNode;
  accent?: "risk" | "recovered" | "ai" | "danger" | "default";
}

const ACCENT_MAP = {
  risk: { text: "text-risk", bg: "bg-risk-dim" },
  recovered: { text: "text-recovered", bg: "bg-recovered-dim" },
  ai: { text: "text-ai", bg: "bg-ai-dim" },
  danger: { text: "text-danger", bg: "bg-danger-dim" },
  default: { text: "text-text", bg: "bg-surface-3" },
};

export default function KPICard({ label, value, sublabel, icon, accent = "default" }: Props) {
  const style = ACCENT_MAP[accent];
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center ${style.text}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className={`text-2xl font-display font-semibold font-mono-num tabular-nums ${style.text}`}>
          {value}
        </div>
        {sublabel && <div className="text-[11px] text-text-dim mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
