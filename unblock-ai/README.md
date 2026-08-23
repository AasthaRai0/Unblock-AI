# UNBLOCK AI

**Multi-Party Payment Deadlock Resolver** — an AI-powered agent for marketplaces and
split-payment ecosystems that detects revenue stuck between customer, gateway,
platform, split engine, vendor, and vendor bank; diagnoses *who* is at fault and
*why*; and executes a bounded, guardrailed recovery workflow with a full audit trail.

> "Where is the money stuck — and what should we do next?"

---

## Stack

- **Frontend**: React + Vite + TypeScript, React Router, TanStack React Query, Tailwind CSS v4,
  React Flow (payment dependency graph), Recharts, Socket.IO client, Axios, Lucide icons.
- **Backend**: Node.js + Express + TypeScript, PostgreSQL, Socket.IO, Zod, JWT, bcrypt.
- **Database**: PostgreSQL with a full relational schema (users, customers, vendors,
  transactions, transaction_nodes, payment_splits, deadlocks, recovery_actions,
  audit_logs, recovery_missions, recovery_mission_stats, notifications).

### A note on Prisma

The spec called for Prisma. `prisma/schema.prisma` is included as the canonical,
documented data model — on a machine with normal internet access you can run
`npx prisma generate` and `npx prisma migrate deploy` against it and it will produce
an equivalent database.

This project was built and tested in a network-restricted sandbox that could not
reach `binaries.prisma.sh` to download Prisma's query/schema engine binaries. So the
actual runtime data-access layer talks to PostgreSQL directly through `pg`
(node-postgres) against `server/db/schema.sql`, which is hand-kept in exact parity
with `schema.prisma` (same tables, types, foreign keys, and indexes). Every mutation
that touches money still runs inside an explicit `BEGIN/COMMIT/ROLLBACK` transaction
(see `src/db.ts` → `withTransaction`), so the "use DB transactions for financial state
changes" requirement is met either way.

If you have normal internet access and want to switch to the Prisma Client at
runtime, the schema is already there — you'd swap out `src/db.ts` and the query
bodies in `src/services/*` and `src/routes/*` for Prisma Client calls with the same
return shapes.

---

## Project structure

```
unblock-ai/
  server/               Express + TypeScript backend
    db/
      schema.sql         Canonical PostgreSQL DDL (source of truth in this sandbox)
      seed.ts             Seeds demo users, 1200+ synthetic transactions, deadlocks
    prisma/
      schema.prisma       Canonical Prisma schema (for normal-internet environments)
    src/
      controllers/ (folded into routes/ for brevity)
      routes/             auth, dashboard, transactions, deadlocks, recovery,
                          vendors, audit, human-review, webhooks, simulator
      services/           faultAttributionService, aiDecisionService, recoveryService,
                          deadlockService, missionService, simulatorService,
                          auditLogService, authService
      middleware/         JWT auth guard
      sockets/            Socket.IO event bus
      types/              shared domain types
      db.ts               pg Pool + query/transaction helpers
      index.ts            server entry point
  client/                Vite + React + TypeScript frontend
    src/
      pages/              Login, Dashboard, Transactions(+detail), Deadlocks(+detail),
                          RecoveryMissions, Vendors(+detail), Analytics, AuditLog,
                          HumanReview, Settings
      components/
        layout/           Sidebar, Topbar, AppShell
        dashboard/         KPICard, RevenueChart, FaultDistribution, LiveActivity,
                          SimulationCenter
        payment/           PaymentGraph (React Flow), PaymentNode, InvestigationDrawer,
                          TransactionTimeline
        recovery/          RecoveryMissionCard, MissionProgress
        common/            StatusBadge, ConfidenceScore, Loading/Empty/Error states
      api/                axios client + typed resource calls
      context/            AuthContext (JWT stored client-side, sent as Bearer token)
      hooks/              useLiveUpdates (Socket.IO → React Query cache invalidation)
      sockets/             socket.io-client singleton
```

---

## Setup

### 1. Database

You need PostgreSQL running locally (or point `DATABASE_URL` at any Postgres instance).

```bash
# create the database
createdb unblockai

# apply the schema
cd server
cp .env.example .env   # then edit DATABASE_URL / JWT_SECRET as needed
npm install
npm run db:schema      # runs db/schema.sql against $DATABASE_URL
```

### 2. Seed demo data

```bash
cd server
npm run seed
```

This creates:
- 3 demo users (`admin@unblock.ai`, `ops@unblock.ai`, `analyst@unblock.ai`, password `password123`)
- 50 vendors and 120 customers with realistic KYC/bank-status distributions
- ~1200 synthetic transactions across 7 realistic fault scenarios (customer card
  failures, vendor KYC expiry, invalid IFSC, platform/gateway outages, split ledger
  mismatches, correlated multi-vendor outages, genuinely ambiguous failures)
- AI fault attribution run on every failed transaction, with full audit trail
- A handful of cases pre-recovered and a few queued for human review, so every page
  has real data on first load

### 3. Run the backend

```bash
cd server
npm run dev        # http://localhost:4000
```

### 4. Run the frontend

```bash
cd client
npm install
cp .env.example .env   # optional — Vite proxies /api and /socket.io to :4000 by default
npm run dev         # http://localhost:5173
```

Open **http://localhost:5173** and log in with `admin@unblock.ai` / `password123`.

---

## Demo flow (matches the track's bar)

1. **Command Center** — see Revenue at Risk, Revenue Recovered, Active Deadlocks,
   Recovery Rate, AI Attribution Accuracy, and the Human Review queue — all computed
   live from PostgreSQL, no hardcoded numbers.
2. Use the **Simulation Center** on the dashboard to "Inject Deadlock" with a chosen
   scenario (e.g. *Vendor KYC expired*) — watch it appear instantly via Socket.IO.
3. Open the transaction from **Deadlocks** or **Transactions** → see the **Payment
   Dependency Graph** (Customer → Gateway → Platform → Split → Vendor → Bank), with
   the failed node highlighted red.
4. Click the failed node to open the **AI Investigation** drawer: fault party, root
   cause, confidence, evidence trail, alternative hypotheses, recommended action.
5. Click the recommended action button (e.g. *Notify Vendor*) — this calls the real
   backend, writes an audit log, updates the transaction state, and streams a
   Socket.IO event. Watch the dashboard KPIs update **without a page refresh**.
6. Go to **Recovery Missions** → start a mission with your own guardrails (max
   retries, max automated amount, minimum confidence, recovery window). Watch it
   animate through **Scanning → Correlating → Attributing → Planning → Executing →
   Verifying → Recovered** live, with real counts and ₹ amounts.
7. Open **Audit Trail** to see the complete, timestamped DETECT → DIAGNOSE →
   ATTRIBUTE → DECIDE → ACT → VERIFY → RECOVER → AUDIT sequence for any transaction.
8. Open **Human Review** to see the small number of genuinely ambiguous /
   low-confidence cases (< 70%) that were deliberately *not* automated, and approve
   or reject them.
9. Open **Vendors** → click into one to see payout health, failure patterns, and an
   AI recommendation.

---

## Guardrails implemented (the "bar")

- **Confidence threshold**: any automation requires ≥ 70% AI confidence; below that,
  every case is routed to Human Review — never guessed at.
- **Customer retries**: capped at 3 attempts within a 72-hour window; the policy
  engine stops automatically once the limit is hit and escalates to ops instead.
- **Vendor faults**: notify the vendor and pause settlement retries until the
  underlying issue (KYC, bank details) is corrected — never blindly retried.
- **Platform/ledger faults**: pause the affected flow, **never re-charge the
  customer**, and raise an internal ops/compliance alert.
- **Idempotency**: every recovery action carries a unique idempotency key so retried
  requests or duplicate webhook deliveries can never double-execute.
- **Full audit trail**: every AI decision and every recovery action writes an
  `audit_logs` row before/around the mutation, streamed live over Socket.IO.
- **Measured recovery**: Recovery Missions report transactions scanned, deadlocks
  detected, recoverable count, actions executed, successful recoveries, amount at
  risk, and amount recovered — all real, all queryable after the fact.

---

## Environment variables

**server/.env**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unblockai?schema=public"
JWT_SECRET="change_me"
RAZORPAY_KEY_ID="rzp_test_xxxx"
RAZORPAY_KEY_SECRET="xxxx"
PORT=4000
```

**client/.env** (optional — only needed if not using the Vite dev proxy)
```
VITE_API_URL=
VITE_SOCKET_URL=
```
