import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  ArrowLeftRight,
  Unlink,
  Workflow,
  Building2,
  BarChart3,
  UserCheck,
  ScrollText,
  Settings,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Command Center", icon: LayoutGrid },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/deadlocks", label: "Deadlocks", icon: Unlink },
  { to: "/recovery-missions", label: "Recovery Missions", icon: Workflow },
  { to: "/vendors", label: "Vendors", icon: Building2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/human-review", label: "Human Review", icon: UserCheck },
  { to: "/audit-log", label: "Audit Trail", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-ai/15 flex items-center justify-center">
          <Zap size={15} className="text-ai" />
        </div>
        <span className="font-display font-semibold text-sm tracking-tight">
          UNBLOCK <span className="text-ai">AI</span>
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-ai-dim text-text font-medium"
                  : "text-text-muted hover:text-text hover:bg-surface-2"
              }`
            }
          >
            <item.icon size={16} strokeWidth={1.8} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-[11px] text-text-dim leading-relaxed font-mono-num">
          Razorpay Test Mode
          <br />
          AI Engine Online
        </div>
      </div>
    </aside>
  );
}
