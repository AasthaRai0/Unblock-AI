import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-lg font-display font-semibold">Settings</h1>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <Row label="Name" value={user?.name ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Role" value={user?.role ?? "—"} />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium mb-4">Environment</h2>
        <div className="space-y-3 text-sm">
          <Row label="Payment mode" value="Razorpay Test Mode" />
          <Row label="AI engine" value="Deterministic rule-based fault attribution (v1)" />
          <Row label="Automation threshold" value="70% confidence" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium mb-4">Recovery policy defaults</h2>
        <div className="space-y-3 text-sm">
          <Row label="Customer retries" value="Max 3 within 72 hours" />
          <Row label="Vendor faults" value="Notify + pause settlement until corrected" />
          <Row label="Platform faults" value="Pause flows, never re-charge customers, escalate ops" />
          <Row label="Ambiguous cases" value="Always routed to human review" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-soft last:border-0">
      <span className="text-text-dim">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
