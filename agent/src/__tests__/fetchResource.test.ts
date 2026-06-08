import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fetchCatalog, fetchResource, fetchWithPayment } from "../tools/fetchResource.js";

// These tests require the gateway + mock-api running on localhost:19090
// Run: cd mock-api && ./mock-api && cd gateway && ./gateway
const GATEWAY = "http://localhost:19090";

describe("fetchCatalog", () => {
  it("returns 3 catalog entries", async () => {
    const catalog = await fetchCatalog();
    expect(catalog).toHaveLength(3);
  });

  it("each entry has required fields", async () => {
    const catalog = await fetchCatalog();
    for (const entry of catalog) {
      expect(entry).toHaveProperty("path");
      expect(entry).toHaveProperty("priceUSD");
      expect(entry).toHaveProperty("priceUnits");
      expect(entry).toHaveProperty("freshness");
      expect(entry).toHaveProperty("sources");
      expect(entry).toHaveProperty("verified");
      expect(entry).toHaveProperty("summary");
    }
  });

  it("prices match brief: 0.10, 0.40, 0.60", async () => {
    const catalog = await fetchCatalog();
    const prices = catalog.map((c: any) => c.priceUSD).sort();
    expect(prices).toEqual([0.1, 0.4, 0.6]);
  });
});

describe("fetchResource without payment returns 402", () => {
  it("/reports/asia-daily returns 402", async () => {
    const result = await fetchResource("/reports/asia-daily");
    expect(result.status).toBe(402);
    expect(result.accepts).toBeDefined();
    expect(result.accepts!.length).toBeGreaterThan(0);
  });

  it("/reports/quick-take returns 402", async () => {
    const result = await fetchResource("/reports/quick-take");
    expect(result.status).toBe(402);
    expect(result.accepts![0].maxAmountRequired).toBe("400000");
  });

  it("/reports/deep-dive returns 402", async () => {
    const result = await fetchResource("/reports/deep-dive");
    expect(result.status).toBe(402);
    expect(result.accepts![0].maxAmountRequired).toBe("600000");
  });

  it("402 response has correct x402 schema", async () => {
    const result = await fetchResource("/reports/asia-daily");
    const accept = result.accepts![0];
    expect(accept.scheme).toBe("exact");
    expect(accept.network).toBe("base-sepolia");
    expect(accept.asset).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(accept.maxTimeoutSeconds).toBe(60);
  });
});
