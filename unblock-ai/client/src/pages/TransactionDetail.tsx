import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { TransactionsAPI } from "../api/resources";
import { LoadingState, ErrorState } from "../components/common/States";
import StatusBadge from "../components/common/StatusBadge";
import PaymentGraph from "../components/payment/PaymentGraph";
import InvestigationDrawer from "../components/payment/InvestigationDrawer";
import TransactionTimeline from "../components/payment/TransactionTimeline";
import { formatINR, formatDateTime } from "../utils/format";

export default function TransactionDetail() {
  const { id } = useParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", "detail", id],
    queryFn: () => TransactionsAPI.get(id!).then((r) => r.data.data),
    refetchInterval: 4000,
  });

  if (isLoading) return <LoadingState label="Loading transaction" />;
  if (isError || !data) return <ErrorState message="Could not load this transaction." onRetry={refetch} />;

  const { transaction, nodes, deadlock, recoveryActions, auditLogs } = data;

  return (
    <div className="space-y-6">
      <Link to="/transactions" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text">
        <ArrowLeft size={13} /> Back to transactions
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-display font-semibold font-mono-num">{transaction.external_id}</h1>
            <StatusBadge status={transaction.status} size="md" />
          </div>
          <p className="text-xs text-text-muted mt-1">
            {transaction.customer_name} → {transaction.vendor_name} · {formatDateTime(transaction.created_at)}
          </p>
        </div>
        <div className="text-2xl font-display font-semibold font-mono-num">{formatINR(transaction.amount)}</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div>
            <h2 className="text-sm font-medium mb-2">Payment dependency graph</h2>
            <p className="text-[11px] text-text-dim mb-3">Click a red (failed) node to open the AI investigation.</p>
            <PaymentGraph
              nodes={nodes}
              amount={transaction.amount}
              onNodeClick={() => deadlock && setDrawerOpen(true)}
            />
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3">Timeline</h2>
            <TransactionTimeline logs={auditLogs} />
          </div>
        </div>

        <div className="space-y-4">
          {deadlock ? (
            <div className="bg-surface border border-border rounded-xl p-4">
              <h2 className="text-sm font-medium mb-3">AI Investigation</h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-dim">Fault</span>
                  <span className="font-medium text-danger">{deadlock.fault_party}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Root cause</span>
                  <span className="font-medium">{deadlock.root_cause.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Confidence</span>
                  <span className="font-mono-num font-medium">{(deadlock.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Status</span>
                  <StatusBadge status={deadlock.status} />
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-full mt-4 bg-ai text-white rounded-lg py-2 text-xs font-medium hover:opacity-90"
              >
                Open Investigation
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-4 text-xs text-text-dim">
              No deadlock detected for this transaction.
            </div>
          )}

          {recoveryActions?.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <h2 className="text-sm font-medium mb-3">Recovery actions</h2>
              <div className="space-y-2">
                {recoveryActions.map((a: any) => (
                  <div key={a.id} className="border border-border-soft rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{a.action_type.replace(/_/g, " ")}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="text-text-dim">{a.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {drawerOpen && deadlock && (
        <InvestigationDrawer deadlock={deadlock} onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  );
}
