import { Router } from "express";
import { z } from "zod";
import {
  createScenarioTransaction,
  generateBatch,
  detectDeadlocksForPendingTransactions,
  ScenarioKey,
} from "../services/simulatorService";
import { detectAndRecordDeadlock } from "../services/deadlockService";
import { emitEvent } from "../sockets";

const router = Router();

const genSchema = z.object({ count: z.number().int().min(1).max(20000) });

router.post("/generate-transactions", async (req, res) => {
  const parsed = genSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  const ids = await generateBatch(parsed.data.count);
  res.json({ success: true, data: { created: ids.length } });
});

const SCENARIOS: ScenarioKey[] = [
  "CUSTOMER_CARD_FAILURE",
  "VENDOR_KYC_EXPIRED",
  "VENDOR_INVALID_IFSC",
  "PLATFORM_GATEWAY_OUTAGE",
  "SPLIT_MISMATCH",
  "MULTI_VENDOR_OUTAGE",
  "AMBIGUOUS_FAILURE",
];

const injectSchema = z.object({ scenario: z.enum(SCENARIOS as [ScenarioKey, ...ScenarioKey[]]) });

// "Inject Deadlock" button — creates a transaction matching a chosen
// scenario, then immediately runs AI attribution so the demo feels live.
router.post("/create-deadlock", async (req, res) => {
  const parsed = injectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });

  const tx = await createScenarioTransaction(parsed.data.scenario, false);
  const deadlock = await detectAndRecordDeadlock(tx.id);
  res.json({ success: true, data: { transaction: tx, deadlock } });
});

router.post("/run-batch", async (req, res) => {
  const count = Number(req.body?.count ?? 0);
  if (count > 0) {
    await generateBatch(count);
  }
  const results = await detectDeadlocksForPendingTransactions(2000);
  res.json({ success: true, data: { deadlocksCreated: results.length } });
});

export default router;
