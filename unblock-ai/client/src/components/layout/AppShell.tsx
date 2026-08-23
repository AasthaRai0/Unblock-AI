import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useLiveUpdates } from "../../hooks/useLiveUpdates";

export default function AppShell() {
  useLiveUpdates();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <main className="p-6 max-w-[1600px] mx-auto animate-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
