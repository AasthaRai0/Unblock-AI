export type UserRole = "ADMIN" | "OPS" | "ANALYST";

export type TransactionStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "DEADLOCKED"
  | "RECOVERING"
  | "RECOVERED"
  | "ESCALATED";

export type NodeType =
  | "CUSTOMER"
  | "PAYMENT_GATEWAY"
  | "PLATFORM"
  | "SPLIT"
  | "VENDOR"
  | "BANK";

export type NodeStatus = "SUCCESS" | "FAILED" | "PENDING" | "PAUSED";

export type FaultParty = "CUSTOMER" | "VENDOR" | "PLATFORM" | "GATEWAY" | "AMBIGUOUS";

export type DeadlockStatus = "OPEN" | "INVESTIGATING" | "RECOVERING" | "RESOLVED" | "ESCALATED";

export type ActionType =
  | "RETRY_PAYMENT"
  | "SEND_CUSTOMER_NOTIFICATION"
  | "SEND_VENDOR_NOTIFICATION"
  | "PAUSE_RETRY"
  | "ESCALATE_OPS"
  | "ESCALATE_COMPLIANCE"
  | "RETRY_SETTLEMENT"
  | "HUMAN_REVIEW";

export type ActionStatus = "PENDING" | "EXECUTED" | "COMPLETED" | "FAILED" | "BLOCKED";

export type MissionStatus = "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED" | "STOPPED";

export interface TransactionRow {
  id: string;
  external_id: string;
  customer_id: string;
  vendor_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface TransactionNodeRow {
  id: string;
  transaction_id: string;
  node_type: NodeType;
  status: NodeStatus;
  metadata: Record<string, any> | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  bank_name: string;
  account_last4: string;
  ifsc: string;
  kyc_status: string;
  account_status: string;
  payout_success_rate: number;
  created_at: string;
  updated_at: string;
}

export interface AttributionEvidence {
  label: string;
  weight: number;
}

export interface AlternativeHypothesis {
  cause: FaultParty;
  confidence: number;
}

export interface AttributionResult {
  faultParty: FaultParty;
  rootCause: string;
  confidence: number;
  evidence: string[];
  alternativeHypotheses: AlternativeHypothesis[];
  recommendedAction: ActionType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
