import { v4 as uuidv4 } from "uuid";
import { pool, query, queryOne, withTransaction } from "../db";
import { detectAndRecordDeadlock } from "./deadlockService";
import { emitEvent } from "../sockets";

export type ScenarioKey =
  | "CUSTOMER_CARD_FAILURE"
  | "VENDOR_KYC_EXPIRED"
  | "VENDOR_INVALID_IFSC"
  | "PLATFORM_GATEWAY_OUTAGE"
  | "SPLIT_MISMATCH"
  | "MULTI_VENDOR_OUTAGE"
  | "AMBIGUOUS_FAILURE";

const FIRST_NAMES = ["Aarav", "Vivaan", "Ishaan", "Ananya", "Diya", "Kabir", "Meera", "Rohan", "Saanvi", "Aditya"];
const LAST_NAMES = ["Sharma", "Verma", "Iyer", "Reddy", "Nair", "Gupta", "Khan", "Singh", "Rao", "Menon"];
const BUSINESS_NAMES = ["Spice Route Kitchen", "Urban Threads", "Pixel Print Co", "Green Leaf Mart", "Craft & Co", "Metro Electronics", "Fresh Daily", "Studio Nine", "Bharat Handloom", "QuickFix Repairs"];
const BANKS = ["HDFC Bank", "ICICI Bank", "Axis Bank", "SBI", "Kotak Mahindra", "Yes Bank"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensurePoolOfVendors(count = 50) {
  const existing = await queryOne<{ count: string }>(`SELECT COUNT(*)::text as count FROM vendors`);
  const have = existing ? parseInt(existing.count, 10) : 0;
  if (have >= count) return;
  const toCreate = count - have;
  for (let i = 0; i < toCreate; i++) {
    const kycRoll = Math.random();
    const kyc_status = kycRoll < 0.12 ? "KYC_EXPIRED" : "VERIFIED";
    const accountRoll = Math.random();
    const account_status = accountRoll < 0.06 ? rand(["ACCOUNT_FROZEN", "INVALID_IFSC", "INVALID_BANK_ACCOUNT"]) : "ACTIVE";
    await query(
      `INSERT INTO vendors (name, email, phone, bank_name, account_last4, ifsc, kyc_status, account_status, payout_success_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        `${rand(BUSINESS_NAMES)} ${randInt(1, 999)}`,
        `vendor${uuidv4().slice(0, 6)}@merchant.in`,
        `9${randInt(100000000, 999999999)}`,
        rand(BANKS),
        String(randInt(1000, 9999)),
        `${rand(["HDFC", "ICIC", "UTIB", "SBIN", "KKBK"])}0${randInt(100000, 999999)}`,
        kyc_status,
        account_status,
        Math.max(20, 100 - randInt(0, 60)),
      ]
    );
  }
}

async function ensurePoolOfCustomers(count = 120) {
  const existing = await queryOne<{ count: string }>(`SELECT COUNT(*)::text as count FROM customers`);
  const have = existing ? parseInt(existing.count, 10) : 0;
  if (have >= count) return;
  const toCreate = count - have;
  for (let i = 0; i < toCreate; i++) {
    const name = `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
    await query(
      `INSERT INTO customers (name, email, phone, payment_method) VALUES ($1,$2,$3,$4)`,
      [
        name,
        `${name.toLowerCase().replace(/\s/g, ".")}${randInt(1, 999)}@gmail.com`,
        `9${randInt(100000000, 999999999)}`,
        rand(["UPI", "CREDIT_CARD", "DEBIT_CARD", "NETBANKING"]),
      ]
    );
  }
}

async function randomVendorId() {
  const rows = await query<{ id: string }>(`SELECT id FROM vendors ORDER BY random() LIMIT 1`);
  return rows[0].id;
}

// Vendor kyc_status/account_status is persistent, shared state (realistically
// so — it models a vendor's actual account health). With a small vendor pool
// and a large transaction volume, scenarios that need a "clean" vendor (i.e.
// the fault genuinely lies elsewhere: customer, gateway, ledger, unknown)
// must avoid picking a vendor some earlier transaction already poisoned —
// otherwise every subsequent transaction for that vendor gets swept into a
// VENDOR-fault bucket regardless of its own actual cause.
async function randomHealthyVendorId() {
  const rows = await query<{ id: string }>(
    `SELECT id FROM vendors WHERE kyc_status = 'VERIFIED' AND account_status = 'ACTIVE' ORDER BY random() LIMIT 1`
  );
  if (rows.length) return rows[0].id;
  return randomVendorId(); // fallback if pool is fully corrupted
}
async function randomCustomerId() {
  const rows = await query<{ id: string }>(`SELECT id FROM customers ORDER BY random() LIMIT 1`);
  return rows[0].id;
}

const SCENARIO_WEIGHTS: { key: ScenarioKey; weight: number }[] = [
  { key: "CUSTOMER_CARD_FAILURE", weight: 40 },
  { key: "VENDOR_KYC_EXPIRED", weight: 20 },
  { key: "VENDOR_INVALID_IFSC", weight: 15 },
  { key: "PLATFORM_GATEWAY_OUTAGE", weight: 8 },
  { key: "SPLIT_MISMATCH", weight: 7 },
  { key: "MULTI_VENDOR_OUTAGE", weight: 5 },
  { key: "AMBIGUOUS_FAILURE", weight: 5 },
];

function pickScenario(): ScenarioKey {
  const total = SCENARIO_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of SCENARIO_WEIGHTS) {
    if (r < w.weight) return w.key;
    r -= w.weight;
  }
  return "CUSTOMER_CARD_FAILURE";
}

/**
 * Creates one transaction + its dependency-graph nodes + split, wired to
 * match the requested scenario. Returns the transaction id. Does NOT run
 * fault attribution — that happens separately (either immediately for
 * "Inject Deadlock" demo mode, or in a batch for bulk generation).
 */
export async function createScenarioTransaction(scenario: ScenarioKey, forceHealthy = false) {
  await ensurePoolOfVendors();
  await ensurePoolOfCustomers();

  const customerId = await randomCustomerId();
  let vendorId = await randomVendorId();
  const amount = randInt(500, 45000);
  const platformFee = Math.round(amount * 0.08);
  const taxAmount = Math.round(amount * 0.02);
  let vendorAmount = amount - platformFee - taxAmount;

  const externalId = `TX-${randInt(1000, 9999)}${uuidv4().slice(0, 4).toUpperCase()}`;

  return withTransaction(async (client) => {
    const txRes = await client.query(
      `INSERT INTO transactions (external_id, customer_id, vendor_id, amount, payment_method, status)
       VALUES ($1,$2,$3,$4,$5,'PENDING') RETURNING *`,
      [externalId, customerId, vendorId, amount, rand(["UPI", "CREDIT_CARD", "DEBIT_CARD", "NETBANKING"])]
    );
    const tx = txRes.rows[0];

    const nodeStatus = {
      CUSTOMER: "SUCCESS",
      PAYMENT_GATEWAY: "SUCCESS",
      PLATFORM: "SUCCESS",
      SPLIT: "SUCCESS",
      VENDOR: "SUCCESS",
      BANK: "SUCCESS",
    } as Record<string, string>;
    let errorCodeByNode: Record<string, string | null> = {
      CUSTOMER: null, PAYMENT_GATEWAY: null, PLATFORM: null, SPLIT: null, VENDOR: null, BANK: null,
    };
    let splitMismatch = false;

    if (!forceHealthy) {
      switch (scenario) {
        case "CUSTOMER_CARD_FAILURE": {
          const code = rand(["insufficient_funds", "card_expired", "otp_failed", "bank_declined"]);
          nodeStatus.PAYMENT_GATEWAY = "FAILED";
          nodeStatus.PLATFORM = "PENDING";
          nodeStatus.SPLIT = "PENDING";
          nodeStatus.VENDOR = "PENDING";
          nodeStatus.BANK = "PENDING";
          errorCodeByNode.PAYMENT_GATEWAY = code;
          break;
        }
        case "VENDOR_KYC_EXPIRED": {
          await client.query(`UPDATE vendors SET kyc_status = 'KYC_EXPIRED' WHERE id = $1`, [vendorId]);
          nodeStatus.VENDOR = "FAILED";
          nodeStatus.BANK = "PENDING";
          errorCodeByNode.VENDOR = "KYC_EXPIRED";
          break;
        }
        case "VENDOR_INVALID_IFSC": {
          await client.query(`UPDATE vendors SET account_status = 'INVALID_IFSC' WHERE id = $1`, [vendorId]);
          nodeStatus.VENDOR = "SUCCESS";
          nodeStatus.BANK = "FAILED";
          errorCodeByNode.BANK = "INVALID_IFSC";
          break;
        }
        case "PLATFORM_GATEWAY_OUTAGE": {
          nodeStatus.PAYMENT_GATEWAY = "FAILED";
          nodeStatus.PLATFORM = "PENDING";
          nodeStatus.SPLIT = "PENDING";
          nodeStatus.VENDOR = "PENDING";
          nodeStatus.BANK = "PENDING";
          errorCodeByNode.PAYMENT_GATEWAY = "gateway_timeout_5xx";
          break;
        }
        case "SPLIT_MISMATCH": {
          vendorAmount = vendorAmount + randInt(50, 500); // deliberately break the ledger
          nodeStatus.SPLIT = "FAILED";
          nodeStatus.VENDOR = "PENDING";
          nodeStatus.BANK = "PENDING";
          errorCodeByNode.SPLIT = "ledger_mismatch";
          splitMismatch = true;
          break;
        }
        case "MULTI_VENDOR_OUTAGE": {
          nodeStatus.PAYMENT_GATEWAY = "FAILED";
          nodeStatus.PLATFORM = "PENDING";
          nodeStatus.SPLIT = "PENDING";
          nodeStatus.VENDOR = "PENDING";
          nodeStatus.BANK = "PENDING";
          errorCodeByNode.PAYMENT_GATEWAY = "gateway_timeout_5xx";
          break;
        }
        case "AMBIGUOUS_FAILURE": {
          // Ensure this vendor has no confounding KYC/account issue so the
          // failure signal is genuinely ambiguous rather than accidentally
          // resolving via an unrelated vendor-status rule.
          await client.query(
            `UPDATE vendors SET kyc_status = 'VERIFIED', account_status = 'ACTIVE' WHERE id = $1`,
            [vendorId]
          );
          nodeStatus.VENDOR = "PENDING";
          nodeStatus.BANK = "FAILED";
          errorCodeByNode.BANK = "settlement_unknown_error";
          break;
        }
      }
    }

    const nodeTypes = ["CUSTOMER", "PAYMENT_GATEWAY", "PLATFORM", "SPLIT", "VENDOR", "BANK"];
    for (const nt of nodeTypes) {
      await client.query(
        `INSERT INTO transaction_nodes (transaction_id, node_type, status, error_code)
         VALUES ($1,$2,$3,$4)`,
        [tx.id, nt, nodeStatus[nt], errorCodeByNode[nt]]
      );
    }

    await client.query(
      `INSERT INTO payment_splits (transaction_id, vendor_amount, platform_fee, tax_amount, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tx.id, vendorAmount, platformFee, taxAmount, amount, splitMismatch ? "FAILED" : "SUCCESS"]
    );

    const finalStatus = forceHealthy || scenario === undefined ? "SUCCESS" : "FAILED";
    await client.query(`UPDATE transactions SET status = $2 WHERE id = $1`, [
      tx.id,
      forceHealthy ? "SUCCESS" : "FAILED",
    ]);

    emitEvent("transaction:updated", { id: tx.id, status: forceHealthy ? "SUCCESS" : "FAILED" });

    return { ...tx, scenario };
  });
}

export async function generateBatch(n: number) {
  const created: string[] = [];
  const healthyRatio = 0.35; // some transactions succeed cleanly, most are seeded scenarios
  for (let i = 0; i < n; i++) {
    const isHealthy = Math.random() < healthyRatio;
    const scenario = pickScenario();
    const tx = await createScenarioTransaction(scenario, isHealthy);
    created.push(tx.id);
  }
  return created;
}

/**
 * Runs detection across every FAILED transaction that doesn't already
 * have a deadlock. Used by "Run Batch" and by Recovery Missions scanning.
 */
export async function detectDeadlocksForPendingTransactions(limit = 500) {
  const rows = await query<{ id: string }>(
    `SELECT t.id FROM transactions t
     LEFT JOIN deadlocks d ON d.transaction_id = t.id
     WHERE t.status = 'FAILED' AND d.id IS NULL
     LIMIT $1`,
    [limit]
  );
  const results: any[] = [];
  for (const r of rows) {
    const d = await detectAndRecordDeadlock(r.id);
    results.push(d);
  }
  return results;
}
