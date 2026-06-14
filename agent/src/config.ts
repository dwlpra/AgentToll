/**
 * config.ts — Konfigurasi utama seluruh agent
 *
 * File ini memuat semua konfigurasi yang dibutuhkan agent:
 * - Venice AI API (model, key, URL)
 * - Blockchain (Base Sepolia testnet / Base mainnet)
 * - Wallet addresses (agent = pembayar, provider = penerima)
 * - Payment mode (stub/live)
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

  // === BLOCKCHAIN ===
  // Base Mainnet: chainId=8453, chainIdHex=0x2105 (DEFAULT)
  // Base Sepolia (testnet): chainId=84532, chainIdHex=0x14a34
  // Override via CHAIN_ID env var: "8453" (mainnet) or "84532" (testnet)
  chainId: Number(process.env.CHAIN_ID) || 8453,
  chainIdHex: Number(process.env.CHAIN_ID) === 84532 ? "0x14a34" : "0x2105",
  rpcUrl: process.env.RPC_URL || (Number(process.env.CHAIN_ID) === 84532 ? "https://sepolia.base.org" : "https://mainnet.base.org"),

  // USDC contract address
  // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  usdcAddress: (Number(process.env.CHAIN_ID) === 84532
    ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,

  // === WALLET ===
  // Agent wallet: EOA user yang di-upgrade jadi smart account via EIP-7702
  // Wallet ini membayar USDC untuk resource
  agentWallet: process.env.AGENT_WALLET || "0xAGENT_WALLET",

  // Provider wallet: wallet penyedia konten yang MENERIMA pembayaran
  // Ini adalah wallet gateway (content provider)
  providerWallet: process.env.PROVIDER_WALLET || "0xPROVIDER_WALLET",

  // === PAYMENT MODE ===
  // "live" = otonom via 1Shot relayer + ERC-7710 (mode tunggal — real on-chain)
  paymentMode: (process.env.PAYMENT_MODE || "live") as "live",

  // === BUDGET ===
  // Budget agent: fetched from gateway API (set via React UI)
  // Falls back to env var or $1.00 default
  budgetUSD: Number(process.env.BUDGET_USD) || 1.00,
  budgetUnits: String(Math.round((Number(process.env.BUDGET_USD) || 1.00) * 1e6)),

  // Block explorer untuk verifikasi transaksi
  // Testnet: https://sepolia.basescan.org
  // Mainnet: https://basescan.org
  explorerUrl: process.env.EXPLORER_URL || "https://basescan.org",

  // === 1SHOT RELAYER ===
  // Relayer yang mengeksekusi transaksi ERC-7710 atas nama user (gasless)
  // .com = mainnet (DEFAULT), .dev = testnet
  relayerBaseUrl: process.env.RELAYER_URL || "https://relayer.1shotapi.com/relayers",
};

/**
 * Fetch agent config from gateway API (set via React UI).
 * Returns partial overrides for budget, expiry, and permissionsContext.
 */
export async function fetchAgentConfigFromGateway(): Promise<{
  budgetUSD?: number;
  expiry?: number;
  permissionsContext?: string;
  wallet?: string;
} | null> {
  try {
    const res = await fetch(`${config.gatewayUrl}/api/agent-config`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.status !== "none") {
      return {
        budgetUSD: data.budget || undefined,
        expiry: data.expiry || undefined,
        permissionsContext: data.permissionsContext || undefined,
        wallet: data.wallet || undefined,
      };
    }
  } catch {
    // Gateway not running or endpoint not available
  }
  return null;
}

/**
 * Fetch provider wallet from gateway API (set dynamically via MetaMask login).
 * This replaces the hardcoded PROVIDER_WALLET from .env.
 */
export async function fetchProviderWalletFromGateway(): Promise<string | null> {
  try {
    const res = await fetch(`${config.gatewayUrl}/api/provider-config`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.wallet && data.wallet !== "0x0000000000000000000000000000000000000000") {
      return data.wallet;
    }
  } catch {
    // Gateway not running or endpoint not available
  }
  return null;
}

/**
 * Helper: buat link explorer untuk sebuah transaction hash.
 * Digunakan di log agent agar user bisa klik dan verifikasi di block explorer.
 */
export function explorerTxLink(txHash: string): string {
  return `${config.explorerUrl}/tx/${txHash}`;
}

/**
 * Validate critical config values at startup.
 * Returns warnings array — empty if all good.
 */
export function validateConfig(): string[] {
  const warnings: string[] = [];

  if (!config.veniceApiKey) {
    warnings.push("VENICE_API_KEY not set — agent will use mock brain (no AI reasoning)");
  }

  if (config.agentWallet === "0xAGENT_WALLET") {
    warnings.push("AGENT_WALLET not set — using placeholder, payments will fail");
  }

  if (config.providerWallet === "0xPROVIDER_WALLET") {
    warnings.push("PROVIDER_WALLET not set — using placeholder, payments will go to invalid address");
  }

  const validModes = ["live"];
  if (!validModes.includes(config.paymentMode)) {
    warnings.push(`PAYMENT_MODE="${config.paymentMode}" is invalid — must be live`);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(config.usdcAddress)) {
    warnings.push(`USDC address "${config.usdcAddress}" is not a valid Ethereum address`);
  }

  return warnings;
}
