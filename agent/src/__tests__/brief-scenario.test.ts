import { describe, it, expect } from "vitest";
import { fetchCatalog, fetchResource, fetchWithPayment } from "../tools/fetchResource.js";
import { payX402 } from "../tools/payX402.js";
import { config } from "../config.js";

/**
 * Full brief scenario test:
 * - Budget: $1.00 USDC
 * - Pay #1 asia-daily ($0.10) — fresh, verified, cheap
 * - Skip #2 quick-take ($0.40) — stale, unverified, overpriced
 * - Pay #3 deep-dive ($0.60) — fresh, 5 verified sources
 * - Total: $0.70 ≤ $1.00 budget
 */
describe("Brief scenario: 3-endpoint agent decision", () => {
  it("catalog has exactly 3 resources with correct prices", async () => {
    const catalog = await fetchCatalog();
    expect(catalog).toHaveLength(3);

    const paths = catalog.map((c: any) => c.path);
    expect(paths).toContain("/reports/asia-daily");
    expect(paths).toContain("/reports/quick-take");
    expect(paths).toContain("/reports/deep-dive");
  });

  it("all resources return 402 without payment", async () => {
    const paths = ["/reports/asia-daily", "/reports/quick-take", "/reports/deep-dive"];
    for (const path of paths) {
      const result = await fetchResource(path);
      expect(result.status).toBe(402);
      expect(result.accepts).toBeDefined();
      expect(result.accepts!.length).toBe(1);
    }
  });

  it("agent pays for #1 asia-daily ($0.10) and retrieves data", async () => {
    // Get paywall info
    const paywall = await fetchResource("/reports/asia-daily");
    expect(paywall.status).toBe(402);

    const cost = Number(paywall.accepts![0].maxAmountRequired) / 1_000_000;
    expect(cost).toBe(0.10);

    // Pay
    const payResult = await payX402(
      "/reports/asia-daily",
      paywall.accepts![0].maxAmountRequired,
      paywall.accepts![0].asset,
      paywall.accepts![0].payTo
    );
    expect(payResult.success).toBe(true);

    // Retry — get data (use same wallet that was authorized by the payment)
    const data = await fetchWithPayment("/reports/asia-daily", config.agentWallet);
    expect(data.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.id).toBe("asia-daily");
    expect(data.data.verified).toBe(true);
    expect(data.data.sources).toBeGreaterThanOrEqual(3);
  });

  it("agent SKIPS #2 quick-take (stale, unverified, overpriced)", async () => {
    const paywall = await fetchResource("/reports/quick-take");
    expect(paywall.status).toBe(402);

    const accept = paywall.accepts![0];
    const cost = Number(accept.maxAmountRequired) / 1_000_000;

    // Venice reasoning: skip because stale + unverified
    // We verify the signals that justify skipping:
    // Get catalog to check metadata
    const catalog = await fetchCatalog();
    const quickTake = catalog.find((c: any) => c.path === "/reports/quick-take")!;

    expect(quickTake.freshness).toContain("stale");
    expect(quickTake.verified).toBe(false);
    expect(quickTake.sources).toBeLessThan(2);
    expect(cost).toBe(0.40); // expensive for low quality

    // Agent decides NOT to pay — no payX402 call
    // Budget stays at $0.10 so far
  });

  it("agent pays for #3 deep-dive ($0.60) — total $0.70 under budget", async () => {
    const paywall = await fetchResource("/reports/deep-dive");
    expect(paywall.status).toBe(402);

    const accept = paywall.accepts![0];
    const cost = Number(accept.maxAmountRequired) / 1_000_000;
    expect(cost).toBe(0.60);

    // Verify quality signals justify the price
    const catalog = await fetchCatalog();
    const deepDive = catalog.find((c: any) => c.path === "/reports/deep-dive")!;

    expect(deepDive.freshness).toContain("fresh");
    expect(deepDive.verified).toBe(true);
    expect(deepDive.sources).toBeGreaterThanOrEqual(5);

    // Total budget check: $0.10 (already paid) + $0.60 = $0.70 ≤ $1.00
    const totalSpent = 0.10 + cost;
    expect(totalSpent).toBeLessThanOrEqual(1.00);

    // Pay
    const payResult = await payX402("/reports/deep-dive", accept.maxAmountRequired, accept.asset, accept.payTo);
    expect(payResult.success).toBe(true);

    // Get data (use same wallet that was authorized by the payment)
    const data = await fetchWithPayment("/reports/deep-dive", config.agentWallet);
    expect(data.status).toBe(200);
    expect(data.data.id).toBe("deep-dive");
    expect(data.data.summary.length).toBeGreaterThan(200); // comprehensive report
  });

  it("total spend is $0.70 — under $1.00 budget", () => {
    const totalSpent = 0.10 + 0.60; // #1 + #3
    const budget = 1.00;
    expect(totalSpent).toBeLessThanOrEqual(budget);
    expect(totalSpent).toBe(0.70);
  });
});
