/**
 * relayer.ts — 1Shot Permissionless Relayer client
 *
 * 1Shot relayer adalah service yang mengeksekusi transaksi ERC-7710
 * atas nama user SECARA GASLESS (user tidak bayar gas).
 *
 * Cara kerja:
 * 1. User grant permissions via MetaMask (ERC-7715) → dapat permissionsContext
 * 2. Agent kirim permissionsContext + calldata ke relayer
 * 3. Relayer decode delegation dari context
 * 4. Relayer build & submit transaction ke blockchain
 * 5. Relayer bayar gas (sponsor)
 * 6. Relayer notify webhook saat selesai
 *
 * API: JSON-RPC over HTTP
 * Testnet: https://relayer.1shotapi.dev/relayers
 * Mainnet: https://relayer.1shotapi.com/relayers
 */

import { config } from "../config.js";

// === RESPONSE TYPES ===

// Info tentang chain yang didukung relayer
interface RelayerCapabilities {
  [chainId: string]: {
    feeCollector: string;   // address yang collect fee
    targetAddress: string;  // address kontrak relayer di chain tersebut
    tokens: { address: string; symbol: string; decimals: string }[];
  };
}

// Data biaya dari relayer
interface FeeData {
  gasPrice: string;  // gas price saat ini
  rate: number;      // exchange rate
  minFee: string;    // minimum fee
  expiry: number;    // waktu expiry fee quote
  context: string;   // context untuk transaction
}

// Status task relayer
interface RelayerTask {
  taskId: string;
  status: string;    // "pending" | "confirmed" | "success" | "failed" | "reverted"
  txHash?: string;   // hash transaksi on-chain (tersedia setelah confirmed)
}

// JSON-RPC request ID counter
let rpcId = 0;

/**
 * Generic JSON-RPC call ke 1Shot relayer.
 *
 * 1Shot menggunakan JSON-RPC protocol (sama seperti Ethereum RPC).
 * Setiap call berisi: method name + params, dan mengembalikan result atau error.
 */
async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(config.relayerBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method,
      params,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`1Shot RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data.result;
}

/**
 * OneShotRelayer — Client untuk berinteraksi dengan 1Shot relayer API.
 *
 * Method yang tersedia:
 * - getCapabilities() → info chain & token yang didukung
 * - getFeeData() → biaya dan gas price
 * - send7710Transaction() → kirim transaksi ERC-7710 untuk eksekusi gasless
 * - getStatus() → cek status task
 * - pollStatus() → tunggu sampai confirmed/failed
 */
export class OneShotRelayer {

  /**
   * Cek chain dan token apa saja yang didukung relayer.
   * Berguna untuk debugging dan menemukan targetAddress.
   */
  async getCapabilities(chainIds?: string[]): Promise<RelayerCapabilities> {
    return rpcCall("relayer_getCapabilities", [chainIds || [String(config.chainId)]]);
  }

  /**
   * Ambil data biaya untuk sebuah transaksi.
   * Return fee quote yang valid untuk beberapa saat.
   */
  async getFeeData(chainId: string, tokenAddress: string): Promise<FeeData> {
    return rpcCall("relayer_getFeeData", [{ chainId, tokenAddress }]);
  }

  /**
   * Estimate gas untuk transaksi ERC-7710.
   * Dipakai untuk cek apakah transaksi akan berhasil sebelum submit.
   */
  async estimateTransaction(params: {
    chainId: string;
    from: string;
    to: string;
    data: string;
    value?: string;
    permissionContext: any[];
    authorizationList?: any[];
  }): Promise<any> {
    return rpcCall("relayer_estimate7710Transaction", [params]);
  }

  /**
   * Kirim transaksi ERC-7710 ke relayer untuk eksekusi gasless.
   *
   * Ini adalah method utama — agent memanggil ini untuk membayar resource.
   *
   * Parameter:
   * - chainId: hex format (e.g. "0x14a34")
   * - from: smart account address (wallet agent)
   * - to: USDC contract address
   * - data: encoded transfer calldata
   * - permissionContext: delegation data dari MetaMask grant
   * - context: fee data context dari getFeeData()
   * - destinationUrl: webhook untuk notifikasi konfirmasi
   *
   * Return: taskId untuk tracking status
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
   * Cek status terkini dari sebuah task.
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
   * Poll status sampai final (confirmed/success/failed/reverted)
   * atau sampai timeout.
   *
   * Dipakai setelah send7710Transaction untuk menunggu konfirmasi on-chain.
   */
  async pollStatus(taskId: string, timeoutMs: number): Promise<RelayerTask> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getStatus(taskId);
      if (["confirmed", "success", "failed", "reverted"].includes(status.status)) {
        return status;
      }
      // Tunggu 2 detik sebelum poll lagi (jangan spam relayer)
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { taskId, status: "timeout" };
  }
}
