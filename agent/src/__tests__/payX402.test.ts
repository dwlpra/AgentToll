import { describe, it, expect } from "vitest";
import { payX402 } from "../tools/payX402.js";

// These tests require the gateway running with webhook endpoint
describe("payX402 stub mode", () => {
  it("pays and returns success", async () => {
    const result = await payX402(
      "/reports/asia-daily",
      "100000",
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "0x0000000000000000000000000000000000000000"
    );
    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();
  });

  it("can pay for multiple resources sequentially", async () => {
    const r1 = await payX402("/reports/asia-daily", "100000", "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "0xGW");
    const r2 = await payX402("/reports/deep-dive", "600000", "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "0xGW");

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.taskId).not.toBe(r2.taskId);
  });
});
