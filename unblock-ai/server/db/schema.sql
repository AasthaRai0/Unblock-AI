-- UNBLOCK AI — PostgreSQL schema
-- Mirrors prisma/schema.prisma. Executed directly via `pg` because the sandbox
-- network cannot reach binaries.prisma.sh to fetch Prisma's engine binaries.
-- On a machine with normal internet access, `prisma migrate deploy` against
-- prisma/schema.prisma produces an equivalent structure.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN','OPS','ANALYST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('PENDING','SUCCESS','FAILED','DEADLOCKED','RECOVERING','RECOVERED','ESCALATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE node_type AS ENUM ('CUSTOMER','PAYMENT_GATEWAY','PLATFORM','SPLIT','VENDOR','BANK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM ('SUCCESS','FAILED','PENDING','PAUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE split_status AS ENUM ('PENDING','SUCCESS','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fault_party AS ENUM ('CUSTOMER','VENDOR','PLATFORM','GATEWAY','AMBIGUOUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deadlock_status AS ENUM ('OPEN','INVESTIGATING','RECOVERING','RESOLVED','ESCALATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE action_type AS ENUM ('RETRY_PAYMENT','SEND_CUSTOMER_NOTIFICATION','SEND_VENDOR_NOTIFICATION','PAUSE_RETRY','ESCALATE_OPS','ESCALATE_COMPLIANCE','RETRY_SETTLEMENT','HUMAN_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE action_status AS ENUM ('PENDING','EXECUTED','COMPLETED','FAILED','BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mission_status AS ENUM ('DRAFT','RUNNING','PAUSED','COMPLETED','STOPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('PENDING','SENT','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE recipient_type AS ENUM ('CUSTOMER','VENDOR','OPS','COMPLIANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'OPS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_last4 TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  kyc_status TEXT NOT NULL DEFAULT 'VERIFIED',
  account_status TEXT NOT NULL DEFAULT 'ACTIVE',
  payout_success_rate DOUBLE PRECISION NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_kyc ON vendors(kyc_status);
CREATE INDEX IF NOT EXISTS idx_vendors_account_status ON vendors(account_status);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT NOT NULL,
  status transaction_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_vendor ON transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tx_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);

CREATE TABLE IF NOT EXISTS transaction_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  node_type node_type NOT NULL,
  status node_status NOT NULL DEFAULT 'PENDING',
  metadata JSONB,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_node_tx ON transaction_nodes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_node_status ON transaction_nodes(status);

CREATE TABLE IF NOT EXISTS payment_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  vendor_amount DOUBLE PRECISION NOT NULL,
  platform_fee DOUBLE PRECISION NOT NULL,
  tax_amount DOUBLE PRECISION NOT NULL,
  total_amount DOUBLE PRECISION NOT NULL,
  status split_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_split_tx ON payment_splits(transaction_id);

CREATE TABLE IF NOT EXISTS deadlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  fault_party fault_party NOT NULL,
  root_cause TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  status deadlock_status NOT NULL DEFAULT 'OPEN',
  recovery_potential DOUBLE PRECISION NOT NULL,
  evidence JSONB,
  alternative_hypotheses JSONB,
  recommended_action TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_deadlock_status ON deadlocks(status);
CREATE INDEX IF NOT EXISTS idx_deadlock_fault ON deadlocks(fault_party);
CREATE INDEX IF NOT EXISTS idx_deadlock_tx ON deadlocks(transaction_id);

CREATE TABLE IF NOT EXISTS recovery_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadlock_id UUID NOT NULL REFERENCES deadlocks(id) ON DELETE CASCADE,
  action_type action_type NOT NULL,
  target_party TEXT NOT NULL,
  status action_status NOT NULL DEFAULT 'PENDING',
  reason TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  idempotency_key TEXT UNIQUE,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_action_deadlock ON recovery_actions(deadlock_id);
CREATE INDEX IF NOT EXISTS idx_action_status ON recovery_actions(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  deadlock_id UUID REFERENCES deadlocks(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  reason TEXT,
  confidence DOUBLE PRECISION,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_tx ON audit_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_deadlock ON audit_logs(deadlock_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS recovery_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  objective TEXT,
  status mission_status NOT NULL DEFAULT 'DRAFT',
  max_retries INT NOT NULL DEFAULT 3,
  max_automated_amount DOUBLE PRECISION NOT NULL DEFAULT 50000,
  minimum_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  recovery_window_hours INT NOT NULL DEFAULT 72,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_mission_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES recovery_missions(id) ON DELETE CASCADE,
  transactions_scanned INT NOT NULL DEFAULT 0,
  deadlocks_detected INT NOT NULL DEFAULT 0,
  recoverable_count INT NOT NULL DEFAULT 0,
  actions_executed INT NOT NULL DEFAULT 0,
  successful_recoveries INT NOT NULL DEFAULT 0,
  amount_at_risk DOUBLE PRECISION NOT NULL DEFAULT 0,
  amount_recovered DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mission_stats_mission ON recovery_mission_stats(mission_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type recipient_type NOT NULL,
  recipient_id UUID NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_type, recipient_id);
