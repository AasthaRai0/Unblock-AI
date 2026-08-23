import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query, queryOne } from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "7d";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: "ADMIN" | "OPS" | "ANALYST";
}

export async function registerUser(name: string, email: string, password: string, role: string) {
  const existing = await queryOne(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing) throw new Error("EMAIL_IN_USE");
  const hash = await bcrypt.hash(password, 10);
  const rows = await query<UserRow>(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
     RETURNING id, name, email, password_hash, role`,
    [name, email, hash, role || "OPS"]
  );
  return rows[0];
}

export async function loginUser(email: string, password: string) {
  const user = await queryOne<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
  if (!user) throw new Error("INVALID_CREDENTIALS");
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");
  const token = signToken(user);
  return { token, user: sanitizeUser(user) };
}

export function signToken(user: UserRow) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { sub: string; role: string; email: string };
}

export function sanitizeUser(user: UserRow) {
  const { password_hash, ...rest } = user;
  return rest;
}
