import { query } from "../db";
import {
  AttributionResult,
  FaultParty,
  TransactionNodeRow,
  TransactionRow,
  VendorRow,
} from "../types/domain";

/**
 * FAULT ATTRIBUTION ENGINE
 * ------------------------------------------------------------------
 * This is the "AI" layer for UNBLOCK AI. It is intentionally built as
 * a pure function over structured evidence so that:
 *   1. Every decision is deterministic and 100% explainable/auditable.
 *   2. The exact same call signature can later be swapped for an LLM
 *      or ML classifier (see aiDecisionService.ts) without touching
 *      any controller, route, or frontend code.
 *
 * Input: a transaction + its dependency-graph nodes + vendor state +
 *        recent platform-wide failure signals (for correlation).
 * Output: AttributionResult — fault party, root cause, confidence,
 *         evidence trail, alternative hypotheses, recommended action.
 */

const CUSTOMER_ERROR_CODES = new Set([
  "insufficient_funds",
  "card_expired",
  "otp_failed",
  "bank_declined",
  "card_declined",
]);

const VENDOR_FAULT_STATUSES = new Set([
  "KYC_EXPIRED",
  "ACCOUNT_FROZEN",
  "INVALID_IFSC",
  "INVALID_BANK_ACCOUNT",
]);

// Only technical/infrastructure-level error signatures should ever trigger
// the "correlated platform outage" rule. Business-status codes like
// KYC_EXPIRED or INVALID_IFSC are expected to occur independently across
// many vendors over time and must never be treated as a platform signal,
// no matter how many distinct vendors happen to share that status.
const PLATFORM_CORRELATION_SIGNATURES = new Set([
  "gateway_timeout_5xx",
  "gateway_5xx",
  "connection_reset",
  "routing_failure",
]);

interface PlatformSignal {
  errorSignature: string;
  vendorId: string;
  timestamp: string;
}

async function getRecentPlatformFailureSignals(
  windowMinutes = 30
): Promise<PlatformSignal[]> {
  const rows = await query<{
    error_code: string;
    vendor_id: string;
    created_at: string;
  }>(
    `SELECT tn.error_code, t.vendor_id, tn.created_at
     FROM transaction_nodes tn
     JOIN transactions t ON t.id = tn.transaction_id
     WHERE tn.status = 'FAILED'
       AND tn.node_type IN ('VENDOR', 'BANK', 'PAYMENT_GATEWAY')
       AND tn.error_code IS NOT NULL
       AND tn.created_at > now() - ($1 || ' minutes')::interval`,
    [windowMinutes]
  );
  return rows.map((r) => ({
    errorSignature: r.error_code,
    vendorId: r.vendor_id,
    timestamp: r.created_at,
  }));
}

function pickNode(nodes: TransactionNodeRow[], type: TransactionNodeRow["node_type"]) {
  return nodes.find((n) => n.node_type === type) ?? null;
}

export async function runFaultAttribution(
  transaction: TransactionRow,
  nodes: TransactionNodeRow[],
  vendor: VendorRow,
  splitTotalsMismatch: boolean
): Promise<AttributionResult> {
  const evidence: string[] = [];
  const gatewayNode = pickNode(nodes, "PAYMENT_GATEWAY");
  const customerNode = pickNode(nodes, "CUSTOMER");
  const platformNode = pickNode(nodes, "PLATFORM");
  const splitNode = pickNode(nodes, "SPLIT");
  const vendorNode = pickNode(nodes, "VENDOR");
  const bankNode = pickNode(nodes, "BANK");

  // ---- Rule 1: split ledger mismatch -> always PLATFORM, highest priority ----
  if (splitTotalsMismatch) {
    return finalize({
      faultParty: "PLATFORM",
      rootCause: "SPLIT_CALCULATION_MISMATCH",
      confidence: 0.97,
      evidence: [
        "Sum of vendor payout + platform fee + tax does not equal transaction total",
        "This is a ledger integrity issue, not a party-side failure",
      ],
      alternatives: [
        { cause: "VENDOR", confidence: 0.02 },
        { cause: "CUSTOMER", confidence: 0.01 },
      ],
      recommendedAction: "ESCALATE_COMPLIANCE",
      severity: "CRITICAL",
    });
  }

  // ---- Rule 2: correlated multi-vendor failures -> PLATFORM/gateway outage ----
  // Restricted to genuine infrastructure-level error signatures (see
  // PLATFORM_CORRELATION_SIGNATURES) so a naturally high base rate of a
  // routine business-status code (e.g. many vendors independently having
  // expired KYC) is never mistaken for a platform-wide incident.
  const signals = await getRecentPlatformFailureSignals(30);
  const candidateSignature = gatewayNode?.error_code ?? vendorNode?.error_code ?? "";
  if (PLATFORM_CORRELATION_SIGNATURES.has(candidateSignature)) {
    const distinctVendors = new Set(
      signals.filter((s) => s.errorSignature === candidateSignature).map((s) => s.vendorId)
    );
    if (distinctVendors.size >= 3) {
      return finalize({
        faultParty: "PLATFORM",
        rootCause: "CORRELATED_GATEWAY_OUTAGE",
        confidence: 0.93,
        evidence: [
          `${distinctVendors.size} distinct vendors failed with the same infrastructure-level error ("${candidateSignature}") in the last 30 minutes`,
          "Failure is correlated across unrelated vendors, ruling out an individual vendor-side cause",
        ],
        alternatives: [
          { cause: "VENDOR", confidence: 0.05 },
          { cause: "GATEWAY", confidence: 0.02 },
        ],
        recommendedAction: "ESCALATE_OPS",
        severity: "CRITICAL",
      });
    }
  }

  // ---- Rule 3: gateway/customer-side decline codes -> CUSTOMER ----
  const gwError = gatewayNode?.error_code?.toLowerCase() ?? "";
  if (gatewayNode?.status === "FAILED" && CUSTOMER_ERROR_CODES.has(gwError)) {
    evidence.push(`Payment gateway returned decline code "${gwError}"`);
    if (platformNode?.status !== "FAILED") evidence.push("Platform routing was not implicated");
    return finalize({
      faultParty: "CUSTOMER",
      rootCause: gwError.toUpperCase(),
      confidence: 0.9,
      evidence,
      alternatives: [
        { cause: "GATEWAY", confidence: 0.06 },
        { cause: "PLATFORM", confidence: 0.02 },
      ],
      recommendedAction: "RETRY_PAYMENT",
      severity: "LOW",
    });
  }

  // ---- Rule 4: vendor payout / KYC / bank issues -> VENDOR ----
  // A bank-node failure only counts as vendor-side evidence when the error
  // code is a KNOWN vendor-fault signature. A generic/unknown settlement
  // error is NOT enough on its own — that's exactly the kind of low-signal
  // case that should fall through to AMBIGUOUS / human review rather than
  // being guessed at.
  const bankErrorIsKnownVendorFault = bankNode?.error_code
    ? VENDOR_FAULT_STATUSES.has(bankNode.error_code) || bankNode.error_code === "INVALID_IFSC"
    : false;
  if (
    vendorNode?.status === "FAILED" ||
    bankErrorIsKnownVendorFault ||
    VENDOR_FAULT_STATUSES.has(vendor.kyc_status) ||
    vendor.account_status !== "ACTIVE"
  ) {
    const cause = VENDOR_FAULT_STATUSES.has(vendor.kyc_status)
      ? vendor.kyc_status
      : vendor.account_status !== "ACTIVE"
      ? vendor.account_status
      : bankNode?.error_code ?? "PAYOUT_FAILED";

    const localEvidence = [
      customerNode?.status === "SUCCESS" ? "Customer payment completed successfully" : "Customer leg was not the point of failure",
      platformNode?.status === "SUCCESS" ? "Platform split completed successfully" : "Platform routing succeeded",
      `Vendor ${cause.toString().replace(/_/g, " ").toLowerCase()}`,
    ];

    let confidence = 0.88;
    if (VENDOR_FAULT_STATUSES.has(vendor.kyc_status)) confidence = 0.91;
    if (vendor.payout_success_rate < 60) {
      confidence = Math.min(0.97, confidence + 0.04);
      localEvidence.push(
        `Vendor historical payout success rate is low (${vendor.payout_success_rate.toFixed(1)}%)`
      );
    }

    return finalize({
      faultParty: "VENDOR",
      rootCause: String(cause),
      confidence,
      evidence: localEvidence,
      alternatives: [
        { cause: "PLATFORM", confidence: 0.06 },
        { cause: "CUSTOMER", confidence: 0.03 },
      ],
      recommendedAction: "SEND_VENDOR_NOTIFICATION",
      severity: "MEDIUM",
    });
  }

  // ---- Rule 5: gateway-side failure not matching customer codes -> GATEWAY ----
  if (gatewayNode?.status === "FAILED") {
    return finalize({
      faultParty: "GATEWAY",
      rootCause: gatewayNode.error_code ?? "GATEWAY_ERROR",
      confidence: 0.75,
      evidence: [
        `Gateway node failed with code "${gatewayNode.error_code ?? "unknown"}"`,
        "Error code does not match a known customer-side decline pattern",
      ],
      alternatives: [
        { cause: "PLATFORM", confidence: 0.15 },
        { cause: "CUSTOMER", confidence: 0.08 },
      ],
      recommendedAction: "RETRY_PAYMENT",
      severity: "MEDIUM",
    });
  }

  // ---- Fallback: ambiguous, needs a human ----
  return finalize({
    faultParty: "AMBIGUOUS",
    rootCause: "INSUFFICIENT_SIGNAL",
    confidence: 0.42,
    evidence: [
      "No single node crosses a deterministic fault threshold",
      "Signals are mixed or incomplete",
    ],
    alternatives: [
      { cause: "CUSTOMER", confidence: 0.25 },
      { cause: "VENDOR", confidence: 0.2 },
      { cause: "PLATFORM", confidence: 0.13 },
    ],
    recommendedAction: "HUMAN_REVIEW",
    severity: "MEDIUM",
  });
}

function finalize(input: {
  faultParty: FaultParty;
  rootCause: string;
  confidence: number;
  evidence: string[];
  alternatives: { cause: FaultParty; confidence: number }[];
  recommendedAction: AttributionResult["recommendedAction"];
  severity: AttributionResult["severity"];
}): AttributionResult {
  return {
    faultParty: input.faultParty,
    rootCause: input.rootCause,
    confidence: Number(input.confidence.toFixed(2)),
    evidence: input.evidence,
    alternativeHypotheses: input.alternatives,
    recommendedAction: input.recommendedAction,
    severity: input.severity,
  };
}
