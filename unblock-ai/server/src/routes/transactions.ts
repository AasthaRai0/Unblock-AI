import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db";
import { emitEvent } from "../sockets";

const router = Router();

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Number(req.query.pageSize ?? 20));
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const sortBy = ["created_at", "amount", "status"].includes(String(req.query.sortBy))
    ? String(req.query.sortBy)
    : "created_at";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";

  const conditions: string[] = [];
  const params: any[] = [];
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(t.external_id ILIKE $${params.length} OR c.name ILIKE $${params.length} OR v.name ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(pageSize);
  const limitIdx = params.length;
  params.push((page - 1) * pageSize);
  const offsetIdx = params.length;

  const rows = await query(
    `SELECT t.*, c.name as customer_name, v.name as vendor_name
     FROM transactions t
     JOIN customers c ON c.id = t.customer_id
     JOIN vendors v ON v.id = t.vendor_id
     ${where}
     ORDER BY t.${sortBy} ${sortDir}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM transactions t
     JOIN customers c ON c.id = t.customer_id
     JOIN vendors v ON v.id = t.vendor_id
     ${where}`,
    params.slice(0, params.length - 2)
  );

  res.json({
    success: true,
    data: rows,
    meta: { page, pageSize, total: countRow ? parseInt(countRow.count, 10) : 0 },
  });
});

router.get("/:id", async (req, res) => {
  const tx = await queryOne(
    `SELECT t.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
            v.name as vendor_name, v.kyc_status as vendor_kyc_status, v.account_status as vendor_account_status
     FROM transactions t
     JOIN customers c ON c.id = t.customer_id
     JOIN vendors v ON v.id = t.vendor_id
     WHERE t.id = $1`,
    [req.params.id]
  );
  if (!tx) return res.status(404).json({ success: false, error: { code: "TRANSACTION_NOT_FOUND", message: "Transaction not found" } });

  const nodes = await query(`SELECT * FROM transaction_nodes WHERE transaction_id = $1 ORDER BY created_at ASC`, [req.params.id]);
  const split = await queryOne(`SELECT * FROM payment_splits WHERE transaction_id = $1`, [req.params.id]);
  const deadlock = await queryOne(`SELECT * FROM deadlocks WHERE transaction_id = $1 ORDER BY detected_at DESC LIMIT 1`, [req.params.id]);
  const recoveryActions = deadlock
    ? await query(`SELECT * FROM recovery_actions WHERE deadlock_id = $1 ORDER BY created_at ASC`, [(deadlock as any).id])
    : [];
  const auditLogs = await query(`SELECT * FROM audit_logs WHERE transaction_id = $1 ORDER BY created_at ASC`, [req.params.id]);

  res.json({ success: true, data: { transaction: tx, nodes, split, deadlock, recoveryActions, auditLogs } });
});

const createSchema = z.object({
  customerId: z.string().uuid(),
  vendorId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.string(),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  const { customerId, vendorId, amount, paymentMethod } = parsed.data;
  const externalId = `TX-${Date.now().toString().slice(-6)}`;
  const rows = await query(
    `INSERT INTO transactions (external_id, customer_id, vendor_id, amount, payment_method, status)
     VALUES ($1,$2,$3,$4,$5,'PENDING') RETURNING *`,
    [externalId, customerId, vendorId, amount, paymentMethod]
  );
  emitEvent("transaction:updated", rows[0]);
  res.status(201).json({ success: true, data: rows[0] });
});

const statusSchema = z.object({
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "DEADLOCKED", "RECOVERING", "RECOVERED", "ESCALATED"]),
});

router.patch("/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  const rows = await query(
    `UPDATE transactions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id, parsed.data.status]
  );
  if (!rows.length) return res.status(404).json({ success: false, error: { code: "TRANSACTION_NOT_FOUND", message: "Transaction not found" } });
  emitEvent("transaction:updated", rows[0]);
  res.json({ success: true, data: rows[0] });
});

export default router;
