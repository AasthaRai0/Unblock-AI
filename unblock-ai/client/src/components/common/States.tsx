import { Loader2, Inbox, AlertTriangle } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
      <Loader2 className="animate-spin" size={22} />
      <span className="text-sm font-mono-num">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted text-center px-6">
      <Inbox size={22} className="mb-1 opacity-60" />
      <span className="text-sm font-medium text-text">{title}</span>
      {subtitle && <span className="text-xs text-text-dim max-w-sm">{subtitle}</span>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <AlertTriangle size={22} className="text-danger" />
      <span className="text-sm text-text">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-danger hover:text-danger transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
