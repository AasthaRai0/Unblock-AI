import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import { pool, query } from "../src/db";
import { generateBatch, detectDeadlocksForPendingTransactions } from "../src/services/simulatorService";

async function main() {
  console.log("Seeding UNBLOCK AI database...");

  // Users
  const passwordHash = await bcrypt.hash("password123", 10);
  await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
      ('Admin User','admin@unblock.ai',$1,'ADMIN'),
      ('Ops Manager','ops@unblock.ai',$1,'OPS'),
      ('Risk Analyst','analyst@unblock.ai',$1,'ANALYST')
     ON CONFLICT (email) DO NOTHING`,
    [passwordHash]
  );
  console.log("Users seeded (password for all: password123)");

  console.log("Generating 1200 synthetic transactions across realistic fault scenarios...");
  await generateBatch(1200);

  console.log("Running fault attribution on all failed transactions...");
  const deadlocks = await detectDeadlocksForPendingTransactions(5000);
  console.log(`Created ${deadlocks.length} deadlocks with full audit trail.`);

  console.log("Queuing ambiguous/low-confidence cases for human review...");
  const { executeRecoveryStep } = await import("../src/services/recoveryService");
  let queuedForReview = 0;
  for (const d of deadlocks as any[]) {
    if (d.fault_party === "AMBIGUOUS") {
      await executeRecoveryStep(d.id);
      queuedForReview++;
    }
  }
  console.log(`Queued ${queuedForReview} cases for human review.`);

  console.log("Simulating recovery progress on a portion of vendor/customer faults...");
  const { markRecovered } = await import("../src/services/recoveryService");
  let recovered = 0;
  const actionable = (deadlocks as any[]).filter((d) => d.fault_party !== "AMBIGUOUS" && d.fault_party !== "PLATFORM");
  for (const d of actionable) {
    if (Math.random() < 0.4) {
      await executeRecoveryStep(d.id);
      if (Math.random() < 0.75) {
        await markRecovered(d.id);
        recovered++;
      }
    }
  }
  console.log(`Recovered ${recovered} transactions to seed a realistic recovery rate.`);

  // Create a default recovery mission for the demo
  const mission = await query(
    `INSERT INTO recovery_missions (name, objective, max_retries, max_automated_amount, minimum_confidence, recovery_window_hours, status)
     VALUES ('Q1 Recovery Sweep','Recover stuck revenue across the marketplace',3,50000,0.7,72,'DRAFT')
     RETURNING id`
  );
  await query(`INSERT INTO recovery_mission_stats (mission_id) VALUES ($1)`, [mission[0].id]);

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
