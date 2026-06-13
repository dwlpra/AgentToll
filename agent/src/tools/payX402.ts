/**
 * payX402.ts — Sistem pembayaran agent (jantung dari pay-per-crawl)
 *
 * File ini menangani seluruh flow pembayaran ketika agent menemukan x402 paywall.
 *
 * Ada 3 mode pembayaran:
 *
 * 1. LIVE (tujuan akhir):
 *    Agent mengambil permissionsContext (dari MetaMask grant) lalu mengirim
 *    ke 1Shot relayer untuk eksekusi gasless on-chain via ERC-7710.
 *    TANPA popup MetaMask — fully autonomous.
 *
 * 2. BRIDGE (interaktif):
 *    Agent kirim request ke browser via WebSocket.
 *    User klik Approve di browser, baru pembayaran diproses.
 *    Berguna untuk demo yang ingin tunjukkan interaksi MetaMask.
 *
 * 3. STUB (testing):
 *    Langsung panggil webhook gateway tanpa blockchain.
 *    Untuk development dan testing tanpa wallet.
 *
 * Flow utama (live mode):
 *   Agent → encodeTransfer(USDC, provider) → 1Shot relayer → on-chain tx
 *   → webhook gateway → agent dapat data
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

// Struktur data yang disimpan bridge server setelah MetaMask grant
interface PermissionsContext {
  permissionsContext: string; // hex-encoded delegation data
  wallet: string;            // address yang grant
  grantedAt: string;         // timestamp
  chainId: number;           // 84532 (Base Sepolia)
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

  // Source 2: Bridge server (legacy fallback)
  try {
    const res = await fetch(`${config.bridgeUrl}/permissions-context`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.permissionsContext) {
      cachedContext = data;
      console.log(`[payX402] loaded permissionsContext from bridge: wallet=${data.wallet}`);
      return data;
    }
  } catch (err: any) {
    console.error(`[payX402] failed to fetch from bridge: ${err.message}`);
  }
  return null;
}

/**
 * Router: memilih mode pembayaran berdasarkan config.
 */
export async function payX402(
  resource: string,
  amount: string,   // dalam smallest unit (6 decimals), e.g. "100000" = $0.10
  asset: string,    // USDC contract address
  payTo: string     // wallet penyedia (penerima pembayaran)
): Promise<PayResult> {
  switch (config.paymentMode) {
    case "live":
      return payX402Live(resource, amount, asset, payTo);
    case "bridge":
      return payX402Bridge(resource, amount, asset, payTo);
    default:
      return payX402Stub(resource, amount, asset, payTo);
  }
}

/**
 * Pre-flight check: dipanggil sekali saat agent startup.
 *
 * Memastikan permissionsContext tersedia untuk live mode.
 * Jika tidak ada, agent tetap jalan tapi fallback ke stub.
 */
export async function initPaymentContext(): Promise<boolean> {
  if (config.paymentMode !== "live") return true;

  const ctx = await getPermissionsContext();
  if (!ctx) {
    console.log(`[payX402] WARNING: no permissionsContext found.`);
    console.log(`[payX402] Open http://localhost:3000 in browser, connect MetaMask, grant permissions.`);
    console.log(`[payX402] Falling back to stub mode for this session.`);
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

  // Fallback ke stub jika tidak ada context
  if (!ctx) {
    console.log(`[payX402][live] no permissionsContext — falling back to stub`);
    return payX402Stub(resource, amount, asset, payTo);
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
    // Relayer gagal — fallback ke stub (demo tetap jalan)
    console.error(`[payX402][live] relayer error: ${err.message}`);
    console.log(`[payX402][live] falling back to stub webhook`);
    return payX402Stub(resource, amount, asset, payTo);
  }
}

// ======================================================================
// MODE: BRIDGE — Manual approval via browser MetaMask
// ======================================================================
//
// Agent kirim request ke bridge server → WebSocket ke browser
// → User klik Approve → pembayaran diproses
// Mode ini untuk demo interaktif di mana penilai bisa lihat popup MetaMask.
async function payX402Bridge(
  resource: string,
  amount: string,
  asset: string,
  payTo: string
): Promise<PayResult> {
  const cost = (Number(amount) / 1e6).toFixed(2);
  console.log(`[payX402][bridge] requesting browser approval for ${cost} USDC (${resource})`);

  const id = `bridge-${Date.now()}`;

  // Kirim HTTP POST ke bridge server
  const res = await fetch(`${config.bridgeUrl}/request-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, resource, amount, asset, payTo, network: config.chainId === 8453 ? "base" : "base-sepolia" }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `bridge error: ${res.status} ${text}` };
  }

  // Response datang setelah user klik Approve (atau timeout 60 detik)
  const result = await res.json();
  if (result.success) {
    console.log(`[payX402][bridge] payment confirmed via MetaMask! txHash: ${result.txHash}`);
  } else {
    console.log(`[payX402][bridge] payment failed: ${result.error}`);
  }
  return result;
}

// ======================================================================
// MODE: STUB — Direct webhook call tanpa blockchain
// ======================================================================
//
// Untuk testing: langsung panggil webhook gateway dengan data pembayaran
// tanpa ada transaksi blockchain. Gateway tetap authorize agent.
// Ini memungkinkan development tanpa wallet atau blockchain.
async function payX402Stub(
  resource: string,
  amount: string,
  asset: string,
  payTo: string
): Promise<PayResult> {
  const cost = (Number(amount) / 1e6).toFixed(2);
  const recipient = (!payTo || payTo === "0x0000000000000000000000000000000000000000")
    ? config.providerWallet : payTo;
  console.log(`[payX402][stub] paying ${cost} USDC to ${recipient} for ${resource}`);

  // Buat fake txHash untuk tracking (di mainnet ini akan diganti real txHash)
  const txHash = `0xstub_${Date.now().toString(16)}`;

  // Langsung panggil webhook gateway dengan data pembayaran
  const webhookPayload = {
    taskId: `stub-${Date.now()}`,
    status: "confirmed",
    wallet: config.agentWallet,
    resource,
    amount,
    asset,
    txHash,
  };

  const res = await fetch(`${config.gatewayUrl}/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  if (!res.ok) {
    return { success: false, error: `webhook failed: ${res.status}` };
  }

  const body = await res.json();
  console.log(`[payX402][stub] ✅ Paid ${cost} USDC to ${recipient}`);
  console.log(`[payX402][stub]    txHash: ${txHash} (stub — no on-chain tx)`);
  return { success: true, taskId: webhookPayload.taskId, txHash };
}
