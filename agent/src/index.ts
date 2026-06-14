/**
 * index.ts — Entry point agent
 *
 * Alur:
 * 1. Validate config & warn about missing values
 * 2. Parse query dari CLI argument
 * 3. Pre-flight check: pastikan permissionsContext ada (untuk live mode)
 * 4. Jalankan agent loop (Venice AI reasoning + payment + data retrieval)
 */

import { runAgent } from "./brain.js";
import { initPaymentContext } from "./tools/payX402.js";
import { config, validateConfig, fetchAgentConfigFromGateway, fetchProviderWalletFromGateway } from "./config.js";
import * as fmt from "./utils/format.js";

// Query from CLI args, or default query about Asian crypto market sentiment
const query = process.argv.slice(2).join(" ") ||
  "Summarize this week's Asian crypto market sentiment, then provide an in-depth analysis.";

async function main() {
  // Startup banner
  console.log(fmt.color("\n  ╔═══════════════════════════════════════════════╗", "\x1b[96m"));
  console.log(fmt.color("  ║        PayCrawl — Pay-Per-Crawl Agent        ║", "\x1b[96m\x1b[1m"));
  console.log(fmt.color("  ║   MetaMask Smart Accounts × Venice AI × 1Shot ║", "\x1b[96m"));
  console.log(fmt.color("  ╚═══════════════════════════════════════════════╝\n", "\x1b[96m"));

  console.log(fmt.infoTag("Query", query));
  console.log(fmt.infoTag("Budget", `$${config.budgetUSD} USDC`));
  console.log(fmt.infoTag("Payment Mode", config.paymentMode));
  console.log(fmt.infoTag("Chain", `Base (${config.chainId})`));
  console.log(fmt.infoTag("Gateway", config.gatewayUrl));

  // Startup validation — warn about missing/invalid config
  const warnings = validateConfig();
  if (warnings.length > 0) {
    console.log(fmt.section("CONFIGURATION WARNINGS"));
    for (const w of warnings) {
      console.log(fmt.configWarning(w));
    }
  }

  // Fetch agent config from gateway (set via React UI)
  const agentCfg = await fetchAgentConfigFromGateway();
  if (agentCfg) {
    if (agentCfg.budgetUSD) {
      config.budgetUSD = agentCfg.budgetUSD;
      config.budgetUnits = String(Math.round(agentCfg.budgetUSD * 1e6));
      console.log(fmt.infoTag("Budget (from UI)", `$${config.budgetUSD} USDC`));
    }
    if (agentCfg.wallet) {
      config.agentWallet = agentCfg.wallet;
      console.log(fmt.infoTag("Agent Wallet (from UI)", config.agentWallet));
    }
  }

  // Fetch provider wallet from gateway (set via MetaMask login)
  const providerWallet = await fetchProviderWalletFromGateway();
  if (providerWallet) {
    config.providerWallet = providerWallet;
    console.log(fmt.infoTag("Provider Wallet (from UI)", config.providerWallet));
  }

  // Pre-flight: cek apakah permissionsContext sudah tersedia
  const ready = await initPaymentContext();
  if (!ready) {
    console.log(fmt.color("\n  ⚠ No permissionsContext — payments will fail until you grant permissions in the UI\n", "\x1b[93m"));
  }

  await runAgent(query);
}

main().catch((err) => {
  console.error(fmt.color(`\n  ✖ FATAL: ${err instanceof Error ? err.message : err}\n`, "\x1b[91m\x1b[1m"));
  process.exit(1);
});
