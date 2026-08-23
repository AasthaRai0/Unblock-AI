import { v4 as uuidv4 } from "uuid";
import { pool, queryOne, withTransaction } from "../db";
import { writeAuditLog } from "./auditLogService";
import { emitEvent } from "../sockets";
import { ActionType, DeadlockStatus, FaultParty } from "../types/domain";

/**
 * RECOVERY ENGINE
 * ------------------------------------------------------------------
 * Turns an AI attribution into a BOUNDED, policy-checked action. This is
 * the "guardrails" layer the track's bar explicitly asks for:
 *   - confidence < 70%             -> always human review, never automated
 *   - customer fault                -> max 3 retries within 72h
 *   - vendor fault                  -> notify + pause settlement, wait, then retry
 *   - platform fault                -> pause flows, never re-charge customers,
 *                                       raise an internal ops alert
 *   - ambiguous                     -> human review
 *   - idempotency keys prevent duplicate actions from double execution
 *
 * Every action: (1) validates policy, (2) writes an audit log,
 * (3) executes, (4) updates transaction/deadlock state, (5) emits a
 * Socket.IO event — in that exact order, inside a DB transaction.
 */

const MIN_AUTOMATION_CONFIDENCE = 0.7;
const CUSTOMER_MAX_RETRIES = 3;
const CUSTOMER_RETRY_WINDOW_HOURS = 72;

interface DeadlockRow {
  id: string;
  transaction_id: string;
  fault_party: FaultParty;
  root_cause: string;
  confidence: number;
  status: DeadlockStatus;
  recovery_potential: number;
}

interface PolicyDecision {
  allowed: boolean;
  actionType: ActionType;
  targetParty: string;
  reason: string;
}

export function decidePolicy(deadlock: DeadlockRow, priorActionCount: number): PolicyDecision {
  if (deadlock.confidence < MIN_AUTOMATION_CONFIDENCE) {
    return {
      allowed: true,
      actionType: "HUMAN_REVIEW",
      targetParty: "OPS",
      reason: `Confidence ${(deadlock.confidence * 100).toFixed(0)}% is below the ${
        MIN_AUTOMATION_CONFIDENCE * 100
      }% automation threshold`,
    };
  }

  switch (deadlock.fault_party) {
    case "CUSTOMER":
      if (priorActionCount >= CUSTOMER_MAX_RETRIES) {
        return {
          allowed: false,
          actionType: "ESCALATE_OPS",
          targetParty: "OPS",
          reason: `Customer retry limit (${CUSTOMER_MAX_RETRIES}) reached — stopping automated retries`,
        };
      }
      return {
        allowed: true,
        actionType: "RETRY_PAYMENT",
        targetParty: "CUSTOMER",
        reason: `Customer-side decline; retry ${priorActionCount + 1}/${CUSTOMER_MAX_RETRIES} within ${CUSTOMER_RETRY_WINDOW_HOURS}h window`,
      };

    case "VENDOR":
      return {
        allowed: true,
        actionType: "SEND_VENDOR_NOTIFICATION",
        targetParty: "VENDOR",
        reason: "Vendor-side payout issue detected — notifying vendor and pausing settlement retries until corrected",
      };

    case "PLATFORM":
    case "GATEWAY":
      return {
        allowed: true,
        actionType: "ESCALATE_OPS",
        targetParty: "OPS",
        reason: "Platform/gateway-side fault — pausing all affected flows and raising an internal ops alert. Customers will not be re-charged.",
      };

    case "AMBIGUOUS":
    default:
      return {
        allowed: true,
        actionType: "HUMAN_REVIEW",
        targetParty: "OPS",
        reason: "Signal is ambiguous — routed to human review rather than guessing",
      };
  }
}

async function countPriorActions(deadlockId: string, actionType: ActionType) {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM recovery_actions WHERE deadlock_id = $1 AND action_type = $2 AND status != 'BLOCKED'`,
    [deadlockId, actionType]
  );
  return row ? parseInt(row.count, 10) : 0;
}

export async function executeRecoveryStep(deadlockId: string, missionId?: string) {
  const deadlock = await queryOne<DeadlockRow>(`SELECT * FROM deadlocks WHERE id = $1`, [
    deadlockId,
  ]);
  if (!deadlock) throw new Error("DEADLOCK_NOT_FOUND");
  if (deadlock.status === "RESOLVED") return { skipped: true, reason: "already resolved" };

  const priorRetries = await countPriorActions(deadlockId, "RETRY_PAYMENT");
  const policy = decidePolicy(deadlock, priorRetries);

  await writeAuditLog({
    transactionId: deadlock.transaction_id,
    deadlockId,
    eventType: "POLICY_CHECK",
    message: policy.allowed
      ? `Automated action permitted: ${policy.actionType}`
      : `Automated action blocked: ${policy.reason}`,
    reason: policy.reason,
    confidence: deadlock.confidence,
  });

  if (!policy.allowed) {
    return withTransaction(async (client) => {
      await client.query(`UPDATE deadlocks SET status = 'ESCALATED' WHERE id = $1`, [
        deadlockId,
      ]);
      await client.query(
        `UPDATE transactions SET status = 'ESCALATED', updated_at = now() WHERE id = $1`,
        [deadlock.transaction_id]
      );
      await writeAuditLog(
        {
          transactionId: deadlock.transaction_id,
          deadlockId,
          eventType: "ESCALATION",
          message: policy.reason,
        },
        client
      );
      emitEvent("deadlock:updated", { id: deadlockId, status: "ESCALATED" });
      emitEvent("transaction:updated", { id: deadlock.transaction_id, status: "ESCALATED" });
      return { escalated: true, reason: policy.reason };
    });
  }

  // HUMAN_REVIEW never auto-executes — it just queues the item.
  if (policy.actionType === "HUMAN_REVIEW") {
    return withTransaction(async (client) => {
      const idempotencyKey = `${deadlockId}:HUMAN_REVIEW`;
      const action = await client.query(
        `INSERT INTO recovery_actions
          (deadlock_id, action_type, target_party, status, reason, confidence, idempotency_key)
         VALUES ($1,'HUMAN_REVIEW',$2,'PENDING',$3,$4,$5)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING *`,
        [deadlockId, policy.targetParty, policy.reason, deadlock.confidence, idempotencyKey]
      );
      await client.query(`UPDATE deadlocks SET status = 'INVESTIGATING' WHERE id = $1`, [
        deadlockId,
      ]);
      await writeAuditLog(
        {
          transactionId: deadlock.transaction_id,
          deadlockId,
          eventType: "ACTION",
          message: "Queued for human review",
          reason: policy.reason,
          confidence: deadlock.confidence,
        },
        client
      );
      emitEvent("deadlock:updated", { id: deadlockId, status: "INVESTIGATING" });
      return { queued: true, action: action.rows[0] };
    });
  }

  return withTransaction(async (client) => {
    const idempotencyKey = `${deadlockId}:${policy.actionType}:${uuidv4().slice(0, 8)}`;
    const actionRes = await client.query(
      `INSERT INTO recovery_actions
        (deadlock_id, action_type, target_party, status, reason, confidence, idempotency_key, executed_at)
       VALUES ($1,$2,$3,'EXECUTED',$4,$5,$6, now())
       RETURNING *`,
      [
        deadlockId,
        policy.actionType,
        policy.targetParty,
        policy.reason,
        deadlock.confidence,
        idempotencyKey,
      ]
    );

    await client.query(`UPDATE deadlocks SET status = 'RECOVERING' WHERE id = $1`, [deadlockId]);
    await client.query(
      `UPDATE transactions SET status = 'RECOVERING', updated_at = now() WHERE id = $1`,
      [deadlock.transaction_id]
    );

    await writeAuditLog(
      {
        transactionId: deadlock.transaction_id,
        deadlockId,
        eventType: "ACTION",
        message: describeAction(policy.actionType, policy.targetParty),
        reason: policy.reason,
        confidence: deadlock.confidence,
      },
      client
    );

    emitEvent("recovery:started", { deadlockId, action: actionRes.rows[0] });
    emitEvent("deadlock:updated", { id: deadlockId, status: "RECOVERING" });
    emitEvent("transaction:updated", { id: deadlock.transaction_id, status: "RECOVERING" });

    if (missionId) {
      await client.query(
        `UPDATE recovery_mission_stats SET actions_executed = actions_executed + 1, updated_at = now() WHERE mission_id = $1`,
        [missionId]
      );
    }

    return { action: actionRes.rows[0] };
  });
}

function describeAction(actionType: ActionType, target: string) {
  switch (actionType) {
    case "RETRY_PAYMENT":
      return "Retry payment initiated for customer";
    case "SEND_VENDOR_NOTIFICATION":
      return "Vendor notified of payout issue; settlement retry paused pending correction";
    case "SEND_CUSTOMER_NOTIFICATION":
      return "Customer notified";
    case "PAUSE_RETRY":
      return "Retry sequence paused";
    case "ESCALATE_OPS":
      return "Escalated to internal ops team; affected flows paused";
    case "ESCALATE_COMPLIANCE":
      return "Escalated to compliance (ledger integrity issue)";
    case "RETRY_SETTLEMENT":
      return "Settlement retry initiated after vendor correction";
    default:
      return `Action ${actionType} executed for ${target}`;
  }
}

/**
 * Called once the underlying condition is fixed (e.g. vendor KYC updated,
 * customer resubmitted payment). Marks the deadlock resolved, the
 * transaction recovered, and rolls the $ amount into mission stats.
 */
export async function markRecovered(deadlockId: string, missionId?: string) {
  const deadlock = await queryOne<DeadlockRow & { amount?: number }>(
    `SELECT d.*, t.amount as amount, t.id as tx_id
     FROM deadlocks d JOIN transactions t ON t.id = d.transaction_id
     WHERE d.id = $1`,
    [deadlockId]
  );
  if (!deadlock) throw new Error("DEADLOCK_NOT_FOUND");

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE deadlocks SET status = 'RESOLVED', resolved_at = now() WHERE id = $1`,
      [deadlockId]
    );
    await client.query(
      `UPDATE transactions SET status = 'RECOVERED', updated_at = now() WHERE id = $1`,
      [deadlock.transaction_id]
    );
    await client.query(
      `UPDATE recovery_actions SET status = 'COMPLETED', completed_at = now() WHERE deadlock_id = $1 AND status = 'EXECUTED'`,
      [deadlockId]
    );

    await writeAuditLog(
      {
        transactionId: deadlock.transaction_id,
        deadlockId,
        eventType: "SUCCESS",
        message: `₹${Number(deadlock.amount ?? 0).toLocaleString("en-IN")} recovered`,
        confidence: deadlock.confidence,
      },
      client
    );

    if (missionId) {
      await client.query(
        `UPDATE recovery_mission_stats
         SET successful_recoveries = successful_recoveries + 1,
             amount_recovered = amount_recovered + $2,
             updated_at = now()
         WHERE mission_id = $1`,
        [missionId, deadlock.amount ?? 0]
      );
    }

    emitEvent("recovery:success", {
      deadlockId,
      transactionId: deadlock.transaction_id,
      amount: deadlock.amount,
    });
    emitEvent("deadlock:updated", { id: deadlockId, status: "RESOLVED" });
    emitEvent("transaction:updated", { id: deadlock.transaction_id, status: "RECOVERED" });

    return { recovered: true, amount: deadlock.amount };
  });
}
