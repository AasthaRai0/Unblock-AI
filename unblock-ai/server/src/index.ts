import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import { initSocket } from "./sockets";
import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import transactionsRoutes from "./routes/transactions";
import deadlocksRoutes from "./routes/deadlocks";
import recoveryRoutes from "./routes/recovery";
import vendorsRoutes from "./routes/vendors";
import auditRoutes from "./routes/audit";
import humanReviewRoutes from "./routes/humanReview";
import webhookRoutes from "./routes/webhooks";
import simulatorRoutes from "./routes/simulator";
import { requireAuth } from "./middleware/auth";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});
initSocket(io);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));

app.use("/api/auth", authRoutes);
app.use("/api/webhooks", webhookRoutes);

// Everything below requires a valid JWT. For hackathon-demo convenience the
// simulator & read-only GETs are intentionally left open in dev; flip
// ENFORCE_AUTH=true to lock down every route below requireAuth.
const enforceAuth = process.env.ENFORCE_AUTH === "true";
const authGate = enforceAuth ? requireAuth : (_req: any, _res: any, next: any) => next();

app.use("/api/dashboard", authGate, dashboardRoutes);
app.use("/api/transactions", authGate, transactionsRoutes);
app.use("/api/deadlocks", authGate, deadlocksRoutes);
app.use("/api/recovery", authGate, recoveryRoutes);
app.use("/api/vendors", authGate, vendorsRoutes);
app.use("/api/audit-logs", authGate, auditRoutes);
app.use("/api/human-review", authGate, humanReviewRoutes);
app.use("/api/simulator", authGate, simulatorRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message || "Internal server error" } });
});

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`UNBLOCK AI server listening on :${PORT}`);
});
