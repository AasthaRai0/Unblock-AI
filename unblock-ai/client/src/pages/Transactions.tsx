import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { TransactionsAPI } from "../api/resources";
import StatusBadge from "../components/common/StatusBadge";
import { LoadingState, EmptyState } from "../components/common/States";
import { formatINR, formatDateTime } from "../utils/format";

const STATUS_FILTERS = ["", "PENDING", "SUCCESS", "FAILED", "DEADLOCKED", "RECOVERING", "RECOVERED", "ESCALATED"];

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, status, debouncedSearch],
    queryFn: () =>
      TransactionsAPI.list({ page, pageSize: 20, status: status || undefined, search: debouncedSearch || undefined }).then(
        (r) => r.data
      ),
  });

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-semibold">Transactions</h1>
        <span className="text-xs text-text-dim font-mono-num">{total.toLocaleString("en-IN")} total</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search TX-ID, customer, vendor…"
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-ai/50"
        />
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || "all"}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                status === s
                  ? "border-ai/50 bg-ai-dim text-ai"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <LoadingState label="Loading transactions" />
        ) : rows.length === 0 ? (
          <EmptyState title="No transactions found" subtitle="Try adjusting filters or generate demo data from the Command Center." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-text-dim">
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t: any) => (
                <tr key={t.id} className="border-b border-border-soft last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/transactions/${t.id}`} className="font-mono-num text-ai hover:underline">
                      {t.external_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{t.customer_name}</td>
                  <td className="px-4 py-3 text-text-muted">{t.vendor_name}</td>
                  <td className="px-4 py-3 font-mono-num">{formatINR(t.amount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-text-dim text-xs font-mono-num">{formatDateTime(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 rounded-md border border-border disabled:opacity-40 hover:border-ai/50"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded-md border border-border disabled:opacity-40 hover:border-ai/50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
