import { query, queryOne, withTransaction } from "../db";
import { emitEvent } from "../sockets";
import { detectAndRecordDeadlock } from "./deadlockService";
import { executeRecoveryStep, markRecovered } from "./recoveryService";
import { writeAuditLog } from "./auditLogService";

/**
 * Orchestrates the full DETECT -> DIAGNOSE -> ATTRIBUTE -> DECIDE -> ACT ->
 * VERIFY -> RECOVER -> AUDIT loop across a batch of transactions, emitting
 * "mission:progress" at every stage so the frontend can animate it live.
 *
 * A mission is bounded by policy at creation time (max retries, max
 * automated amount, minimum confidence, recovery window) — those bounds
 * are enforced inside recoveryService.decidePolicy, not duplicated here.
 */

const STAGES = [
  "SCANNING",
  "CORRELATING",
  "ATTRIBUTING",
  "PLANNING",
  "EXECUTING",
  "VERIFYING",
  "RECOVERED",
] as const;

async function emitProgress(missionId: string, stage: string, extra: Record<string, any> = {}) {
  const stats = await queryOne(
    `SELECT * FROM recovery_mission_stats WHERE mission_id = $1`,
    [missionId]
  );
  emitEvent("mission:progress", { missionId, stage, stats, ...extra });
}

export async function runMission(missionId: string) {
  const mission = await queryOne<{
    id: string;
    status: string;
    minimum_confidence: number;
    max_automated_amount: number;
  }>(`SELECT * FROM recovery_missions WHERE id = $1`, [missionId]);
  if (!mission) throw new Error("MISSION_NOT_FOUND");

  await query(`UPDATE recovery_missions SET status = 'RUNNING', started_at = now() WHERE id = $1`, [
    missionId,
  ]);
  await writeAuditLog({ eventType: "DETECTION", message: `Recovery mission started`, metadata: { missionId } });
  await emitProgress(missionId, "SCANNING");

  // STAGE 1: SCAN — find FAILED transactions without a deadlock yet
  const candidates = await query<{ id: string; amount: number }>(
    `SELECT t.id, t.amount FROM transactions t
     LEFT JOIN deadlocks d ON d.transaction_id = t.id
     WHERE t.status = 'FAILED' AND d.id IS NULL`
  );
  await query(
    `UPDATE recovery_mission_stats SET transactions_scanned = transactions_scanned + $2, amount_at_risk = amount_at_risk + $3, updated_at = now() WHERE mission_id = $1`,
    [missionId, candidates.length, candidates.reduce((s, c) => s + Number(c.amount), 0)]
  );
  await emitProgress(missionId, "CORRELATING", { found: candidates.length });

  // STAGE 2-3: ATTRIBUTE each candidate (this is where the AI runs)
  const deadlocks: any[] = [];
  for (const c of candidates) {
    // re-check mission wasn't stopped mid-run
    const current = await queryOne<{ status: string }>(
      `SELECT status FROM recovery_missions WHERE id = $1`,
      [missionId]
    );
    if (current?.status !== "RUNNING") break;

    const d = await detectAndRecordDeadlock(c.id);
    deadlocks.push(d);
  }
  await query(
    `UPDATE recovery_mission_stats SET deadlocks_detected = deadlocks_detected + $2, recoverable_count = recoverable_count + $3, updated_at = now() WHERE mission_id = $1`,
    [missionId, deadlocks.length, deadlocks.filter((d) => d.confidence >= mission.minimum_confidence).length]
  );
  await emitProgress(missionId, "ATTRIBUTING", { deadlocks: deadlocks.length });
  await emitProgress(missionId, "PLANNING");

  // STAGE 4-5: PLAN + EXECUTE bounded recovery actions for every
  // qualifying deadlock (respects mission's minimum confidence bound)
  let executedCount = 0;
  for (const d of deadlocks) {
    const current = await queryOne<{ status: string }>(
      `SELECT status FROM recovery_missions WHERE id = $1`,
      [missionId]
    );
    if (current?.status !== "RUNNING") break;

    if (d.confidence < mission.minimum_confidence) continue;
    const txRow = await queryOne<{ amount: number }>(`SELECT amount FROM transactions WHERE id = $1`, [
      d.transaction_id,
    ]);
    if (txRow && Number(txRow.amount) > mission.max_automated_amount) {
      await writeAuditLog({
        transactionId: d.transaction_id,
        deadlockId: d.id,
        eventType: "POLICY_CHECK",
        message: `Amount ₹${txRow.amount} exceeds mission's max automated amount (₹${mission.max_automated_amount}) — routed to human review`,
      });
      continue;
    }

    await executeRecoveryStep(d.id, missionId);
    executedCount++;

    // demo-simulated verification: vendor/customer-fault items with
    // confidence >= threshold succeed on first automated attempt most
    // of the time, mirroring a realistic recovery rate rather than 100%
    const willSucceed = Math.random() < (d.confidence >= 0.85 ? 0.82 : 0.55);
    if (willSucceed) {
      await markRecovered(d.id, missionId);
    }
  }

  await emitProgress(missionId, "EXECUTING", { executed: executedCount });
  await emitProgress(missionId, "VERIFYING");

  await query(`UPDATE recovery_missions SET status = 'COMPLETED', completed_at = now() WHERE id = $1`, [
    missionId,
  ]);
  await writeAuditLog({ eventType: "SUCCESS", message: "Recovery mission completed", metadata: { missionId } });
  await emitProgress(missionId, "RECOVERED");

  return queryOne(`SELECT * FROM recovery_mission_stats WHERE mission_id = $1`, [missionId]);
}

export async function stopMission(missionId: string) {
  await query(`UPDATE recovery_missions SET status = 'STOPPED', completed_at = now() WHERE id = $1`, [
    missionId,
  ]);
  await writeAuditLog({ eventType: "ESCALATION", message: "Recovery mission stopped by operator", metadata: { missionId } });
  emitEvent("mission:progress", { missionId, stage: "STOPPED" });
}
