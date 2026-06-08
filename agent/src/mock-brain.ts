import { config } from "./config.js";
import { fetchCatalog, fetchResource, fetchWithPayment } from "./tools/fetchResource.js";
import { payX402 } from "./tools/payX402.js";

const AGENT_WALLET = "0xAGENT_WALLET";

// Simulates Venice brain decisions: pay #1, skip #2, pay #3
const DECISIONS = [
  { path: "/reports/asia-daily", action: "pay" as const, reason: "Fresh (4 hours ago), 3 verified sources, only $0.10 — excellent value for daily overview." },
  { path: "/reports/quick-take", action: "skip" as const, reason: "REJECTED: $0.40 for stale 9-day data, 1 unverified source — not worth it." },
  { path: "/reports/deep-dive", action: "pay" as const, reason: "Expensive ($0.60) but fresh today, 5 verified sources, deep analysis — worth it. Total after: $0.70 <= budget $1.00." },
];

export async function runMockBrain(query: string): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`USER QUERY: ${query}`);
  console.log(`BUDGET: $${config.budgetUSD} USDC`);
  console.log(`MODE: MOCK BRAIN (no Venice API needed)`);
  console.log(`${"=".repeat(60)}\n`);

  // Step 1: Catalog
  console.log("[agent] fetching catalog...");
  const catalog = await fetchCatalog();
  console.log(`[agent] found ${catalog.length} resources:\n`);
  for (const item of catalog) {
    console.log(`  ${item.path} | $${item.priceUSD} | ${item.freshness} | ${item.sources} src | verified=${item.verified}`);
  }
  console.log();

  let totalSpent = 0;
  const gatheredData: any[] = [];

  // Step 2: Process each decision
  for (const decision of DECISIONS) {
    console.log(`\n--- ${decision.path} ---`);

    // Hit the paywall
    const result = await fetchResource(decision.path);

    if (result.status === 402 && result.accepts) {
      const accept = result.accepts[0];
      const cost = Number(accept.maxAmountRequired) / 1_000_000;

      console.log(`[venice reasoning] ${decision.reason}`);

      if (decision.action === "skip") {
        console.log(`[agent] SKIPPED ${decision.path} — budget safe ($${totalSpent} spent so far)`);
        continue;
      }

      // Check budget
      if (totalSpent + cost > config.budgetUSD) {
        console.log(`[agent] SKIPPED ${decision.path} — would exceed budget ($${totalSpent + cost} > $${config.budgetUSD})`);
        continue;
      }

      // Pay
      console.log(`[agent] paying $${cost} for ${decision.path}...`);
      const payResult = await payX402(decision.path, accept.maxAmountRequired, accept.asset, accept.payTo);

      if (!payResult.success) {
        console.log(`[agent] PAYMENT FAILED: ${payResult.error}`);
        continue;
      }

      totalSpent += cost;
      console.log(`[agent] payment confirmed (taskId: ${payResult.taskId})`);

      // Retry fetch
      const retryResult = await fetchWithPayment(decision.path, AGENT_WALLET);
      if (retryResult.status === 200 && retryResult.data) {
        gatheredData.push(retryResult.data);
        console.log(`[agent] data retrieved: "${retryResult.data.title}"`);
      } else {
        console.log(`[agent] retry failed: ${retryResult.error || retryResult.status}`);
      }
    } else if (result.status === 200 && result.data) {
      gatheredData.push(result.data);
      console.log(`[agent] already authorized, data retrieved: "${result.data.title}"`);
    }
  }

  // Step 3: Synthesize
  console.log(`\n${"=".repeat(60)}`);
  console.log(`VENICE SYNTHESIS:\n`);

  if (gatheredData.length === 0) {
    console.log("No data was successfully collected.");
  } else {
    console.log(`Based on ${gatheredData.length} paid sources (total $${totalSpent.toFixed(2)}):\n`);
    for (const d of gatheredData) {
      console.log(`## ${d.title}`);
      console.log(`${d.summary}\n`);
    }

    console.log("--- SYNTHESIS ANALYSIS ---");
    console.log("Asian crypto market sentiment this week shows cautious optimism:");
    console.log("- BTC holding $67.2K support with Korean retail volume up 23%");
    console.log("- KRW premium index at 2.3% (above 30-day avg of 1.1%) — strong accumulation signal");
    console.log("- 5 verified sources indicate medium-term bullish outlook (2-4 weeks)");
    console.log("- Risk factors: potential OTC regulatory tightening in China, BOJ interest rate policy");
    console.log("- Quick Take ($0.40) REJECTED due to 9-day stale data and unverified source");
    console.log("- Verdict: Bullish with high conviction, key level BTC $68.5K resistance");
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`BUDGET: $${totalSpent.toFixed(2)} / $${config.budgetUSD} used`);
  console.log(`RESOURCES: ${gatheredData.length} paid, 1 skipped`);
  console.log(`${"=".repeat(60)}`);
}
