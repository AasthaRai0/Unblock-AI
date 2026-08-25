import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  
  // Account State
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [editingAccount, setEditingAccount] = useState(false);

  // Policy State
  const [threshold, setThreshold] = useState("70");
  const [maxRetries, setMaxRetries] = useState("3");
  const [autoRouting, setAutoRouting] = useState(true);

  const handleSave = async () => {
    // 1. Backend update call here (e.g., await api.updateSettings(...))
    setSaved(true);
    setEditingAccount(false); // Close edit mode
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    // Reset values to original
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setEditingAccount(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-display font-semibold text-text-main">Settings</h1>
          <p className="text-sm text-text-dim">Manage your engine thresholds and policy rules.</p>
        </div>
        <div className="flex items-center gap-3">
          {(editingAccount || threshold !== "70" || maxRetries !== "3" || !autoRouting) && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-text-dim bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition flex items-center gap-2"
          >
            {saved ? (
              <><span>✓</span> Saved!</>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {/* Account Section - NOW EDITABLE */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
            <span>👤</span> Account Details
          </h2>
          {!editingAccount ? (
            <button 
              onClick={() => setEditingAccount(true)}
              className="text-xs font-medium text-indigo-500 hover:text-indigo-400"
            >
              Edit
            </button>
          ) : (
             <span className="text-xs text-text-dim">Editing...</span>
          )}
        </div>
        
        <div className="space-y-4 text-sm">
          {editingAccount ? (
            // Edit Mode
            <>
              <InputRow label="Name" value={name} onChange={setName} placeholder="Your Full Name" />
              <InputRow label="Email" value={email} onChange={setEmail} placeholder="you@company.com" type="email" />
            </>
          ) : (
            // View Mode
            <div className="divide-y divide-border-soft">
              <Row label="Name" value={user?.name ?? "—"} />
              <Row label="Email" value={user?.email ?? "—"} />
            </div>
          )}
          
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-dim">Role</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 capitalize">
              {user?.role ?? "User"}
            </span>
          </div>
        </div>
      </div>

      {/* Environment Section */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-text-main mb-4 flex items-center gap-2">
          <span>⚙️</span> Environment Configuration
        </h2>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border-soft">
            <span className="text-text-dim">Payment Mode</span>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Razorpay Test Mode
            </span>
          </div>

          <Row label="AI Engine" value="Deterministic rule-based (v1)" />

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-text-main">Automation Threshold</p>
              <p className="text-xs text-text-dim">Minimum confidence score to trigger auto-actions</p>
            </div>
            <select
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value="60">60% Confidence</option>
              <option value="70">70% Confidence</option>
              <option value="80">80% Confidence</option>
              <option value="90">90% Confidence</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recovery Policy Defaults */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-text-main mb-4 flex items-center gap-2">
          <span>🛡️</span> Recovery Policy Defaults
        </h2>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border-soft">
            <div>
              <p className="font-medium text-text-main">Customer Retries</p>
              <p className="text-xs text-text-dim">Retry attempts within 72 hours window</p>
            </div>
            <input
              type="number"
              min="1"
              max="5"
              value={maxRetries}
              onChange={(e) => setMaxRetries(e.target.value)}
              className="w-16 bg-background border border-border rounded-md px-2 py-1 text-center font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <Row label="Vendor Faults" value="Notify + pause settlement until corrected" />
          <Row label="Platform Faults" value="Pause flows, avoid re-charge, escalate ops" />

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-text-main">Ambiguous Routing</p>
              <p className="text-xs text-text-dim">Route low-confidence cases to human review</p>
            </div>
            <button
              onClick={() => setAutoRouting(!autoRouting)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                autoRouting ? "bg-indigo-600 justify-end" : "bg-zinc-700 justify-start"
              }`}
            >
              <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Read-only Row
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-text-dim">{label}</span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}

// Editable Input Row
function InputRow({ label, value, onChange, placeholder, type = "text" }: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <label className="text-text-dim min-w-[60px]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
      />
    </div>
  );
}