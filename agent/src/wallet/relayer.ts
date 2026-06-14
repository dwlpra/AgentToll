/**
 * relayer.ts — 1Shot Permissionless Relayer client
 *
 * The 1Shot relayer executes ERC-7710 transactions on the user's behalf
 * GASLESSLY (the user never pays gas).
 *
 * How it works:
 * 1. The user grants permissions via MetaMask (ERC-7715) → receives a permissionsContext
 * 2. The agent sends permissionsContext + calldata to the relayer
 * 3. The relayer decodes the delegation from the context
 * 4. The relayer builds and submits the transaction to the blockchain
 * 5. The relayer pays the gas (sponsor)
 * 6. The relayer notifies the webhook when finished
 *
 * API: JSON-RPC over HTTP
 * Testnet: https://relayer.1shotapi.dev/relayers
 * Mainnet: https://relayer.1shotapi.com/relayers
 */

import { config } from "../config.js";

// === RESPONSE TYPES ===

// Fee data returned by the relayer
interface FeeData {
  gasPrice: string;  // current gas price
  rate: number;      // exchange rate
  minFee: string;    // minimum fee
  expiry: number;    // fee-quote expiry timestamp
  context: string;   // context to attach to the transaction
}

// Relayer task status
interface RelayerTask {
  taskId: string;
  status: string;    // "pending" | "confirmed" | "success" | "failed" | "reverted"
  txHash?: string;   // on-chain transaction hash (available after confirmation)
}

// JSON-RPC request ID counter
let rpcId = 0;

/**
 * Generic JSON-RPC call to the 1Shot relayer.
 *
 * 1Shot uses the JSON-RPC protocol (same as Ethereum RPC).
 * Each call carries a method name + params and returns either a result or an error.
 */
async function rpcCall(method: string, params: any[]): Promise<any> {
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

/**
 * OneShotRelayer — Client for interacting with the 1Shot relayer API.
 *
 * Available methods:
 * - getFeeData()           → fees and current gas price
 * - send7710Transaction()  → submit an ERC-7710 transaction for gasless execution
 * - getStatus()            → check the status of a task
 * - pollStatus()           → wait until a task reaches a final state
 */
export class OneShotRelayer {

  /**
   * Fetch fee data for a transaction.
   * Returns a fee quote that remains valid for a short period.
   */
  async getFeeData(chainId: string, tokenAddress: string): Promise<FeeData> {
    return rpcCall("relayer_getFeeData", [{ chainId, tokenAddress }]);
  }

  /**
   * Submit an ERC-7710 transaction to the relayer for gasless execution.
   *
   * This is the primary method — the agent calls it to pay for a resource.
   *
   * Parameters:
   * - chainId: hex format (e.g. "0x14a34")
   * - from: smart account address (the agent wallet)
   * - to: USDC contract address
   * - data: encoded transfer calldata
   * - permissionContext: delegation data from the MetaMask grant
   * - context: fee-data context returned by getFeeData()
   * - destinationUrl: webhook URL for confirmation notifications
   *
   * Returns: a taskId for status tracking.
   */
  async send7710Transaction(params: {
    chainId: string;
    from: string;
    to: string;
    data: string;
    value?: string;
    permissionContext: any[];
    authorizationList?: any[];
    context?: string;
    destinationUrl?: string;
    memo?: string;
  }): Promise<{ taskId: string }> {
    const payload = {
      ...params,
      destinationUrl: params.destinationUrl || `${config.gatewayUrl}/webhook`,
      memo: params.memo || `pay-per-crawl-${Date.now()}`,
    };
    return rpcCall("relayer_send7710Transaction", [payload]);
  }

  /**
   * Fetch the current status of a task.
   */
  async getStatus(taskId: string): Promise<RelayerTask> {
    const result = await rpcCall("relayer_getStatus", [taskId]);
    return {
      taskId,
      status: result.status,
      txHash: result.txHash,
    };
  }

  /**
   * Poll the status until it reaches a final state
   * (confirmed/success/failed/reverted) or the timeout elapses.
   *
   * Used after send7710Transaction to wait for on-chain confirmation.
   */
  async pollStatus(taskId: string, timeoutMs: number): Promise<RelayerTask> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const status = await this.getStatus(taskId);
        if (["confirmed", "success", "failed", "reverted"].includes(status.status)) {
          return status;
        }
      } catch (err) {
        // Network error during poll — log and keep retrying
        console.error(`[relayer] poll error for ${taskId}: ${err instanceof Error ? err.message : err}`);
      }
      // Wait 2 seconds before the next poll to avoid hammering the relayer
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { taskId, status: "timeout" };
  }
}
