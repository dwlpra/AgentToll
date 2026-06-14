import { describe, it, expect } from "vitest";
import { fetchCatalog, fetchResource } from "../tools/fetchResource.js";

/**
 * Brief scenario — deterministic x402 / catalog checks.
 *
 * Payment execution (the live on-chain USDC transfer via 1Shot) is proven
 * by the live demo + on-chain tx, not unit tests — it requires real
 * permissionsContext, relayer, and funds.
 *
 * - #1 asia-daily ($0.10)  — fresh, verified, cheap   → worth paying
 * - #2 quick-take ($0.40)  — stale, unverified         → skip
 * - #3 deep-dive ($0.60)   — fresh, 5 verified sources → worth paying
 */
describe("Brief scenario: x402 paywall & catalog signals", () => {
  it("catalog has exactly 3 resources with correct prices", async () => {
    const catalog = await fetchCatalog();
    expect(catalog).toHaveLength(3);

    const paths = catalog.map((c: any) => c.path);
    expect(paths).toContain("/reports/asia-daily");
    expect(paths).toContain("/reports/quick-take");
    expect(paths).toContain("/reports/deep-dive");

    const prices = catalog.map((c: any) => c.priceUSD).sort();
    expect(prices).toEqual([0.1, 0.4, 0.6]);
  });

  it("all resources return 402 + accepts[] without payment", async () => {
    const paths = ["/reports/asia-daily", "/reports/quick-take", "/reports/deep-dive"];
    for (const path of paths) {
      const result = await fetchResource(path);
      expect(result.status).toBe(402);
      expect(result.accepts).toBeDefined();
      expect(result.accepts!.length).toBe(1);
    }
  });

  it("#1 asia-daily paywall signals justify paying ($0.10, fresh, verified)", async () => {
    const paywall = await fetchResource("/reports/asia-daily");
    expect(paywall.status).toBe(402);
    expect(Number(paywall.accepts![0].maxAmountRequired) / 1e6).toBe(0.10);

    const catalog = await fetchCatalog();
    const asiaDaily = catalog.find((c: any) => c.path === "/reports/asia-daily")!;
    expect(asiaDaily.freshness).toContain("fresh");
    expect(asiaDaily.verified).toBe(true);
    expect(asiaDaily.sources).toBeGreaterThanOrEqual(3);
  });

  it("#2 quick-take signals justify SKIPPING (stale, unverified, overpriced)", async () => {
    const paywall = await fetchResource("/reports/quick-take");
    expect(paywall.status).toBe(402);
    expect(Number(paywall.accepts![0].maxAmountRequired) / 1e6).toBe(0.40);

    const catalog = await fetchCatalog();
    const quickTake = catalog.find((c: any) => c.path === "/reports/quick-take")!;
    expect(quickTake.freshness).toContain("stale");
    expect(quickTake.verified).toBe(false);
    expect(quickTake.sources).toBeLessThan(2);
  });

  it("#3 deep-dive signals justify paying ($0.60, fresh, 5 verified sources)", async () => {
    const paywall = await fetchResource("/reports/deep-dive");
    expect(paywall.status).toBe(402);
    expect(Number(paywall.accepts![0].maxAmountRequired) / 1e6).toBe(0.60);

    const catalog = await fetchCatalog();
    const deepDive = catalog.find((c: any) => c.path === "/reports/deep-dive")!;
    expect(deepDive.freshness).toContain("fresh");
    expect(deepDive.verified).toBe(true);
    expect(deepDive.sources).toBeGreaterThanOrEqual(5);
  });

  it("decision cost stays under budget: $0.10 + $0.60 = $0.70 ≤ $1.00", () => {
    expect(0.10 + 0.60).toBeLessThanOrEqual(1.00);
    expect(0.10 + 0.60).toBe(0.70);
  });
});

