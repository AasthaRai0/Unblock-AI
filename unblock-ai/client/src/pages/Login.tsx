import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, loading, error, token } = useAuth();
  const [email, setEmail] = useState("admin@unblock.ai");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
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
        
        {/* Simple & Clean Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-ai/10 text-ai mb-3">
            <ShieldCheck size={26} />
          </div>
          <h1 className="font-display font-bold text-xl tracking-tight text-text">
            UNBLOCK <span className="text-ai">AI</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Revenue recovery command center
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-ai transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-10 py-2 text-sm focus:outline-none focus:border-ai transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text transition-colors focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-danger bg-danger-dim rounded-lg px-3 py-2 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-ai text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Sign in
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-5 pt-4 border-t border-border text-center">
            <p className="text-[11px] text-text-muted mb-1">
              Demo accounts (password: <code className="text-text">password123</code>)
            </p>
            <p className="text-[11px] text-text-dim font-mono">
              admin@unblock.ai · ops@unblock.ai · analyst@unblock.ai
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}