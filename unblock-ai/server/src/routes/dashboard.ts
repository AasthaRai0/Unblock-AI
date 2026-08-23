import { Router } from "express";
import { query, queryOne } from "../db";

const router = Router();

router.get("/summary", async (_req, res) => {
  const revenueAtRisk = await queryOne<{ sum: string }>(
    `SELECT COALESCE(SUM(t.amount),0)::text as sum
     FROM transactions t JOIN deadlocks d ON d.transaction_id = t.id
     WHERE d.status NOT IN ('RESOLVED')`
  );
  const revenueRecovered = await queryOne<{ sum: string }>(
    `SELECT COALESCE(SUM(t.amount),0)::text as sum
     FROM transactions t JOIN deadlocks d ON d.transaction_id = t.id
     WHERE d.status = 'RESOLVED'`
  );
  const activeDeadlocks = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM deadlocks WHERE status NOT IN ('RESOLVED')`
  );
  const totalDeadlocks = await queryOne<{ count: string }>(`SELECT COUNT(*)::text as count FROM deadlocks`);
  const resolvedDeadlocks = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM deadlocks WHERE status = 'RESOLVED'`
  );
  const humanReview = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM recovery_actions WHERE action_type = 'HUMAN_REVIEW' AND status = 'PENDING'`
  );
  // AI attribution "accuracy" proxy: share of deadlocks classified with confidence >= 70%
  const highConfidence = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM deadlocks WHERE confidence >= 0.7`
  );

  const totalD = totalDeadlocks ? parseInt(totalDeadlocks.count, 10) : 0;
  const resolvedD = resolvedDeadlocks ? parseInt(resolvedDeadlocks.count, 10) : 0;
  const highConf = highConfidence ? parseInt(highConfidence.count, 10) : 0;

  res.json({
    success: true,
    data: {
      revenueAtRisk: Number(revenueAtRisk?.sum ?? 0),
      revenueRecovered: Number(revenueRecovered?.sum ?? 0),
      activeDeadlocks: activeDeadlocks ? parseInt(activeDeadlocks.count, 10) : 0,
      recoveryRate: totalD > 0 ? Number(((resolvedD / totalD) * 100).toFixed(1)) : 0,
      aiAttributionAccuracy: totalD > 0 ? Number(((highConf / totalD) * 100).toFixed(1)) : 0,
      humanReviewQueue: humanReview ? parseInt(humanReview.count, 10) : 0,
    },
  });
});

router.get("/recent-events", async (req, res) => {
  const limit = Number(req.query.limit ?? 15);
  const rows = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
  res.json({ success: true, data: rows });
});

router.get("/revenue-trend", async (_req, res) => {
  const rows = await query(
    `SELECT date_trunc('day', d.detected_at)::date as day,
            SUM(CASE WHEN d.status = 'RESOLVED' THEN t.amount ELSE 0 END) as recovered,
            SUM(t.amount) as at_risk
     FROM deadlocks d JOIN transactions t ON t.id = d.transaction_id
     WHERE d.detected_at > now() - interval '14 days'
     GROUP BY 1 ORDER BY 1 ASC`
  );
  res.json({ success: true, data: rows });
});

router.get("/fault-distribution", async (_req, res) => {
  const rows = await query(
    `SELECT fault_party, COUNT(*)::int as count, COALESCE(SUM(t.amount),0) as amount
     FROM deadlocks d JOIN transactions t ON t.id = d.transaction_id
     GROUP BY fault_party ORDER BY count DESC`
  );
  res.json({ success: true, data: rows });
});

export default router;
