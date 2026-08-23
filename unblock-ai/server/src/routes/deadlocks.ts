import { Router } from "express";
import { query, queryOne, withTransaction } from "../db";
import { investigateTransaction } from "../services/aiDecisionService";
import { executeRecoveryStep, markRecovered } from "../services/recoveryService";
import { writeAuditLog } from "../services/auditLogService";
import { emitEvent } from "../sockets";

const router = Router();

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Number(req.query.pageSize ?? 20));
  const status = req.query.status as string | undefined;
  const faultParty = req.query.faultParty as string | undefined;

  const conditions: string[] = [];
  const params: any[] = [];
  if (status) {
    params.push(status);
    conditions.push(`d.status = $${params.length}`);
  }
  if (faultParty) {
    params.push(faultParty);
    conditions.push(`d.fault_party = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(pageSize);
  const limitIdx = params.length;
  params.push((page - 1) * pageSize);
  const offsetIdx = params.length;

  const rows = await query(
    `SELECT d.*, t.external_id, t.amount, t.currency, v.name as vendor_name, c.name as customer_name
     FROM deadlocks d
     JOIN transactions t ON t.id = d.transaction_id
     JOIN vendors v ON v.id = t.vendor_id
     JOIN customers c ON c.id = t.customer_id
     ${where}
     ORDER BY d.detected_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM deadlocks d ${where}`,
    params.slice(0, params.length - 2)
  );

  res.json({ success: true, data: rows, meta: { page, pageSize, total: countRow ? parseInt(countRow.count, 10) : 0 } });
});

router.get("/:id", async (req, res) => {
  const deadlock = await queryOne(
    `SELECT d.*, t.external_id, t.amount, t.currency, v.name as vendor_name, c.name as customer_name
     FROM deadlocks d
     JOIN transactions t ON t.id = d.transaction_id
     JOIN vendors v ON v.id = t.vendor_id
     JOIN customers c ON c.id = t.customer_id
     WHERE d.id = $1`,
    [req.params.id]
  );
  if (!deadlock) return res.status(404).json({ success: false, error: { code: "DEADLOCK_NOT_FOUND", message: "Deadlock not found" } });
  const actions = await query(`SELECT * FROM recovery_actions WHERE deadlock_id = $1 ORDER BY created_at ASC`, [req.params.id]);
  res.json({ success: true, data: { deadlock, actions } });
});

// Re-runs AI investigation on demand (e.g. "Analyze" button in the UI)
router.post("/:id/analyze", async (req, res) => {
  const deadlock = await queryOne<{ transaction_id: string }>(`SELECT * FROM deadlocks WHERE id = $1`, [req.params.id]);
  if (!deadlock) return res.status(404).json({ success: false, error: { code: "DEADLOCK_NOT_FOUND", message: "Deadlock not found" } });
  const explanation = await investigateTransaction(deadlock.transaction_id);
  await writeAuditLog({
    transactionId: deadlock.transaction_id,
    deadlockId: req.params.id,
    eventType: "CLASSIFICATION",
    message: `Re-analysis: ${explanation.faultParty} fault (${explanation.rootCause})`,
    confidence: explanation.confidence,
  });
  res.json({ success: true, data: explanation });
});

// Executes the bounded recovery action recommended for this deadlock
router.post("/:id/resolve", async (req, res) => {
  try {
    const result = await executeRecoveryStep(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: "RESOLVE_FAILED", message: err.message } });
  }
});

// Marks recovered after underlying condition fixed (vendor updated KYC, customer retried, etc.)
router.post("/:id/mark-recovered", async (req, res) => {
  try {
    const result = await markRecovered(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: "RECOVERY_FAILED", message: err.message } });
  }
});

router.post("/:id/escalate", async (req, res) => {
  const deadlock = await queryOne<{ transaction_id: string }>(`SELECT * FROM deadlocks WHERE id = $1`, [req.params.id]);
  if (!deadlock) return res.status(404).json({ success: false, error: { code: "DEADLOCK_NOT_FOUND", message: "Deadlock not found" } });

  await withTransaction(async (client) => {
    await client.query(`UPDATE deadlocks SET status = 'ESCALATED' WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE transactions SET status = 'ESCALATED', updated_at = now() WHERE id = $1`, [deadlock.transaction_id]);
    await client.query(
      `INSERT INTO recovery_actions (deadlock_id, action_type, target_party, status, reason, confidence, idempotency_key)
       VALUES ($1,'ESCALATE_OPS','OPS','EXECUTED',$2,0,$3)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [req.params.id, req.body?.reason || "Manually escalated by operator", `${req.params.id}:MANUAL_ESCALATE`]
    );
    await writeAuditLog(
      { transactionId: deadlock.transaction_id, deadlockId: req.params.id, eventType: "ESCALATION", message: req.body?.reason || "Manually escalated by operator" },
      client
    );
  });

  emitEvent("deadlock:updated", { id: req.params.id, status: "ESCALATED" });
  res.json({ success: true, data: { escalated: true } });
});

export default router;
