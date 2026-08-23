import { withTransaction } from "../db";
import { investigateTransaction } from "./aiDecisionService";
import { writeAuditLog } from "./auditLogService";
import { emitEvent } from "../sockets";

function severityFromAmount(amount: number, severity: string) {
  if (severity === "CRITICAL") return "CRITICAL";
  if (amount > 20000) return "HIGH";
  if (amount > 5000) return "MEDIUM";
  return severity;
}

/**
 * Runs the AI investigation for a transaction and, if a fault is found,
 * persists a Deadlock row + full audit trail (DETECTION -> EVIDENCE ->
 * CLASSIFICATION -> CONFIDENCE), then emits deadlock:detected live.
 */
export async function detectAndRecordDeadlock(transactionId: string) {
  const result = await investigateTransaction(transactionId);

  return withTransaction(async (client) => {
    const txRow = await client.query(`SELECT amount FROM transactions WHERE id = $1`, [
      transactionId,
    ]);
    const amount = Number(txRow.rows[0]?.amount ?? 0);

    await writeAuditLog(
      {
        transactionId,
        eventType: "DETECTION",
        message: `Transaction flagged as deadlocked`,
      },
      client
    );

    for (const e of result.evidence) {
      await writeAuditLog(
        { transactionId, eventType: "EVIDENCE", message: e },
        client
      );
    }

    await writeAuditLog(
      {
        transactionId,
        eventType: "CLASSIFICATION",
        message: `${result.faultParty} fault detected (${result.rootCause})`,
        confidence: result.confidence,
      },
      client
    );

    await writeAuditLog(
      {
        transactionId,
        eventType: "CONFIDENCE",
        message: `${(result.confidence * 100).toFixed(0)}%`,
        confidence: result.confidence,
      },
      client
    );

    const severity = severityFromAmount(amount, result.severity);
    const recoveryPotential = result.confidence >= 0.7 ? amount : amount * 0.5;

    const inserted = await client.query(
      `INSERT INTO deadlocks
        (transaction_id, fault_party, root_cause, confidence, severity, status, recovery_potential, evidence, alternative_hypotheses, recommended_action)
       VALUES ($1,$2,$3,$4,$5,'OPEN',$6,$7,$8,$9)
       RETURNING *`,
      [
        transactionId,
        result.faultParty,
        result.rootCause,
        result.confidence,
        severity,
        recoveryPotential,
        JSON.stringify(result.evidence),
        JSON.stringify(result.alternativeHypotheses),
        result.recommendedAction,
      ]
    );

    await client.query(
      `UPDATE transactions SET status = 'DEADLOCKED', updated_at = now() WHERE id = $1`,
      [transactionId]
    );

    const deadlock = inserted.rows[0];
    emitEvent("deadlock:detected", deadlock);
    emitEvent("transaction:updated", { id: transactionId, status: "DEADLOCKED" });

    return deadlock;
  });
}
