/**
 * relayer.ts — 1Shot Permissionless Relayer client
 *
 * Correct RPC formats per 1Shot public relayer API:
 * - params are objects (not wrapped in arrays)
 * - relayer_getFeeData: { chainId, token }
 * - relayer_send7710Transaction: { chainId, context, transactions, destinationUrl }
 * - relayer_getStatus: taskId string
 */

import { config } from "../config.js";

// === RESPONSE TYPES ===

interface FeeData {
  gasPrice: string;
  rate: number;
  minFee: string;
  expiry: number;
  context: string;
  feeCollector?: string;
  targetAddress?: string;
  token?: { address: string; decimals: number; symbol?: string };
}

interface RelayerTask {
  taskId: string;
  status: string;
  txHash?: string;
}

let rpcId = 0;

/**
 * Generic JSON-RPC call. Params can be object or array.
 */
async function rpcCall(method: string, params: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(config.relayerBaseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++rpcId,
        method,
        params,
      }),
    });
  } catch (err) {
    throw new Error(`1Shot RPC network error (${method}): ${err instanceof Error ? err.message : err}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`1Shot RPC HTTP ${res.status} (${method}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`1Shot RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data.result;
}

export class OneShotRelayer {
  /**
   * Fetch fee data for a chain+token.
   * Correct format: params = { chainId: "8453", token: "0x..." }
   */
  async getFeeData(chainId: string, tokenAddress: string): Promise<FeeData> {
    return rpcCall("relayer_getFeeData", { chainId, token: tokenAddress });
  }

  /**
   * Submit an ERC-7710 transaction.
   * Correct format per skill examples:
   *   params = {
   *     chainId: "8453",
   *     context: feeData.context,
   *     transactions: [{
   *       permissionContext: [...delegations],
   *       executions: [{ target, value, data }, ...]
   *     }],
   *     destinationUrl?: webhook
   *   }
   */
  async send7710Transaction(params: {
    chainId: string;
    context?: string;
    transactions: Array<{
      permissionContext: any[];
      executions: Array<{
        target: string;
        value: string;
        data: string;
      }>;
    }>;
    destinationUrl?: string;
  }): Promise<{ taskId: string }> {
    const payload = {
      chainId: params.chainId,
      context: params.context,
      transactions: params.transactions,
      destinationUrl: params.destinationUrl || `${config.gatewayUrl}/webhook`,
    };
    const result = await rpcCall("relayer_send7710Transaction", payload);
    console.log("[relayer] send7710 raw result:", JSON.stringify(result).slice(0, 300));
    // Result may be a bare string (taskId) or an object {taskId}
    if (typeof result === "string") return { taskId: result };
    if (result && typeof result === "object") return { taskId: result.taskId || result.task_id || result.id || JSON.stringify(result) };
    return { taskId: String(result || "") };
  }

  /**
   * Fetch the current status of a task.
   */
  async getStatus(taskId: string): Promise<RelayerTask> {
    // relayer_getStatus expects { id: taskId }
    const result = await rpcCall("relayer_getStatus", { id: taskId });
    return {
      taskId,
      status: String(result.status),
      txHash: result.receipt?.transactionHash || result.txHash,
    };
  }

  /**
   * Poll until final state or timeout.
   */
  async pollStatus(taskId: string, timeoutMs: number): Promise<RelayerTask> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const status = await this.getStatus(taskId);
      if (["200", "confirmed", "success", "1"].includes(String(status.status))) {
          return status;
        }
      } catch (err) {
        console.error(`[relayer] poll error for ${taskId}: ${err instanceof Error ? err.message : err}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { taskId, status: "timeout" };
  }
}
