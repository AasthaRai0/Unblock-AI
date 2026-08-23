import { queryOne, query } from "../db";
import { runFaultAttribution } from "./faultAttributionService";
import {
  AttributionResult,
  TransactionNodeRow,
  TransactionRow,
  VendorRow,
} from "../types/domain";

/**
 * AI DECISION SERVICE
 * ------------------------------------------------------------------
 * Single choke point the rest of the backend calls for "what does the
 * AI think happened here". The frontend NEVER talks to an AI provider
 * directly — it only ever calls our REST API, which calls this module.
 *
 * Today this delegates to the deterministic rule engine
 * (faultAttributionService). To swap in a real LLM/ML model later,
 * you only need to change the implementation of `investigateTransaction`
 * below — every controller, route, and the entire frontend stay
 * untouched because the return shape (AttributionResult) is stable.
 */

export interface AIExplanation extends AttributionResult {
  transactionId: string;
}

export async function investigateTransaction(transactionId: string): Promise<AIExplanation> {
  const transaction = await queryOne<TransactionRow>(
    `SELECT * FROM transactions WHERE id = $1`,
    [transactionId]
  );
  if (!transaction) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  const nodes = await query<TransactionNodeRow>(
    `SELECT * FROM transaction_nodes WHERE transaction_id = $1 ORDER BY created_at ASC`,
    [transactionId]
  );

  const vendor = await queryOne<VendorRow>(`SELECT * FROM vendors WHERE id = $1`, [
    transaction.vendor_id,
  ]);
  if (!vendor) throw new Error("VENDOR_NOT_FOUND");

  const split = await queryOne<{
    vendor_amount: number;
    platform_fee: number;
    tax_amount: number;
    total_amount: number;
  }>(`SELECT * FROM payment_splits WHERE transaction_id = $1`, [transactionId]);

  const splitTotalsMismatch = split
    ? Math.abs(
        split.vendor_amount + split.platform_fee + split.tax_amount - split.total_amount
      ) > 0.5
    : false;

  const result = await runFaultAttribution(transaction, nodes, vendor, splitTotalsMismatch);

  return { ...result, transactionId };
}
