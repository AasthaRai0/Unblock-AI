import { Router } from "express";
import { query, queryOne } from "../db";
import { emitEvent } from "../sockets";
import { writeAuditLog } from "../services/auditLogService";

const router = Router();

/**
 * Razorpay (test mode) webhook receiver. Idempotent: uses the Razorpay
 * event id as a natural idempotency key by checking audit_logs metadata
 * before processing, so retried webhook deliveries are safely ignored.
 */
router.post("/razorpay", async (req, res) => {
  const event = req.body;
  const eventId = event?.id || event?.payload?.payment?.entity?.id || `evt_${Date.now()}`;

  const already = await queryOne(
    `SELECT id FROM audit_logs WHERE metadata->>'webhookEventId' = $1`,
    [eventId]
  );
  if (already) {
    return res.json({ success: true, data: { deduped: true } });
  }

  const externalId = event?.payload?.payment?.entity?.order_id || event?.orderId;
  if (externalId) {
    const tx = await queryOne<{ id: string }>(`SELECT id FROM transactions WHERE external_id = $1`, [externalId]);
    if (tx) {
      const newStatus = event?.event === "payment.captured" ? "SUCCESS" : "FAILED";
      await query(`UPDATE transactions SET status = $2, updated_at = now() WHERE id = $1`, [tx.id, newStatus]);
      emitEvent("transaction:updated", { id: tx.id, status: newStatus });
    }
  }

  await writeAuditLog({
    eventType: "UPDATE",
    message: `Razorpay webhook received: ${event?.event ?? "unknown"}`,
    metadata: { webhookEventId: eventId, raw: event },
  });

  res.json({ success: true, data: { received: true } });
});

export default router;
