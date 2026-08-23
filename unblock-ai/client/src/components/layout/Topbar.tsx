import { Search, Wifi, Bell, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-border bg-bg/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6 gap-4">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            placeholder="Search transactions, vendors, TX-ID…"
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-text-dim focus:outline-none focus:border-ai/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-1.5 text-xs text-text-muted font-mono-num">
          <Wifi size={13} className="text-recovered" />
          Razorpay Test Mode
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-text-muted font-mono-num">
          <span className="w-1.5 h-1.5 rounded-full bg-ai pulse-dot" />
          AI Engine: Online
        </div>

        <button className="relative p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors">
          <Bell size={16} />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-ai-dim flex items-center justify-center text-xs font-medium text-ai">
            {user?.name?.[0] ?? "U"}
          </div>
          <div className="hidden md:block leading-tight">
            <div className="text-xs font-medium">{user?.name ?? "User"}</div>
            <div className="text-[10px] text-text-dim">{user?.role ?? ""}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="p-1.5 rounded-md text-text-dim hover:text-danger hover:bg-danger-dim transition-colors ml-1"
            title="Log out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
