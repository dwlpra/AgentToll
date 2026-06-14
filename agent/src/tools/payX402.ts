/**
 * payX402.ts — Agent payment system (the core of pay-per-crawl)
 *
 * Handles the full payment flow when the agent encounters an x402 paywall.
 * All payments execute on-chain (Base mainnet).
 *
 * Flow:
 *   React UI grants permissions → gateway stores the context
 *   → Agent → encodeTransfer(USDC, provider) → 1Shot relayer → on-chain tx
 *   → gateway webhook → agent receives the data
 *
 * No MetaMask popup occurs during payment — fully autonomous via ERC-7710.
 */

import { config, explorerTxLink } from "../config.js";
import { OneShotRelayer } from "../wallet/relayer.js";
import { encodeTransfer } from "../wallet/erc20.js";

// === TYPES ===

interface PayResult {
  success: boolean;
  taskId?: string;
  txHash?: string;
  error?: string;
}

// PermissionsContext structure (stored in the gateway via the React UI after the MetaMask grant)
interface PermissionsContext {
  permissionsContext: string; // hex-encoded delegation data
  wallet: string;            // address that granted the permission
  grantedAt: string;         // timestamp
  chainId: number;           // 8453 (Base) or 84532 (Base Sepolia)
}

// Cache to avoid fetching the context repeatedly
let cachedContext: PermissionsContext | null = null;

/**
 * Fetch the permissionsContext from the gateway API (set via the React UI).
 *
 * The permissionsContext is the data MetaMask returns when the user clicks
 * "Grant Permissions". It contains the delegation structure that authorizes
 * the 1Shot relayer to execute transactions on the user's behalf (ERC-7710).
 *
 * The context is persisted by the gateway's AgentConfigManager via
 * POST /api/agent-config.
 */
async function getPermissionsContext(): Promise<PermissionsContext | null> {
  if (cachedContext) return cachedContext;

  try {
    const res = await fetch(`${config.gatewayUrl}/api/agent-config`);
    if (res.ok) {
      const data = await res.json();
      if (data.permissionsContext && data.status !== "none") {
        cachedContext = {
          permissionsContext: data.permissionsContext,
          wallet: data.wallet,
          grantedAt: new Date().toISOString(),
          chainId: config.chainId,
        };
        console.log(`[payX402] loaded permissionsContext from gateway: wallet=${data.wallet}`);
        return cachedContext;
      }
    }
  } catch (err: any) {
    console.error(`[payX402] failed to fetch from gateway: ${err.message}`);
  }
  return null;
}

/**
 * Router: execute the payment on-chain via the 1Shot relayer (live mode).
 */
export async function payX402(
  resource: string,
  amount: string,   // smallest unit (6 decimals), e.g. "100000" = $0.10
  asset: string,    // USDC contract address
  payTo: string     // provider wallet (the payment recipient)
): Promise<PayResult> {
  return payX402Live(resource, amount, asset, payTo);
}

/**
 * Pre-flight check: invoked once at agent startup.
 *
 * Verifies that a permissionsContext is available. When absent the agent still
 * runs, but every payment attempt will fail.
 */
export async function initPaymentContext(): Promise<boolean> {
  const ctx = await getPermissionsContext();
  if (!ctx) {
    console.log(`[payX402] WARNING: no permissionsContext found.`);
    console.log(`[payX402] Open http://localhost:5173, connect MetaMask, and grant permissions.`);
    return false;
  }

  console.log(`[payX402] live mode ready — agent will pay autonomously via 1Shot relayer`);
  return true;
}

// ======================================================================
// LIVE MODE — Autonomous gasless payment via 1Shot relayer + ERC-7710
// ======================================================================
//
// This mode realizes the hackathon vision:
// 1. The agent encodes calldata: USDC transfer from the smart account → provider
// 2. It submits the calldata + permissionsContext to the 1Shot relayer
// 3. The relayer executes the transaction GASLESSLY on-chain (user pays no gas)
// 4. The relayer confirms via a webhook to the gateway
// 5. The gateway authorizes the agent to access the resource
//
// On relayer failure the payment is reported as failed.
async function payX402Live(
  resource: string,
  amount: string,
  asset: string,
  payTo: string
): Promise<PayResult> {
  const cost = (Number(amount) / 1e6).toFixed(2);
  console.log(`[payX402][live] autonomous payment: ${cost} USDC to ${payTo} for ${resource}`);

  const ctx = await getPermissionsContext();

  // No permissionsContext — the payment cannot be executed
  if (!ctx) {
    console.log(`[payX402][live] no permissionsContext — payment cannot proceed`);
    return { success: false, error: "no permissionsContext — grant permissions in the UI first" };
  }

  try {
    const relayer = new OneShotRelayer();

    // 1Shot expects chainId in hex format (e.g. "0x14a34", not "84532")
    const chainId = config.chainIdHex;

    // Step 1: fetch fee data from the relayer (the sponsored gas cost)
    const feeData = await relayer.getFeeData(chainId, asset);
    console.log(`[payX402][live] fee: ${feeData.minFee} min, rate: ${feeData.rate}`);

    // Step 2: resolve the recipient — if the gateway didn't set a wallet, use providerWallet
    const recipient = (!payTo || payTo === "0x0000000000000000000000000000000000000000")
      ? config.providerWallet : payTo;

    // Step 3: encode the calldata for the USDC transfer
    // This produces the bytes that invoke transfer(recipient, amount)
    const transferData = encodeTransfer(
      recipient as `0x${string}`,
      BigInt(amount)
    );
    console.log(`[payX402][live] encoded transfer: ${transferData.slice(0, 20)}...`);

    // Step 4: parse the permissionsContext from the MetaMask Smart Accounts Kit.
    // The context carries delegation data that includes the EIP-7702 authorization.
    // When the user grants permissions via MetaMask (ERC-7715), the EOA is upgraded
    // to a smart account (EIP-7702). The delegation structure inside the context
    // authorizes the relayer to execute ERC-7710 calls.
    let permissionContext: any[];
    try {
      permissionContext = JSON.parse(ctx.permissionsContext);
    } catch {
      // If the context is a raw hex string, wrap it in an array
      permissionContext = [ctx.permissionsContext];
    }

    // EIP-7702: extract the authorization list from the context when present.
    // The MetaMask Smart Accounts Kit encodes the 7702 authorization inside the
    // permissionsContext. The 1Shot relayer needs it to upgrade the EOA → smart
    // account on-chain.
    let authorizationList: any[] | undefined;
    if (Array.isArray(permissionContext)) {
      for (const pc of permissionContext) {
        if (pc && typeof pc === "object" && pc.authorization) {
          authorizationList = Array.isArray(pc.authorization)
            ? pc.authorization
            : [pc.authorization];
          console.log(`[payX402][live] found EIP-7702 authorization in permissionsContext`);
          break;
        }
      }
    }

    // Step 5: submit to the 1Shot relayer for gasless execution via ERC-7710.
    // The relayer will:
    //   a. Decode the delegation from the permissionsContext (incl. EIP-7702 auth)
    //   b. Build the transaction with our calldata
    //   c. Execute it on-chain with the user paying no gas (sponsored)
    //   d. Notify the gateway webhook when complete
    const result = await relayer.send7710Transaction({
      chainId,
      from: config.agentWallet,     // smart account address (upgraded via EIP-7702)
      to: asset,                     // USDC contract address
      data: transferData,            // encoded transfer(recipient, amount)
      permissionContext,             // delegation from the MetaMask grant (ERC-7715 + EIP-7702)
      authorizationList,             // EIP-7702 authorization tuples (if extracted)
      context: feeData.context,      // fee-data context from the relayer
      destinationUrl: `${config.gatewayUrl}/webhook`, // webhook for confirmation
      memo: `pay-per-crawl: ${resource}`,
    });

    console.log(`[payX402][live] relayer task: ${result.taskId}`);

    // Step 6: poll the status until confirmed or failed
    if (result.taskId) {
      console.log(`[payX402][live] waiting for on-chain confirmation...`);
      const finalStatus = await relayer.pollStatus(result.taskId, 30000);
      const ok = finalStatus.status === "confirmed" || finalStatus.status === "success";

      if (ok && finalStatus.txHash) {
        console.log(`[payX402][live] ✅ Paid ${cost} USDC to ${recipient}`);
        console.log(`[payX402][live]    txHash: ${finalStatus.txHash}`);
        console.log(`[payX402][live]    Explorer: ${explorerTxLink(finalStatus.txHash)}`);
      }

      return {
        success: ok,
        taskId: finalStatus.taskId,
        txHash: finalStatus.txHash,
        error: !ok ? `status: ${finalStatus.status}` : undefined,
      };
    }

    return { success: false, error: "no taskId from relayer" };
  } catch (err: any) {
    console.error(`[payX402][live] relayer error: ${err.message}`);
    return { success: false, error: `relayer error: ${err.message}` };
  }
}
