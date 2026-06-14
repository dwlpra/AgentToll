/**
 * payX402.ts — Sistem pembayaran agent (jantung dari pay-per-crawl)
 *
 * File ini menangani seluruh flow pembayaran ketika agent menemukan x402 paywall.
 * Pembayaran selalu REAL on-chain (Base mainnet) — tidak ada mode simulasi.
 *
 * Flow:
 *   React UI grant permissions → gateway stores context
 *   → Agent → encodeTransfer(USDC, provider) → 1Shot relayer → on-chain tx
 *   → webhook gateway → agent dapat data
 *
 * Tidak ada popup MetaMask saat pembayaran — fully autonomous via ERC-7710.
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

// Struktur data permissionsContext (disimpan di gateway via React UI setelah MetaMask grant)
interface PermissionsContext {
  permissionsContext: string; // hex-encoded delegation data
  wallet: string;            // address yang grant
  grantedAt: string;         // timestamp
  chainId: number;           // 8453 (Base) atau 84532 (Base Sepolia)
}

// Cache agar tidak fetch berulang kali
let cachedContext: PermissionsContext | null = null;

/**
 * Fetch permissionsContext dari gateway API (set via React UI).
 *
 * PermissionsContext ini adalah data yang MetaMask berikan saat user
 * klik "Grant Permissions". Isinya adalah delegation structure yang
 * memberi izin ke 1Shot relayer untuk mengeksekusi transaksi
 * atas nama user (ERC-7710).
 *
 * Context disimpan di gateway's AgentConfigManager via POST /api/agent-config.
 */
async function getPermissionsContext(): Promise<PermissionsContext | null> {
  if (cachedContext) return cachedContext;

  // Source 1: Gateway API (set via React UI MetaMask connection)
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
 * Router: eksekusi pembayaran on-chain via 1Shot relayer (mode tunggal — live).
 */
export async function payX402(
  resource: string,
  amount: string,   // dalam smallest unit (6 decimals), e.g. "100000" = $0.10
  asset: string,    // USDC contract address
  payTo: string     // wallet penyedia (penerima pembayaran)
): Promise<PayResult> {
  return payX402Live(resource, amount, asset, payTo);
}

/**
 * Pre-flight check: dipanggil sekali saat agent startup.
 *
 * Memastikan permissionsContext tersedia. Jika tidak ada, agent tetap jalan
 * tapi setiap pembayaran akan gagal (tidak ada fallback simulasi).
 */
export async function initPaymentContext(): Promise<boolean> {
  const ctx = await getPermissionsContext();
  if (!ctx) {
    console.log(`[payX402] WARNING: no permissionsContext found.`);
    console.log(`[payX402] Open http://localhost:5173, connect MetaMask, grant permissions.`);
    return false;
  }

  console.log(`[payX402] live mode ready — agent will pay autonomously via 1Shot relayer`);
  return true;
}

// ======================================================================
// MODE: LIVE — Autonomous gasless payment via 1Shot relayer + ERC-7710
// ======================================================================
//
// Ini adalah mode yang sesuai dengan visi hackathon:
// 1. Agent encode calldata: USDC transfer dari smart account → provider
// 2. Kirim ke 1Shot relayer dengan permissionsContext
// 3. Relayer eksekusi GASLESS on-chain (user tidak bayar gas)
// 4. Relayer konfirmasi via webhook ke gateway
// 5. Gateway authorize agent untuk akses resource
//
// Jika relayer gagal (testnet issue, dll), otomatis fallback ke stub.
async function payX402Live(
  resource: string,
  amount: string,
  asset: string,
  payTo: string
): Promise<PayResult> {
  const cost = (Number(amount) / 1e6).toFixed(2);
  console.log(`[payX402][live] autonomous payment: ${cost} USDC to ${payTo} for ${resource}`);

  const ctx = await getPermissionsContext();

  // Tidak ada permissionsContext — pembayaran tidak bisa dieksekusi (gagal jujur, tidak ada simulasi)
  if (!ctx) {
    console.log(`[payX402][live] no permissionsContext — payment cannot proceed`);
    return { success: false, error: "no permissionsContext — grant permissions in the UI first" };
  }

  try {
    const relayer = new OneShotRelayer();

    // 1Shot butuh chainId dalam format hex (e.g. "0x14a34" bukan "84532")
    const chainId = config.chainIdHex;

    // Step 1: Ambil fee data dari relayer (biaya gas yang di-sponsor)
    const feeData = await relayer.getFeeData(chainId, asset);
    console.log(`[payX402][live] fee: ${feeData.minFee} min, rate: ${feeData.rate}`);

    // Step 2: Resolve recipient — jika gateway tidak set wallet, pakai providerWallet dari config
    const recipient = (!payTo || payTo === "0x0000000000000000000000000000000000000000")
      ? config.providerWallet : payTo;

    // Step 3: Encode calldata untuk USDC transfer
    // Ini menghasilkan bytes yang memanggil transfer(recipient, amount)
    const transferData = encodeTransfer(
      recipient as `0x${string}`,
      BigInt(amount)
    );
    console.log(`[payX402][live] encoded transfer: ${transferData.slice(0, 20)}...`);

    // Step 4: Parse permissionsContext dari MetaMask Smart Accounts Kit
    // Context ini mengandung delegation data yang TERMASUK EIP-7702 authorization.
    // Saat user grant permissions via MetaMask (ERC-7715), EOA di-upgrade jadi smart account (EIP-7702).
    // Delegation structure di dalam context memberi izin ke relayer untuk eksekusi ERC-7710.
    let permissionContext: any[];
    try {
      permissionContext = JSON.parse(ctx.permissionsContext);
    } catch {
      // Jika context adalah hex string mentah, bungkus dalam array
      permissionContext = [ctx.permissionsContext];
    }

    // EIP-7702: extract authorization list dari context jika tersedia.
    // MetaMask Smart Accounts Kit meng-encode 7702 authorization di dalam permissionsContext.
    // 1Shot relayer membutuhkan ini untuk meng-upgrade EOA → smart account on-chain.
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

    // Step 5: Kirim ke 1Shot relayer untuk eksekusi gasless via ERC-7710
    // Relayer akan:
    //   a. Decode delegation dari permissionsContext (termasuk EIP-7702 auth)
    //   b. Build transaction dengan calldata kita
    //   c. Eksekusi on-chain tanpa user bayar gas (gasless via sponsor)
    //   d. Notify webhook gateway saat selesai
    const result = await relayer.send7710Transaction({
      chainId,
      from: config.agentWallet,     // smart account address (upgraded via EIP-7702)
      to: asset,                     // USDC contract address
      data: transferData,            // encoded transfer(recipient, amount)
      permissionContext,             // delegation dari MetaMask grant (ERC-7715 + EIP-7702)
      authorizationList,             // EIP-7702 authorization tuples (if extracted)
      context: feeData.context,      // fee data context from relayer
      destinationUrl: `${config.gatewayUrl}/webhook`, // webhook untuk konfirmasi
      memo: `pay-per-crawl: ${resource}`,
    });

    console.log(`[payX402][live] relayer task: ${result.taskId}`);

    // Step 6: Poll status sampai confirmed/failed
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
    // Relayer gagal — gagal jujur (tidak ada simulasi pembayaran)
    console.error(`[payX402][live] relayer error: ${err.message}`);
    return { success: false, error: `relayer error: ${err.message}` };
  }
}
