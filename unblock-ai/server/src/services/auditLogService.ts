import { PoolClient } from "pg";
import { pool, query } from "../db";
import { emitEvent } from "../sockets";

export interface AuditLogInput {
  transactionId?: string | null;
  deadlockId?: string | null;
  userId?: string | null;
  eventType: string; // DETECTION | EVIDENCE | CLASSIFICATION | CONFIDENCE | POLICY_CHECK | ACTION | UPDATE | RECOVERY | SUCCESS | ESCALATION
  message: string;
  reason?: string | null;
  confidence?: number | null;
  metadata?: Record<string, any> | null;
}

/**
 * Writes an audit log row and immediately streams it over Socket.IO so the
 * Audit Trail page updates live with zero polling. Accepts an optional
 * transaction client so it can participate in the same DB transaction as
 * the mutation it is documenting (all-or-nothing writes).
 */
export async function writeAuditLog(input: AuditLogInput, client?: PoolClient) {
  const runner = client ?? pool;
  const rows = await runner.query(
    `INSERT INTO audit_logs
      (transaction_id, deadlock_id, user_id, event_type, message, reason, confidence, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      input.transactionId ?? null,
      input.deadlockId ?? null,
      input.userId ?? null,
      input.eventType,
      input.message,
      input.reason ?? null,
      input.confidence ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  const row = rows.rows[0];
  emitEvent("audit:new", row);
  return row;
}

export async function listAuditLogs(params: {
  transactionId?: string;
  limit?: number;
  offset?: number;
}) {
  const { transactionId, limit = 50, offset = 0 } = params;
  if (transactionId) {
    return query(
      `SELECT * FROM audit_logs WHERE transaction_id = $1 ORDER BY created_at ASC`,
      [transactionId]
    );
  }
  return query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [
    limit,
    offset,
  ]);
}
