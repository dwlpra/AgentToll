import OpenAI from "openai";
import { config } from "./config.js";
import { fetchCatalog, fetchResource, fetchWithPayment } from "./tools/fetchResource.js";
import { payX402 } from "./tools/payX402.js";

const venice = new OpenAI({
  apiKey: config.veniceApiKey,
  baseURL: config.veniceBaseUrl,
});

const AGENT_WALLET = config.agentWallet;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "fetchResource",
      description: "Fetch a resource from the gateway. Returns 402 with payment info if not yet paid, or the resource data if authorized.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Resource path, e.g. /reports/asia-daily" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "payInvoice",
      description: "Pay for a resource using x402 protocol. Costs USDC. Only pay if the resource is worth the price based on freshness, source quality, and relevance.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Resource path" },
          amount: { type: "string", description: "Amount in USDC units (6 decimals)" },
          asset: { type: "string", description: "USDC contract address" },
          payTo: { type: "string", description: "Gateway wallet address" },
          reason: { type: "string", description: "Why you decided to pay or skip" },
        },
        required: ["path", "amount", "asset", "payTo", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "Provide the final synthesized answer to the user's query.",
      parameters: {
        type: "object",
        properties: {
          answer: { type: "string", description: "The final synthesized answer based on all gathered data" },
        },
        required: ["answer"],
      },
    },
  },
];

function getSystemPrompt(catalog: any[], totalSpent: number): string {
  return `You are an autonomous research agent. Your job is to fulfill the user's research request by purchasing and synthesizing paid data resources.

AVAILABLE RESOURCES (from catalog):
${catalog.map((c: any) => `- ${c.path}: $${c.priceUSD} | ${c.freshness} | ${c.sources} sources | verified=${c.verified} | ${c.summary}`).join("\n")}

BUDGET: $${config.budgetUSD} USDC total. You have spent $${totalSpent.toFixed(2)} so far. Remaining: $${(config.budgetUSD - totalSpent).toFixed(2)}.

DECISION RULES:
1. First use fetchResource to check each resource. It will return 402 with payment info if not yet paid.
2. Compare price vs value: freshness, source count, verification status, relevance to query.
3. You may SKIP resources that are not worth their price (stale, unverified, overpriced).
4. To buy a resource, call payInvoice — the data is automatically retrieved after successful payment (included in the payInvoice result). Do NOT call fetchResource again after paying.
5. Synthesize all gathered data into a comprehensive answer using the finish tool.
6. Call finish with your final answer when done.

IMPORTANT: After payInvoice succeeds, the resource data is returned in the payment result. Do NOT fetch the same resource again.`;
}

export async function runAgent(userQuery: string): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`USER QUERY: ${userQuery}`);
  console.log(`BUDGET: $${config.budgetUSD} USDC`);
  console.log(`${"=".repeat(60)}\n`);

  console.log("[agent] fetching catalog...");
  const catalog = await fetchCatalog();
  console.log(`[agent] catalog: ${catalog.length} resources available\n`);

  let totalSpent = 0;
  const gatheredData: any[] = [];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: getSystemPrompt(catalog, totalSpent) },
    { role: "user", content: userQuery },
  ];

  let keepGoing = true;
  let iterations = 0;
  const maxIterations = 15;

  while (keepGoing && iterations < maxIterations) {
    iterations++;
    console.log(`\n--- iteration ${iterations} ---`);

    // Update system prompt with fresh budget before each call
    messages[0] = { role: "system", content: getSystemPrompt(catalog, totalSpent) };

    const completion = await venice.chat.completions.create({
      model: config.veniceModel,
      messages,
      tools,
      tool_choice: "auto",
    });

    const choice = completion.choices[0];
    const msg = choice.message;
    messages.push(msg);

    if (msg.content) {
      console.log(`[venice] ${msg.content}`);
    }

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      console.log("[agent] no tool calls — agent done");
      break;
    }

    for (const toolCall of msg.tool_calls) {
      let args: any;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "invalid JSON arguments" }),
        });
        continue;
      }

      switch (toolCall.function.name) {
        case "fetchResource": {
          console.log(`[tool] fetchResource(${args.path})`);
          const result = await fetchResource(args.path);
          console.log(`[tool] -> status ${result.status}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });

          if (result.status === 200 && result.data) {
            gatheredData.push(result.data);
            console.log(`[agent] gathered data from ${args.path}`);
          }
          break;
        }

        case "payInvoice": {
          const cost = Number(args.amount) / 1_000_000;
          if (totalSpent + cost > config.budgetUSD) {
            console.log(`[tool] REJECTED: would exceed budget ($${(totalSpent + cost).toFixed(2)} > $${config.budgetUSD})`);
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: false, error: "exceeds budget" }),
            });
            break;
          }

          console.log(`[tool] payInvoice: $${cost.toFixed(2)} for ${args.path}`);
          console.log(`[reasoning] ${args.reason}`);

          const payResult = await payX402(args.path, args.amount, args.asset, args.payTo);

          if (payResult.success) {
            totalSpent += cost;
            console.log(`[agent] paid $${cost.toFixed(2)} | total: $${totalSpent.toFixed(2)}`);

            const retryResult = await fetchWithPayment(args.path, AGENT_WALLET);
            if (retryResult.status === 200 && retryResult.data) {
              gatheredData.push(retryResult.data);
              console.log(`[agent] retrieved data from ${args.path}`);
            }

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                ...payResult,
                resourceData: retryResult.data || null,
                totalSpent: totalSpent.toFixed(2),
                budgetRemaining: (config.budgetUSD - totalSpent).toFixed(2),
              }),
            });
          } else {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(payResult),
            });
          }
          break;
        }

        case "finish": {
          console.log(`\n${"=".repeat(60)}`);
          console.log(`FINAL ANSWER:\n`);
          console.log(args.answer);
          console.log(`\n${"=".repeat(60)}`);
          console.log(`Total spent: $${totalSpent.toFixed(2)} / $${config.budgetUSD}`);
          console.log(`Resources gathered: ${gatheredData.length}`);
          keepGoing = false;
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ delivered: true }),
          });
          break;
        }

        default:
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: "unknown tool" }),
          });
      }
    }
  }
}
