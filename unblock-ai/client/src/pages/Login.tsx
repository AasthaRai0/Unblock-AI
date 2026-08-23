import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, loading, error, token } = useAuth();
  const [email, setEmail] = useState("admin@unblock.ai");
  const [password, setPassword] = useState("password123");
  const navigate = useNavigate();

  if (token) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      // error surfaced via context
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-ai/15 flex items-center justify-center">
            <Zap size={18} className="text-ai" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">
            UNBLOCK <span className="text-ai">AI</span>
          </span>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h1 className="text-base font-semibold mb-1">Sign in</h1>
          <p className="text-xs text-text-muted mb-6">Revenue recovery command center</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ai/50"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ai/50"
              />
            </div>

            {error && <div className="text-xs text-danger bg-danger-dim rounded-lg px-3 py-2">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-ai text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Sign in
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border text-[11px] text-text-dim leading-relaxed">
            Demo accounts (password: password123)
            <br />
            admin@unblock.ai · ops@unblock.ai · analyst@unblock.ai
          </div>
        </div>
      </div>
    </div>
  );
}
