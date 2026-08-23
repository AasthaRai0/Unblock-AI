import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { VendorsAPI } from "../api/resources";
import { LoadingState, EmptyState } from "../components/common/States";
import { formatINR, formatPercent } from "../utils/format";

export default function Vendors() {
  const { data, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => VendorsAPI.list({ pageSize: 50 }).then((r) => r.data),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-display font-semibold">Vendors</h1>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <LoadingState label="Loading vendors" />
        ) : rows.length === 0 ? (
          <EmptyState title="No vendors found" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-text-dim">
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Transactions</th>
                <th className="px-4 py-3 font-medium">Payout success</th>
                <th className="px-4 py-3 font-medium">Deadlocks</th>
                <th className="px-4 py-3 font-medium">Revenue at risk</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v: any) => (
                <tr key={v.id} className="border-b border-border-soft last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/vendors/${v.id}`} className="text-ai hover:underline font-medium">
                      {v.name}
                    </Link>
                    <div className="text-[10px] text-text-dim">{v.bank_name} •••• {v.account_last4}</div>
                  </td>
                  <td className="px-4 py-3 font-mono-num text-text-muted">{v.transaction_count}</td>
                  <td className="px-4 py-3 font-mono-num">{formatPercent(v.payout_success_rate)}</td>
                  <td className="px-4 py-3 font-mono-num text-danger">{v.active_deadlocks}</td>
                  <td className="px-4 py-3 font-mono-num text-risk">{formatINR(v.revenue_at_risk)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        v.kyc_status === "VERIFIED" && v.account_status === "ACTIVE"
                          ? "bg-recovered-dim text-recovered"
                          : "bg-danger-dim text-danger"
                      }`}
                    >
                      {v.kyc_status === "VERIFIED" && v.account_status === "ACTIVE" ? "Healthy" : "Needs attention"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
