import { config } from "./config.js";
import { fetchCatalog, fetchResource, fetchWithPayment } from "./tools/fetchResource.js";
import { payX402 } from "./tools/payX402.js";
import * as fmt from "./utils/format.js";

const AGENT_WALLET = config.agentWallet;

// Simulates Venice brain decisions: pay #1, skip #2, pay #3
const DECISIONS = [
  { path: "/reports/asia-daily", action: "pay" as const, reason: "Fresh (4 hours ago), 3 verified sources, only $0.10 — excellent value for daily overview." },
  { path: "/reports/quick-take", action: "skip" as const, reason: "$0.40 for stale 9-day data with only 1 unverified source — not worth it." },
  { path: "/reports/deep-dive", action: "pay" as const, reason: "Expensive ($0.60) but fresh today, 5 verified sources, deep analysis — worth it. Total after: $0.70 ≤ budget $1.00." },
];

export async function runMockBrain(query: string): Promise<void> {
  console.log(fmt.header("🤖  PayCrawl — Autonomous Pay-Per-Crawl (MOCK)"));
  console.log(fmt.infoTag("Query", query));
  console.log(fmt.infoTag("Budget", `$${config.budgetUSD} USDC`));
  console.log(fmt.infoTag("Mode", "MOCK BRAIN (no Venice API needed)"));
  console.log(fmt.budgetMeter(0, config.budgetUSD));

  // Step 1: Catalog
  console.log(fmt.section("FETCHING CATALOG"));
  let catalog: any[];
  try {
    catalog = await fetchCatalog();
  } catch (err) {
    console.error(fmt.color(`  ✖ FATAL: ${err instanceof Error ? err.message : err}`, "\x1b[91m\x1b[1m"));
    return;
  }

  console.log(fmt.dim(`  Found ${catalog.length} resources:\n`));
  for (const item of catalog) {
    console.log(fmt.catalogItem(item));
  }

  let totalSpent = 0;
  let skippedCount = 0;
  const gatheredData: any[] = [];

  // Step 2: Process each decision
  for (const decision of DECISIONS) {
    console.log(fmt.section(decision.path.toUpperCase()));

    // Hit the paywall
    const result = await fetchResource(decision.path);

    if (result.status === 402 && result.accepts) {
      const accept = result.accepts[0];
      const cost = Number(accept.maxAmountRequired) / 1_000_000;

      console.log(fmt.paywallHit(decision.path));

      if (decision.action === "skip") {
        console.log(fmt.skipDecision(decision.path, decision.reason));
        skippedCount++;
        continue;
      }

      // Check budget
      if (totalSpent + cost > config.budgetUSD) {
        console.log(fmt.paymentRejected(cost.toFixed(2), config.budgetUSD.toFixed(2)));
        skippedCount++;
        continue;
      }

      // Pay
      console.log(fmt.payDecision(decision.path, cost.toFixed(2), decision.reason));
      const payResult = await payX402(decision.path, accept.maxAmountRequired, accept.asset, accept.payTo);

      if (!payResult.success) {
        console.log(fmt.color(`  ✖ PAYMENT FAILED: ${payResult.error}`, "\x1b[91m"));
        continue;
      }

      totalSpent += cost;
      console.log(fmt.paymentConfirmed(cost.toFixed(2), payResult.txHash));

      // Retry fetch
      const retryResult = await fetchWithPayment(decision.path, AGENT_WALLET);
      if (retryResult.status === 200 && retryResult.data) {
        gatheredData.push(retryResult.data);
        console.log(fmt.dataRetrieved(decision.path));
        console.log(fmt.dim(`  → "${retryResult.data.title}"`));
      }

      console.log(fmt.dim(`  Budget: ${fmt.budgetMeter(totalSpent, config.budgetUSD, 20)}`));
    } else if (result.status === 200 && result.data) {
      gatheredData.push(result.data);
      console.log(fmt.dataRetrieved(decision.path));
      console.log(fmt.dim(`  → "${result.data.title}" (already authorized)`));
    }
  }

  // Step 3: Synthesize
  console.log(fmt.section("VENICE SYNTHESIS"));

  if (gatheredData.length === 0) {
    console.log(fmt.color("  ✖ No data was successfully collected.", "\x1b[91m"));
  } else {
    console.log(fmt.reasoningBox(`Synthesizing ${gatheredData.length} paid sources (total $${totalSpent.toFixed(2)})`));
    console.log();

    for (const d of gatheredData) {
      console.log(fmt.color(`  ## ${d.title}`, "\x1b[96m\x1b[1m"));
      console.log(fmt.dim(`  ${d.summary}\n`));
    }

    console.log(fmt.section("ANALYSIS"));
    console.log(fmt.dim("  Asian crypto market sentiment this week shows cautious optimism:"));
    console.log(fmt.dim("  • BTC holding $67.2K support with Korean retail volume up 23%"));
    console.log(fmt.dim("  • KRW premium index at 2.3% (above 30-day avg of 1.1%) — strong accumulation signal"));
    console.log(fmt.dim("  • 5 verified sources indicate medium-term bullish outlook (2-4 weeks)"));
    console.log(fmt.dim("  • Risk factors: potential OTC regulatory tightening in China, BOJ interest rate policy"));
    console.log(fmt.dim("  • Quick Take ($0.40) REJECTED due to 9-day stale data and unverified source"));
    console.log(fmt.color("  Verdict: Bullish with high conviction, key level BTC $68.5K resistance", "\x1b[92m\x1b[1m"));
  }

  console.log(fmt.summaryFooter(totalSpent, config.budgetUSD, gatheredData.length, skippedCount));
}
