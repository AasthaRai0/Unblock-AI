import { Router } from "express";
import { query, queryOne, withTransaction } from "../db";
import { writeAuditLog } from "../services/auditLogService";
import { executeRecoveryStep, markRecovered } from "../services/recoveryService";
import { emitEvent } from "../sockets";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await query(
    `SELECT ra.*, d.fault_party, d.root_cause, d.confidence as deadlock_confidence, d.transaction_id,
            t.external_id, t.amount, v.name as vendor_name, c.name as customer_name
     FROM recovery_actions ra
     JOIN deadlocks d ON d.id = ra.deadlock_id
     JOIN transactions t ON t.id = d.transaction_id
     JOIN vendors v ON v.id = t.vendor_id
     JOIN customers c ON c.id = t.customer_id
     WHERE ra.action_type = 'HUMAN_REVIEW' AND ra.status = 'PENDING'
     ORDER BY ra.created_at ASC`
  );
  res.json({ success: true, data: rows });
});

router.post("/:id/approve", async (req, res) => {
  const action = await queryOne<{ deadlock_id: string }>(`SELECT * FROM recovery_actions WHERE id = $1`, [req.params.id]);
  if (!action) return res.status(404).json({ success: false, error: { code: "ACTION_NOT_FOUND", message: "Action not found" } });

  await withTransaction(async (client) => {
    await client.query(`UPDATE recovery_actions SET status = 'COMPLETED', completed_at = now() WHERE id = $1`, [req.params.id]);
    await writeAuditLog(
      { deadlockId: action.deadlock_id, eventType: "ACTION", message: "Human reviewer approved recovery action" },
      client
    );
  });

  const result = await markRecovered(action.deadlock_id);
  res.json({ success: true, data: result });
});

router.post("/:id/reject", async (req, res) => {
  const action = await queryOne<{ deadlock_id: string }>(`SELECT * FROM recovery_actions WHERE id = $1`, [req.params.id]);
  if (!action) return res.status(404).json({ success: false, error: { code: "ACTION_NOT_FOUND", message: "Action not found" } });

  await withTransaction(async (client) => {
    await client.query(`UPDATE recovery_actions SET status = 'FAILED', completed_at = now() WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE deadlocks SET status = 'ESCALATED' WHERE id = $1`, [action.deadlock_id]);
    await writeAuditLog(
      { deadlockId: action.deadlock_id, eventType: "ESCALATION", message: req.body?.reason || "Human reviewer rejected recovery action" },
      client
    );
  });

  emitEvent("deadlock:updated", { id: action.deadlock_id, status: "ESCALATED" });
  res.json({ success: true, data: { rejected: true } });
});

export default router;
