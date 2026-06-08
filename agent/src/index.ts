/**
 * index.ts — Entry point agent
 *
 * Alur:
 * 1. Parse query dari CLI argument
 * 2. Pre-flight check: pastikan permissionsContext ada (untuk live mode)
 * 3. Jalankan agent loop (Venice AI reasoning + payment + data retrieval)
 *
 * Cara pakai:
 *   npx tsx src/index.ts "query kamu di sini"
 *   npx tsx src/index.ts  (pakai default query)
 */

import { runAgent } from "./brain.js";
import { runMockBrain } from "./mock-brain.js";
import { initPaymentContext } from "./tools/payX402.js";
import { config } from "./config.js";

// Query from CLI args, or default query about Asian crypto market sentiment
const query = process.argv.slice(2).join(" ") ||
  "Summarize this week's Asian crypto market sentiment, then provide an in-depth analysis.";

// Jika tidak ada VENICE_API_KEY, gunakan mock brain (simulasi tanpa AI)
const useMock = !process.env.VENICE_API_KEY;

async function main() {
  console.log("============================================================");
  console.log(`USER QUERY: ${query}`);
  console.log(`BUDGET: $${config.budgetUSD} USDC`);
  console.log(`PAYMENT MODE: ${config.paymentMode}`);
  console.log("============================================================\n");

  // Pre-flight: cek apakah permissionsContext sudah tersedia
  // Jika belum, agent tetap jalan tapi pakai stub fallback
  const ready = await initPaymentContext();
  if (!ready && config.paymentMode === "live") {
    console.log("[agent] continuing in stub fallback mode\n");
  }

  if (useMock) {
    console.log("[info] VENICE_API_KEY not set — using mock brain");
    await runMockBrain(query);
  } else {
    await runAgent(query);
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
