/**
 * brain.ts — Multi-Agent Venice AI Pipeline
 *
 * 4-phase architecture, each phase is a separate Venice AI agent:
 *
 *   Phase 1: Scout Agent 🧭     — Evaluates & scores catalog resources
 *   Phase 2: Buyer Agent 💰      — Purchases based on scout scores
 *   Phase 3: Analyst Agent 🔬    — Reviews purchased content quality
 *   Phase 4: Synthesis Agent ✍️  — Composes final comprehensive report
 *
 * Venice AI is called 4 separate times with different system prompts and tools.
 * This demonstrates Venice as a versatile multi-role reasoning engine —
 * not just a chatbot, but a pipeline of specialized agents.
 */

import OpenAI from "openai";
import { config } from "./config.js";
import { fetchCatalog, fetchResource, fetchWithPayment } from "./tools/fetchResource.js";
import { payX402 } from "./tools/payX402.js";
import * as fmt from "./utils/format.js";

const venice = new OpenAI({
  apiKey: config.veniceApiKey,
  baseURL: config.veniceBaseUrl,
});

const AGENT_WALLET = config.agentWallet;

// === TYPES ===

interface ScoutEvaluation {
  resource: string;
  valueScore: number;
  freshnessScore: number;
  trustScore: number;
  relevanceScore: number;
  totalScore: number;
  recommendation: "buy" | "skip" | "consider";
  reasoning: string;
}

interface QualityReview {
  resource: string;
  accuracyScore: number;
  depthScore: number;
  actionabilityScore: number;
  relevanceScore: number;
  overallScore: number;
  roiAssessment: string;
  keyInsights: string[];
  verdict: string;
}

interface PurchasedResource {
  path: string;
  data: any;
}

// === TOOL DEFINITIONS (different per agent) ===

const scoutTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "submitEvaluation",
      description: "Submit your evaluation scores for ALL catalog resources. Score each resource on value, freshness, trust, and relevance.",
      parameters: {
        type: "object",
        properties: {
          evaluations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                resource: { type: "string", description: "Resource path e.g. /reports/asia-daily" },
                valueScore: { type: "number", description: "Value for money 0-100" },
                freshnessScore: { type: "number", description: "Data freshness 0-100" },
                trustScore: { type: "number", description: "Source reliability 0-100" },
                relevanceScore: { type: "number", description: "Relevance to user query 0-100" },
                totalScore: { type: "number", description: "Weighted overall score 0-100" },
                recommendation: { type: "string", enum: ["buy", "skip", "consider"] },
                reasoning: { type: "string", description: "Brief explanation of your scoring" },
              },
              required: ["resource", "valueScore", "freshnessScore", "trustScore", "relevanceScore", "totalScore", "recommendation", "reasoning"],
            },
          },
        },
        required: ["evaluations"],
      },
    },
  },
];

const buyerTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "fetchResource",
      description: "Fetch a resource. Returns 402 with payment info if not paid, or 200 with data if authorized.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Resource path" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "payInvoice",
      description: "Pay for a resource using x402. Only pay if worth the price based on scout scores.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          amount: { type: "string", description: "USDC units (6 decimals)" },
          asset: { type: "string", description: "USDC contract address" },
          payTo: { type: "string", description: "Gateway wallet" },
          reason: { type: "string", description: "Why you decided to pay" },
        },
        required: ["path", "amount", "asset", "payTo", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skipResource",
      description: "Skip a resource that is not worth buying.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          reason: { type: "string" },
        },
        required: ["path", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finishBuying",
      description: "Signal that all purchase decisions have been made.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const analystTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "submitReview",
      description: "Submit your quality review for ALL purchased resources.",
      parameters: {
        type: "object",
        properties: {
          reviews: {
            type: "array",
            items: {
              type: "object",
              properties: {
                resource: { type: "string" },
                accuracyScore: { type: "number", description: "Data accuracy 0-100" },
                depthScore: { type: "number", description: "Analysis depth 0-100" },
                actionabilityScore: { type: "number", description: "Actionability 0-100" },
                relevanceScore: { type: "number", description: "Relevance to query 0-100" },
                overallScore: { type: "number", description: "Overall quality 0-100" },
                roiAssessment: { type: "string", description: "e.g. EXCELLENT VALUE, OVERPRICED, FAIR DEAL" },
                keyInsights: { type: "array", items: { type: "string" }, description: "Top 2-3 insights" },
                verdict: { type: "string", description: "One-line verdict" },
              },
              required: ["resource", "accuracyScore", "depthScore", "actionabilityScore", "relevanceScore", "overallScore", "roiAssessment", "keyInsights", "verdict"],
            },
          },
        },
        required: ["reviews"],
      },
    },
  },
];

const synthesisTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "finish",
      description: "Provide the final synthesized answer.",
      parameters: {
        type: "object",
        properties: { answer: { type: "string", description: "Comprehensive final report" } },
        required: ["answer"],
      },
    },
  },
];

// === SYSTEM PROMPTS ===

function getScoutPrompt(catalog: any[], userQuery: string): string {
  return `You are a Data Scout Agent powered by Venice AI. Your job is to evaluate paid data resources and score them on multiple dimensions.

USER QUERY: "${userQuery}"

AVAILABLE RESOURCES:
${catalog.map((c: any) => `- ${c.path}: $${c.priceUSD} | freshness: ${c.freshness} | ${c.sources} sources | verified=${c.verified} | confidence=${c.confidence || "N/A"} | ${c.summary}`).join("\n")}

BUDGET: $${config.budgetUSD} USDC total.

SCORING GUIDE (be strict — average data gets 50-60, only exceptional gets 80+):
- VALUE (0-100): Price vs quality ratio. $0.10 for 3 verified sources = 90+. $0.40 for 1 stale unverified source = 20-30.
- FRESHNESS (0-100): "today" or "4h ago" = 90+. "9 days ago" = 10-20.
- TRUST (0-100): Verified + multiple sources = 80+. Unverified single source = 20-40.
- RELEVANCE (0-100): How directly useful for the user's specific query?
- TOTAL (0-100): Weighted average emphasizing value and relevance.

Use submitEvaluation to score ALL resources at once.`;
}

function getBuyerPrompt(catalog: any[], scores: ScoutEvaluation[], totalSpent: number): string {
  return `You are an Acquisition Agent powered by Venice AI. Purchase data resources based on scout evaluation scores.

SCOUT EVALUATION RESULTS:
${scores.map(s => `- ${s.resource}: ${s.totalScore}/100 → ${s.recommendation.toUpperCase()} — ${s.reasoning}`).join("\n")}

BUDGET: $${config.budgetUSD} USDC total. Spent: $${totalSpent.toFixed(2)}. Remaining: $${(config.budgetUSD - totalSpent).toFixed(2)}.

RULES:
1. Buy resources recommended "buy" (score >= 70)
2. Skip resources recommended "skip" (score < 50)
3. For "consider" (50-69): buy only if budget allows and relevance is high
4. Use fetchResource to check paywall, then payInvoice to pay
5. Use skipResource to formally skip resources
6. Always explain your reasoning: show cost-value analysis like "$X for Y sources = $Z/source"
7. Call finishBuying when all decisions are made`;
}

function getAnalystPrompt(purchased: PurchasedResource[], scoutScores: ScoutEvaluation[], prices: Record<string, number>): string {
  return `You are a Content Analyst Agent powered by Venice AI. Review the actual quality of purchased data and assess ROI.

PURCHASED RESOURCES:
${purchased.map((p, i) => {
  const scout = scoutScores.find(s => s.resource === p.path);
  const price = prices[p.path] || 0;
  return `
--- ${p.path} (paid $${price.toFixed(2)}, scout predicted: ${scout?.totalScore || "?"}/100) ---
${JSON.stringify(p.data, null, 2).slice(0, 3000)}`;
}).join("\n")}

Review each resource:
- ACCURACY (0-100): Is the data factual, well-sourced, internally consistent?
- DEPTH (0-100): How thorough and comprehensive?
- ACTIONABILITY (0-100): Can the user act on these insights?
- RELEVANCE (0-100): How relevant to the original query?
- OVERALL (0-100): Weighted quality score

Also assess ROI: Was the data worth what was paid?
Use submitReview to submit your reviews for ALL resources.`;
}

function getSynthesisPrompt(userQuery: string, purchased: PurchasedResource[], scoutScores: ScoutEvaluation[], reviews: QualityReview[]): string {
  return `You are a Senior Research Synthesizer powered by Venice AI. Compose a comprehensive final report.

USER QUERY: "${userQuery}"

SCOUT PRE-PURCHASE EVALUATIONS:
${scoutScores.map(s => `- ${s.resource}: ${s.totalScore}/100 (${s.recommendation}) — ${s.reasoning}`).join("\n")}

ANALYST QUALITY REVIEWS:
${reviews.map(r => `- ${r.resource}: Quality ${r.overallScore}/100 — ${r.roiAssessment}
  Insights: ${r.keyInsights.join("; ")}
  Verdict: ${r.verdict}`).join("\n")}

PURCHASED DATA:
${purchased.map(p => JSON.stringify(p.data, null, 2).slice(0, 4000)).join("\n---\n")}

Compose a detailed research report that:
1. Directly answers the user's query with specific data points and metrics
2. Cites numbers from the purchased resources
3. Highlights key insights flagged by the analyst
4. Notes data quality assessments and ROI
5. Provides actionable recommendations

Use the finish tool to deliver your final report.`;
}

// === VENICE AI CALL HELPER ===

async function callVenice(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools: OpenAI.Chat.Completions.ChatCompletionTool[],
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await venice.chat.completions.create({ model: config.veniceModel, messages, tools, tool_choice: "auto" });
    } catch (err) {
      console.error(fmt.color(`  ⚠ Venice API error: ${err instanceof Error ? err.message : err}`, "\x1b[93m"));
      if (attempt < 2) {
        console.error(fmt.dim("  Retrying in 3 seconds..."));
        await new Promise(r => setTimeout(r, 3000));
      } else throw err;
    }
  }
  throw new Error("Venice API failed after 3 attempts");
}

// === MAIN AGENT RUNNER ===

export async function runAgent(userQuery: string): Promise<void> {
  console.log(fmt.header(`🤖  PayCrawl — Multi-Agent Venice AI Pipeline`));
  console.log(fmt.infoTag("Query", userQuery));
  console.log(fmt.infoTag("Budget", `$${config.budgetUSD} USDC`));
  console.log(fmt.infoTag("Mode", config.paymentMode));
  console.log(fmt.budgetMeter(0, config.budgetUSD));

  // ── Fetch Catalog ──────────────────────────────────────────
  console.log(fmt.section("FETCHING CATALOG"));
  let catalog: any[];
  try {
    catalog = await fetchCatalog();
  } catch (err) {
    console.error(fmt.color(`  ✖ FATAL: ${err instanceof Error ? err.message : err}`, "\x1b[91m\x1b[1m"));
    return;
  }
  if (!catalog || catalog.length === 0) {
    console.error(fmt.color("  ✖ FATAL: catalog is empty", "\x1b[91m\x1b[1m"));
    return;
  }
  console.log(fmt.dim(`  Found ${catalog.length} resources:\n`));
  for (const item of catalog) console.log(fmt.catalogItem(item));

  // Price lookup for later
  const prices: Record<string, number> = {};
  for (const item of catalog) prices[item.path] = item.priceUSD;

  // ══════════════════════════════════════════════════════════════
  // PHASE 1: SCOUT AGENT — Evaluate & score all resources
  // ══════════════════════════════════════════════════════════════
  console.log(fmt.agentPhaseHeader(1, "🧭", "SCOUT AGENT", "Evaluating resource value, freshness, trust & relevance..."));

  let scoutScores: ScoutEvaluation[] = [];
  try {
    const completion = await callVenice(
      [
        { role: "system", content: getScoutPrompt(catalog, userQuery) },
        { role: "user", content: `Evaluate all ${catalog.length} resources for: "${userQuery}"` },
      ],
      scoutTools,
    );

    const msg = completion.choices[0].message;
    if (msg.content) console.log(fmt.reasoningBox(msg.content));

    if (msg.tool_calls?.[0]) {
      const args = JSON.parse(msg.tool_calls[0].function.arguments);
      scoutScores = args.evaluations || [];
    }
  } catch (err) {
    console.error(fmt.color(`  ⚠ Scout failed: ${err instanceof Error ? err.message : err}`, "\x1b[93m"));
    console.log(fmt.dim("  Proceeding without scout scores..."));
  }

  if (scoutScores.length > 0) {
    console.log(fmt.scoringTable(scoutScores));
  }

  // ══════════════════════════════════════════════════════════════
  // PHASE 2: BUYER AGENT — Purchase based on scout scores
  // ══════════════════════════════════════════════════════════════
  console.log(fmt.agentPhaseHeader(2, "💰", "BUYER AGENT", "Making purchase decisions based on scout scores..."));

  let totalSpent = 0;
  let skippedCount = 0;
  const gatheredData: PurchasedResource[] = [];

  const buyerMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: getBuyerPrompt(catalog, scoutScores, totalSpent) },
    { role: "user", content: userQuery },
  ];

  let keepBuying = true;
  let buyerIter = 0;

  while (keepBuying && buyerIter < 10) {
    buyerIter++;
    buyerMessages[0] = { role: "system", content: getBuyerPrompt(catalog, scoutScores, totalSpent) };

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await callVenice(buyerMessages, buyerTools);
    } catch {
      break;
    }

    const msg = completion.choices[0].message;
    buyerMessages.push(msg);

    if (msg.content) console.log(fmt.reasoningBox(msg.content));
    if (!msg.tool_calls?.length) break;

    for (const tc of msg.tool_calls) {
      let args: any;
      try { args = JSON.parse(tc.function.arguments); } catch { continue; }

      switch (tc.function.name) {
        case "fetchResource": {
          console.log(fmt.paywallHit(args.path));
          const result = await fetchResource(args.path);
          if (result.status === 402) console.log(fmt.dim("  → 402 Payment Required"));
          else if (result.status === 200) {
            console.log(fmt.dataRetrieved(args.path));
            gatheredData.push({ path: args.path, data: result.data });
          }
          buyerMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          break;
        }

        case "payInvoice": {
          const cost = Number(args.amount) / 1_000_000;
          if (totalSpent + cost > config.budgetUSD) {
            buyerMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, error: "exceeds budget" }) });
            skippedCount++;
            break;
          }
          console.log(fmt.payDecision(args.path, cost.toFixed(2), args.reason));
          const payResult = await payX402(args.path, args.amount, args.asset, args.payTo);
          if (payResult.success) {
            totalSpent += cost;
            console.log(fmt.paymentConfirmed(cost.toFixed(2), payResult.txHash));
            const retryResult = await fetchWithPayment(args.path, AGENT_WALLET);
            if (retryResult.status === 200 && retryResult.data) {
              gatheredData.push({ path: args.path, data: retryResult.data });
              console.log(fmt.dataRetrieved(args.path));
            }
            console.log(fmt.dim(`  Budget: ${fmt.budgetMeter(totalSpent, config.budgetUSD, 20)}`));
            buyerMessages.push({
              role: "tool", tool_call_id: tc.id,
              content: JSON.stringify({ ...payResult, resourceData: retryResult.data, totalSpent: totalSpent.toFixed(2), budgetRemaining: (config.budgetUSD - totalSpent).toFixed(2) }),
            });
          } else {
            console.log(fmt.color(`  ✖ Payment failed: ${payResult.error}`, "\x1b[91m"));
            buyerMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(payResult) });
          }
          break;
        }

        case "skipResource": {
          console.log(fmt.skipDecision(args.path, args.reason));
          skippedCount++;
          buyerMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ skipped: true }) });
          break;
        }

        case "finishBuying": {
          keepBuying = false;
          buyerMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ done: true }) });
          break;
        }

        default:
          buyerMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "unknown tool" }) });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PHASE 3: ANALYST AGENT — Review purchased content quality
  // ══════════════════════════════════════════════════════════════
  let qualityReviews: QualityReview[] = [];

  if (gatheredData.length > 0) {
    console.log(fmt.agentPhaseHeader(3, "🔬", "ANALYST AGENT", "Reviewing content quality & assessing ROI..."));

    try {
      const completion = await callVenice(
        [
          { role: "system", content: getAnalystPrompt(gatheredData, scoutScores, prices) },
          { role: "user", content: `Review quality of ${gatheredData.length} purchased resources.` },
        ],
        analystTools,
      );

      const msg = completion.choices[0].message;
      if (msg.content) console.log(fmt.reasoningBox(msg.content));

      if (msg.tool_calls?.[0]) {
        const args = JSON.parse(msg.tool_calls[0].function.arguments);
        qualityReviews = args.reviews || [];
      }
    } catch (err) {
      console.error(fmt.color(`  ⚠ Analyst failed: ${err instanceof Error ? err.message : err}`, "\x1b[93m"));
    }

    if (qualityReviews.length > 0) {
      console.log(fmt.qualityReviewTable(qualityReviews));
    }
  } else {
    console.log(fmt.dim("\n  No resources purchased — skipping analyst phase."));
  }

  // ══════════════════════════════════════════════════════════════
  // PHASE 4: SYNTHESIS AGENT — Final comprehensive report
  // ══════════════════════════════════════════════════════════════
  console.log(fmt.agentPhaseHeader(4, "✍️", "SYNTHESIS AGENT", "Composing final comprehensive report..."));

  try {
    const completion = await callVenice(
      [
        { role: "system", content: getSynthesisPrompt(userQuery, gatheredData, scoutScores, qualityReviews) },
        { role: "user", content: userQuery },
      ],
      synthesisTools,
    );

    const msg = completion.choices[0].message;
    if (msg.content) console.log(fmt.reasoningBox(msg.content));

    if (msg.tool_calls?.[0]) {
      const args = JSON.parse(msg.tool_calls[0].function.arguments);
      console.log(fmt.finalAnswerHeader());
      console.log(args.answer);
    }
  } catch (err) {
    console.error(fmt.color(`  ⚠ Synthesis failed: ${err instanceof Error ? err.message : err}`, "\x1b[93m"));
  }

  console.log(fmt.summaryFooter(totalSpent, config.budgetUSD, gatheredData.length, skippedCount));
}
