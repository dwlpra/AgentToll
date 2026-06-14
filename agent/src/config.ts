/**
 * config.ts — Central agent configuration
 *
 * Holds all configuration required by the agent:
 * - Venice AI API (model, key, base URL)
 * - Blockchain (Base mainnet / Base Sepolia)
 * - Wallet addresses (agent = payer, provider = payee)
 * - Payment mode (live — on-chain execution)
 * - 1Shot relayer endpoint
 *
 * Every value can be overridden through the .env file.
 */

import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ESM has no __dirname; derive it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Always load .env from the agent/ directory regardless of the current
// working directory, so the agent can be launched from anywhere.
dotenvConfig({ path: resolve(__dirname, "../.env") });

export const config = {
  // === GATEWAY (x402 paywall server) ===
  // The gateway protects resources behind an x402 paywall. When the agent
  // requests a resource it responds with 402 plus the payment requirements.
  gatewayUrl: process.env.GATEWAY_URL || "http://localhost:19090",

  // === VENICE AI (reasoning LLM) ===
  // Venice is the agent's "brain": it decides which resources are worth buying.
  // The API is OpenAI-compatible, so the openai SDK is used directly.
  veniceApiKey: process.env.VENICE_API_KEY || "",
  veniceBaseUrl: "https://api.venice.ai/api/v1",
  veniceModel: process.env.VENICE_MODEL || "zai-org-glm-5",

  // === BLOCKCHAIN ===
  // Base Mainnet: chainId=8453, chainIdHex=0x2105 (DEFAULT)
  // Base Sepolia (testnet): chainId=84532, chainIdHex=0x14a34
  // Override via CHAIN_ID: "8453" (mainnet) or "84532" (testnet)
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
  // Agent wallet: the EOA upgraded to a smart account via EIP-7702.
  // This wallet pays USDC for resources.
  agentWallet: process.env.AGENT_WALLET || "0xAGENT_WALLET",

  // Provider wallet: the content provider that RECEIVES payments.
  // This is the gateway's wallet (content provider side).
  providerWallet: process.env.PROVIDER_WALLET || "0xPROVIDER_WALLET",

  // === PAYMENT MODE ===
  // "live" = autonomous execution via the 1Shot relayer + ERC-7710 (single mode).
  paymentMode: (process.env.PAYMENT_MODE || "live") as "live",

  // === BUDGET ===
  // Agent budget: fetched from the gateway API (configured via the React UI).
  // Falls back to the env var or a $1.00 default.
  budgetUSD: Number(process.env.BUDGET_USD) || 1.00,
  budgetUnits: String(Math.round((Number(process.env.BUDGET_USD) || 1.00) * 1e6)),

  // Block explorer for transaction verification.
  // Testnet: https://sepolia.basescan.org
  // Mainnet: https://basescan.org
  explorerUrl: process.env.EXPLORER_URL || "https://basescan.org",

  // === 1SHOT RELAYER ===
  // Executes ERC-7710 transactions on the user's behalf (gasless).
  // .com = mainnet (DEFAULT), .dev = testnet
  relayerBaseUrl: process.env.RELAYER_URL || "https://relayer.1shotapi.com/relayers",
};

/**
 * Fetch agent config from the gateway API (configured via the React UI).
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
 * Fetch the provider wallet from the gateway API (set dynamically via MetaMask login).
 * Replaces the hardcoded PROVIDER_WALLET from .env.
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
 * Build a block-explorer link for a transaction hash.
 * Used in agent logs so the user can click through and verify the transaction.
 */
export function explorerTxLink(txHash: string): string {
  return `${config.explorerUrl}/tx/${txHash}`;
}

/**
 * Validate critical config values at startup.
 * Returns a warnings array — empty when everything is configured correctly.
 */
export function validateConfig(): string[] {
  const warnings: string[] = [];

  if (!config.veniceApiKey) {
    warnings.push("VENICE_API_KEY not set — Venice AI calls will fail (agent cannot reason without it)");
  }

  if (config.agentWallet === "0xAGENT_WALLET") {
    warnings.push("AGENT_WALLET not set — using placeholder, payments will fail");
  }

  if (config.providerWallet === "0xPROVIDER_WALLET") {
    warnings.push("PROVIDER_WALLET not set — using placeholder, payments will go to an invalid address");
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
