import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db";
import { runMission, stopMission } from "../services/missionService";

const router = Router();

router.get("/missions", async (_req, res) => {
  const missions = await query(
    `SELECT m.*, s.transactions_scanned, s.deadlocks_detected, s.recoverable_count,
            s.actions_executed, s.successful_recoveries, s.amount_at_risk, s.amount_recovered
     FROM recovery_missions m
     LEFT JOIN LATERAL (
       SELECT * FROM recovery_mission_stats WHERE mission_id = m.id ORDER BY updated_at DESC LIMIT 1
     ) s ON true
     ORDER BY m.created_at DESC`
  );
  res.json({ success: true, data: missions });
});

const createSchema = z.object({
  name: z.string().min(1),
  objective: z.string().optional(),
  maxRetries: z.number().int().min(1).max(10).default(3),
  maxAutomatedAmount: z.number().positive().default(50000),
  minimumConfidence: z.number().min(0).max(1).default(0.7),
  recoveryWindowHours: z.number().int().min(1).default(72),
});

router.post("/missions", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  const d = parsed.data;
  const rows = await query(
    `INSERT INTO recovery_missions (name, objective, max_retries, max_automated_amount, minimum_confidence, recovery_window_hours, status)
     VALUES ($1,$2,$3,$4,$5,$6,'DRAFT') RETURNING *`,
    [d.name, d.objective ?? null, d.maxRetries, d.maxAutomatedAmount, d.minimumConfidence, d.recoveryWindowHours]
  );
  await query(`INSERT INTO recovery_mission_stats (mission_id) VALUES ($1)`, [rows[0].id]);
  res.status(201).json({ success: true, data: rows[0] });
});

router.post("/missions/:id/start", async (req, res) => {
  try {
    // fire-and-return: mission runs to completion and streams progress via Socket.IO
    runMission(req.params.id).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Mission run failed", err);
    });
    res.json({ success: true, data: { started: true } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: "MISSION_START_FAILED", message: err.message } });
  }
});

router.post("/missions/:id/stop", async (req, res) => {
  await stopMission(req.params.id);
  res.json({ success: true, data: { stopped: true } });
});

router.get("/missions/:id/stats", async (req, res) => {
  const stats = await queryOne(
    `SELECT * FROM recovery_mission_stats WHERE mission_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [req.params.id]
  );
  const mission = await queryOne(`SELECT * FROM recovery_missions WHERE id = $1`, [req.params.id]);
  res.json({ success: true, data: { mission, stats } });
});

export default router;
