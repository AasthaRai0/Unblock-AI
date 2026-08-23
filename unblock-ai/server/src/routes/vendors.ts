import { Router } from "express";
import { query, queryOne } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Number(req.query.pageSize ?? 20));
  const rows = await query(
    `SELECT v.*,
       COUNT(t.id)::int as transaction_count,
       COUNT(d.id) FILTER (WHERE d.status != 'RESOLVED')::int as active_deadlocks,
       COALESCE(SUM(t.amount) FILTER (WHERE d.status != 'RESOLVED'), 0) as revenue_at_risk
     FROM vendors v
     LEFT JOIN transactions t ON t.vendor_id = v.id
     LEFT JOIN deadlocks d ON d.transaction_id = t.id
     GROUP BY v.id
     ORDER BY revenue_at_risk DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize]
  );
  const countRow = await queryOne<{ count: string }>(`SELECT COUNT(*)::text as count FROM vendors`);
  res.json({ success: true, data: rows, meta: { page, pageSize, total: countRow ? parseInt(countRow.count, 10) : 0 } });
});

router.get("/:id", async (req, res) => {
  const vendor = await queryOne(`SELECT * FROM vendors WHERE id = $1`, [req.params.id]);
  if (!vendor) return res.status(404).json({ success: false, error: { code: "VENDOR_NOT_FOUND", message: "Vendor not found" } });
  res.json({ success: true, data: vendor });
});

router.get("/:id/health", async (req, res) => {
  const vendor = await queryOne(`SELECT * FROM vendors WHERE id = $1`, [req.params.id]);
  if (!vendor) return res.status(404).json({ success: false, error: { code: "VENDOR_NOT_FOUND", message: "Vendor not found" } });

  const deadlockHistory = await query(
    `SELECT d.* FROM deadlocks d JOIN transactions t ON t.id = d.transaction_id WHERE t.vendor_id = $1 ORDER BY d.detected_at DESC LIMIT 20`,
    [req.params.id]
  );
  const riskRow = await queryOne<{ sum: string }>(
    `SELECT COALESCE(SUM(t.amount),0)::text as sum FROM transactions t
     JOIN deadlocks d ON d.transaction_id = t.id
     WHERE t.vendor_id = $1 AND d.status != 'RESOLVED'`,
    [req.params.id]
  );
  const faultRows = await query<{ root_cause: string; count: string }>(
    `SELECT root_cause, COUNT(*)::text as count FROM deadlocks d
     JOIN transactions t ON t.id = d.transaction_id
     WHERE t.vendor_id = $1 GROUP BY root_cause ORDER BY count DESC`,
    [req.params.id]
  );

  let recommendation = "No action needed — vendor is healthy.";
  if ((vendor as any).kyc_status !== "VERIFIED") {
    recommendation = "Vendor KYC has expired. Notify vendor and pause settlement retries until re-verified.";
  } else if ((vendor as any).account_status !== "ACTIVE") {
    recommendation = "Vendor bank account is invalid or frozen. Request updated bank details before retrying settlement.";
  } else if ((vendor as any).payout_success_rate < 70) {
    recommendation = "Vendor has a chronically low payout success rate. Recommend manual account review.";
  }

  res.json({
    success: true,
    data: {
      vendor,
      deadlockHistory,
      revenueAtRisk: Number(riskRow?.sum ?? 0),
      failurePatterns: faultRows,
      recommendation,
    },
  });
});

export default router;
