import { Router } from "express";
import { listAuditLogs } from "../services/auditLogService";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const rows = await listAuditLogs({ limit, offset });
  res.json({ success: true, data: rows });
});

router.get("/:transactionId", async (req, res) => {
  const rows = await listAuditLogs({ transactionId: req.params.transactionId });
  res.json({ success: true, data: rows });
});

export default router;
