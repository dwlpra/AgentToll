/**
 * config.ts — Konfigurasi utama seluruh agent
 *
 * File ini memuat semua konfigurasi yang dibutuhkan agent:
 * - Venice AI API (model, key, URL)
 * - Blockchain (Base Sepolia testnet / Base mainnet)
 * - Wallet addresses (agent = pembayar, provider = penerima)
 * - Payment mode (stub/bridge/live)
 * - 1Shot relayer URL
 *
 * Semua nilai bisa di-override via .env file
 */

import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ESM tidak punya __dirname, jadi kita buat manual dari import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env dari folder agent/, bukan dari CWD.
// Ini penting karena agent bisa dijalankan dari folder manapun.
dotenvConfig({ path: resolve(__dirname, "../.env") });

export const config = {
  // === GATEWAY (x402 paywall server) ===
  // Gateway adalah server yang memproteksi resource di belakang x402 paywall.
  // Ketika agent fetch resource, gateway merespons 402 + info pembayaran.
  gatewayUrl: process.env.GATEWAY_URL || "http://localhost:19090",

  // === VENICE AI (LLM untuk reasoning) ===
  // Venice digunakan sebagai "otak" agent — memutuskan resource mana yang worth dibeli.
  // API-nya OpenAI-compatible, jadi bisa pakai openai SDK.
  veniceApiKey: process.env.VENICE_API_KEY || "",
  veniceBaseUrl: "https://api.venice.ai/api/v1",
  veniceModel: process.env.VENICE_MODEL || "z-ai-glm-5-turbo",

  // === BLOCKCHAIN: Base Sepolia (testnet) ===
  // chainId: 84532 (testnet) / 8453 (mainnet)
  // chainIdHex: format hex untuk 1Shot relayer API
  chainId: 84532,
  chainIdHex: "0x14a34",
  rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",

  // USDC contract address di Base Sepolia
  // (di mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,

  // === WALLET ===
  // Agent wallet: EOA user yang di-upgrade jadi smart account via EIP-7702
  // Wallet ini membayar USDC untuk resource
  agentWallet: process.env.AGENT_WALLET || "0xAGENT_WALLET",

  // Provider wallet: wallet penyedia konten yang MENERIMA pembayaran
  // Ini adalah wallet gateway (content provider)
  providerWallet: process.env.PROVIDER_WALLET || "0xPROVIDER_WALLET",

  // === PAYMENT MODE ===
  // "stub"  = langsung panggil webhook, tanpa blockchain (untuk testing)
  // "bridge" = kirim ke browser, user klik Approve manual (untuk demo interaktif)
  // "live"   = otonom via 1Shot relayer + ERC-7710 (tujuan akhir)
  paymentMode: (process.env.PAYMENT_MODE || "live") as "stub" | "bridge" | "live",

  // Wallet bridge URL — server WebSocket yang menghubungkan CLI agent dengan browser MetaMask
  // Digunakan untuk:
  // 1. Setup: grant permissions (MetaMask popup)
  // 2. Fallback: manual approval jika relayer gagal
  bridgeUrl: process.env.BRIDGE_URL || "http://localhost:3000",

  // === BUDGET ===
  // Budget agent: max $1.00 USDC per session
  // 1 USDC = 1,000,000 units (6 decimals)
  budgetUSD: 1.00,
  budgetUnits: "1000000",

  // Block explorer untuk verifikasi transaksi
  // Testnet: https://sepolia.basescan.org
  // Mainnet: https://basescan.org
  explorerUrl: process.env.EXPLORER_URL || "https://sepolia.basescan.org",

  // === 1SHOT RELAYER ===
  // Relayer yang mengeksekusi transaksi ERC-7710 atas nama user (gasless)
  // .dev = testnet, .com = mainnet
  relayerBaseUrl: process.env.RELAYER_URL || "https://relayer.1shotapi.dev/relayers",
};

/**
 * Helper: buat link explorer untuk sebuah transaction hash.
 * Digunakan di log agent agar user bisa klik dan verifikasi di block explorer.
 */
export function explorerTxLink(txHash: string): string {
  return `${config.explorerUrl}/tx/${txHash}`;
}
