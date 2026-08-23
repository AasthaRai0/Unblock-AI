export function formatINR(amount: number | string, compact = false): string {
  const n = Number(amount) || 0;
  if (compact) {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  }
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatPercent(n: number | string, digits = 1): string {
  return `${Number(n).toFixed(digits)}%`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function faultPartyLabel(fp: string): string {
  const map: Record<string, string> = {
    CUSTOMER: "Customer",
    VENDOR: "Vendor",
    PLATFORM: "Platform",
    GATEWAY: "Gateway",
    AMBIGUOUS: "Ambiguous",
  };
  return map[fp] ?? fp;
}

export function rootCauseLabel(rc: string): string {
  return rc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
