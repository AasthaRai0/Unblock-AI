interface Props {
  status: string;
  size?: "sm" | "md";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  SUCCESS: { bg: "bg-recovered-dim", text: "text-recovered", dot: "bg-recovered" },
  RESOLVED: { bg: "bg-recovered-dim", text: "text-recovered", dot: "bg-recovered" },
  RECOVERED: { bg: "bg-recovered-dim", text: "text-recovered", dot: "bg-recovered" },
  COMPLETED: { bg: "bg-recovered-dim", text: "text-recovered", dot: "bg-recovered" },
  PENDING: { bg: "bg-risk-dim", text: "text-risk", dot: "bg-risk" },
  RECOVERING: { bg: "bg-ai-dim", text: "text-ai", dot: "bg-ai" },
  INVESTIGATING: { bg: "bg-ai-dim", text: "text-ai", dot: "bg-ai" },
  RUNNING: { bg: "bg-ai-dim", text: "text-ai", dot: "bg-ai" },
  OPEN: { bg: "bg-risk-dim", text: "text-risk", dot: "bg-risk" },
  FAILED: { bg: "bg-danger-dim", text: "text-danger", dot: "bg-danger" },
  DEADLOCKED: { bg: "bg-danger-dim", text: "text-danger", dot: "bg-danger" },
  ESCALATED: { bg: "bg-danger-dim", text: "text-danger", dot: "bg-danger" },
  BLOCKED: { bg: "bg-danger-dim", text: "text-danger", dot: "bg-danger" },
  STOPPED: { bg: "bg-surface-3", text: "text-text-muted", dot: "bg-text-dim" },
  DRAFT: { bg: "bg-surface-3", text: "text-text-muted", dot: "bg-text-dim" },
  PAUSED: { bg: "bg-risk-dim", text: "text-risk", dot: "bg-risk" },
};

export default function StatusBadge({ status, size = "sm" }: Props) {
  const style = STATUS_STYLES[status] ?? { bg: "bg-surface-3", text: "text-text-muted", dot: "bg-text-dim" };
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium font-mono-num tracking-wide ${style.bg} ${style.text} ${pad}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
