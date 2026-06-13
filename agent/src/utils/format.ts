/**
 * format.ts — Terminal formatting utilities for impressive demo output
 *
 * Uses ANSI escape codes for colors and formatting.
 * No external dependencies — just raw terminal magic.
 */

// ANSI color codes
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgBlack: "\x1b[40m",
};

/** Brand colors */
export const brand = {
  orange: C.brightYellow,
  blue: C.brightBlue,
  green: C.brightGreen,
  red: C.brightRed,
  cyan: C.brightCyan,
  magenta: C.brightMagenta,
  dim: C.dim,
  bold: C.bold,
  reset: C.reset,
};

// ── Primitives ──────────────────────────────────────────────

export function color(text: string, c: string): string {
  return `${c}${text}${C.reset}`;
}

export function bold(text: string): string {
  return `${C.bold}${text}${C.reset}`;
}

export function dim(text: string): string {
  return `${C.dim}${text}${C.reset}`;
}

// ── Semantic formatters ─────────────────────────────────────

export function header(title: string): string {
  const line = "═".repeat(60);
  return `\n${color(line, C.brightCyan)}\n${color(`  ${title}`, C.brightCyan + C.bold)}\n${color(line, C.brightCyan)}\n`;
}

export function section(title: string): string {
  return `\n${color(`── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`, C.dim)}`;
}

/** Budget meter — visual bar showing budget usage */
export function budgetMeter(spent: number, total: number, width = 30): string {
  const pct = Math.min(spent / total, 1);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const barColor = pct < 0.5 ? C.brightGreen : pct < 0.8 ? C.brightYellow : C.brightRed;
  const remaining = (total - spent).toFixed(2);
  return `${color(bar, barColor)} $${spent.toFixed(2)}/$${total.toFixed(2)} (${color(`$${remaining} left`, C.brightCyan)})`;
}

/** Payment decision — BUY */
export function payDecision(resource: string, cost: string, reason: string): string {
  return `${color("  ✅ BUY", C.brightGreen + C.bold)}  ${color(resource, C.brightCyan)} @ ${color(`$${cost}`, C.brightYellow)}
  ${color(reason, C.dim)}`;
}

/** Payment decision — SKIP */
export function skipDecision(resource: string, reason: string): string {
  return `${color("  ❌ SKIP", C.brightRed + C.bold)} ${color(resource, C.dim)}
  ${color(reason, C.dim)}`;
}

/** Payment confirmed */
export function paymentConfirmed(amount: string, txHash?: string): string {
  let out = `${color("  💰 Payment confirmed", C.brightGreen + C.bold)} — ${color(`$${amount}`, C.brightYellow)}`;
  if (txHash) {
    out += ` ${color(`tx:${txHash.slice(0, 10)}...`, C.dim)}`;
  }
  return out;
}

/** Payment rejected (budget exceeded) */
export function paymentRejected(cost: string, budget: string): string {
  return `${color("  🚫 REJECTED", C.brightRed + C.bold)} — would exceed budget ($${cost} > $${budget})`;
}

/** Resource paywall hit */
export function paywallHit(path: string): string {
  return `${color("  🔒 402 Paywall", C.brightYellow)} — ${color(path, C.brightCyan)}`;
}

/** Resource data retrieved */
export function dataRetrieved(path: string): string {
  return `${color("  📄 Data retrieved", C.brightGreen)} — ${color(path, C.brightCyan)}`;
}

/** Venice reasoning — boxed */
export function reasoningBox(text: string): string {
  const lines = text.split("\n");
  const maxLen = Math.min(Math.max(...lines.map((l) => l.length)), 56);
  const top = `  ┌${"─".repeat(maxLen + 2)}┐`;
  const bot = `  └${"─".repeat(maxLen + 2)}┘`;
  const mid = lines.map((l) => `  │ ${color(l.padEnd(maxLen), C.brightMagenta)} │`);
  return [color(top, C.magenta), ...mid, color(bot, C.magenta)].join("\n");
}

/** Iteration header */
export function iterationHeader(n: number, max: number): string {
  return color(`  ── iteration ${n}/${max} ${"─".repeat(40)}`, C.dim);
}

/** Catalog item line */
export function catalogItem(item: { path: string; priceUSD: number; freshness: string; sources: number; verified: boolean }): string {
  const v = item.verified ? color("✓ verified", C.brightGreen) : color("✗ unverified", C.brightRed);
  return `  ${color(item.path.padEnd(25), C.brightCyan)} ${color(`$${item.priceUSD.toFixed(2)}`, C.brightYellow).padEnd(8)} ${item.freshness.padEnd(12)} ${String(item.sources + " src").padEnd(8)} ${v}`;
}

/** Final answer header */
export function finalAnswerHeader(): string {
  return color(`
  ╔══════════════════════════════════════════════════════════╗
  ║                   FINAL ANSWER                          ║
  ╚══════════════════════════════════════════════════════════╝
`, C.brightCyan + C.bold);
}

/** Summary footer */
export function summaryFooter(spent: number, budget: number, resources: number, skipped: number): string {
  const line = "═".repeat(60);
  return `
${color(line, C.brightCyan)}
  ${color("Budget:", C.bold)}     ${budgetMeter(spent, budget, 20)}
  ${color("Resources:", C.bold)}  ${color(`${resources} purchased`, C.brightGreen)}, ${color(`${skipped} skipped`, C.brightRed)}
${color(line, C.brightCyan)}`;
}

/** Config warning */
export function configWarning(msg: string): string {
  return `${color("  ⚠", C.brightYellow)} ${color(msg, C.yellow)}`;
}

/** Info tag */
export function infoTag(tag: string, value: string): string {
  return `${color(`  ${tag}:`, C.bold)} ${color(value, C.brightCyan)}`;
}

// ── Multi-Agent Phase Formatters ────────────────────────────

/** Agent phase header — shown before each agent starts */
export function agentPhaseHeader(phase: number, icon: string, name: string, subtitle: string): string {
  const line = "═".repeat(60);
  return `\n${color(line, C.brightBlue)}\n  ${color(`${icon}  PHASE ${phase}: ${name}`, C.brightBlue + C.bold)}\n  ${color(subtitle, C.dim)}\n${color(line, C.brightBlue)}\n`;
}

/** Score bar — visual ASCII quality bar */
export function scoreBar(score: number, width = 10): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const barColor = score >= 80 ? C.brightGreen : score >= 50 ? C.brightYellow : C.brightRed;
  return color(bar, barColor);
}

/** Score grade letter from number */
function grade(score: number): string {
  if (score >= 90) return color("A+", C.brightGreen + C.bold);
  if (score >= 80) return color("A", C.brightGreen);
  if (score >= 70) return color("B", C.brightCyan);
  if (score >= 50) return color("C", C.brightYellow);
  if (score >= 30) return color("D", C.brightRed);
  return color("F", C.brightRed + C.bold);
}

/** Recommendation badge */
function recBadge(rec: string): string {
  if (rec === "buy") return color("  BUY  ", C.bgGreen + C.bold + "\x1b[30m");
  if (rec === "skip") return color("  SKIP ", C.bgRed + C.bold + "\x1b[30m");
  return color("CONSIDER", C.bgYellow + C.bold + "\x1b[30m");
}

/** Scout scoring table — formatted box with all resource scores */
export function scoringTable(evals: Array<{
  resource: string; valueScore: number; freshnessScore: number;
  trustScore: number; relevanceScore: number; totalScore: number;
  recommendation: string; reasoning: string;
}>): string {
  const w = 64;
  const top = `╔${"═".repeat(w)}╗`;
  const bot = `╚${"═".repeat(w)}╝`;
  const sep = `╠${"═".repeat(w)}╣`;
  const innerSep = `╟${"─".repeat(w)}╢`;

  const headerRow = `║ ${pad("Resource", 16)}│ ${pad("Value", 5)}│ ${pad("Fresh", 5)}│ ${pad("Trust", 5)}│ ${pad("Relev", 5)}│ ${pad("Total", 5)}│ Verdict ║`;

  const rows = evals.map(e => {
    const name = e.resource.replace("/reports/", "").padEnd(16);
    return `║ ${color(name, C.brightCyan)}│ ${pad(String(e.valueScore), 5)}│ ${pad(String(e.freshnessScore), 5)}│ ${pad(String(e.trustScore), 5)}│ ${pad(String(e.relevanceScore), 5)}│ ${color(String(e.totalScore).padStart(3), e.totalScore >= 70 ? C.brightGreen : e.totalScore >= 50 ? C.brightYellow : C.brightRed)}  │ ${recBadge(e.recommendation)}║`;
  });

  const reasons = evals.map(e =>
    `║ ${color(e.resource.replace("/reports/", ""), C.brightCyan)}: ${color(e.reasoning.slice(0, w - 30), C.dim)}`).join("\n");

  return `\n${color(top, C.brightBlue)}
${color("║", C.brightBlue)} ${color("📊  SCOUT AGENT — Resource Evaluation Scores", C.brightBlue + C.bold)}${" ".repeat(w - 47)}${color("║", C.brightBlue)}
${color(sep, C.brightBlue)}
${color(headerRow, C.bold)}
${color(innerSep, C.brightBlue)}
${rows.join(`\n${color(innerSep, C.brightBlue)}\n`)}
${color(sep, C.brightBlue)}
${reasons}
${color(bot, C.brightBlue)}\n`;
}

/** Quality review table — analyst agent output */
export function qualityReviewTable(reviews: Array<{
  resource: string; accuracyScore: number; depthScore: number;
  actionabilityScore: number; relevanceScore: number; overallScore: number;
  roiAssessment: string; keyInsights: string[]; verdict: string;
}>): string {
  const w = 64;
  const top = `╔${"═".repeat(w)}╗`;
  const bot = `╚${"═".repeat(w)}╝`;
  const sep = `╠${"═".repeat(w)}╣`;

  const blocks = reviews.map(r => {
    const name = r.resource.replace("/reports/", "");
    const lines = [
      `║ ${color(`📄 ${name}`, C.brightCyan + C.bold)}`,
      `║   Accuracy:      ${scoreBar(r.accuracyScore)} ${color(String(r.accuracyScore), C.brightWhite)}/100`,
      `║   Depth:         ${scoreBar(r.depthScore)} ${color(String(r.depthScore), C.brightWhite)}/100`,
      `║   Actionability: ${scoreBar(r.actionabilityScore)} ${color(String(r.actionabilityScore), C.brightWhite)}/100`,
      `║   Relevance:     ${scoreBar(r.relevanceScore)} ${color(String(r.relevanceScore), C.brightWhite)}/100`,
      `║   ${color("Overall:", C.bold)} ${grade(r.overallScore)} ${color(String(r.overallScore) + "/100", C.brightWhite)} — ${color(r.roiAssessment, r.overallScore >= 70 ? C.brightGreen : C.brightYellow)}`,
    ];
    if (r.keyInsights?.length) {
      lines.push(`║   ${color("Key insights:", C.dim)}`);
      r.keyInsights.forEach(i => lines.push(`║     • ${color(i.slice(0, w - 12), C.dim)}`));
    }
    return lines.join("\n");
  });

  return `\n${color(top, C.brightMagenta)}
${color("║", C.brightMagenta)} ${color("🔍  ANALYST AGENT — Content Quality Review", C.brightMagenta + C.bold)}${" ".repeat(w - 46)}${color("║", C.brightMagenta)}
${color(sep, C.brightMagenta)}
${blocks.join(`\n${color(sep, C.brightMagenta)}\n`)}
${color(bot, C.brightMagenta)}\n`;
}

/** Pad helper */
function pad(s: string, len: number): string {
  return s.padEnd(len);
}
