import { Router } from "express";
import { z } from "zod";
import { loginUser, registerUser, sanitizeUser, verifyToken } from "../services/authService";
import { queryOne } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "OPS", "ANALYST"]).optional(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  try {
    const result = await loginUser(parsed.data.email, parsed.data.password);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
  }
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  try {
    const user = await registerUser(parsed.data.name, parsed.data.email, parsed.data.password, parsed.data.role || "OPS");
    res.json({ success: true, data: sanitizeUser(user) });
  } catch (err: any) {
    if (err.message === "EMAIL_IN_USE") {
      return res.status(409).json({ success: false, error: { code: "EMAIL_IN_USE", message: "Email already registered" } });
    }
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Could not register user" } });
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await queryOne(`SELECT id, name, email, role, created_at FROM users WHERE id = $1`, [req.user!.sub]);
  if (!user) return res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
  res.json({ success: true, data: user });
});

export default router;
