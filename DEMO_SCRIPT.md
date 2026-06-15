# PayCrawl — Demo Video Script (4:00)

> **4 tracks:** Best x402+ERC7710, Best Venice AI, Best Agent, Best 1Shot Relayer
> **Voice over:** AI narrator (English, ~140 wpm)
> **Total:** MAX 4 minutes. Every second counts.

---

## PREP BEFORE RECORDING

- [ ] pm2: paycrawl-gw, paycrawl-ui running
- [ ] MetaMask Flask on Base mainnet, ≥$2 USDC
- [ ] Revoke existing permissions (fresh popup for demo)
- [ ] Screen record 1920×1080, no DevTools
- [ ] BaseScan tab ready
- [ ] Test crawl once before recording (warm Venice API)
- [ ] Terminal font large enough

---

## SECTION 1 — HOOK (0:00–0:18)

**VISUAL:** Dark screen, text types in:

> *"AI agents can reason, code, and analyze —*
> *but the moment they hit a paywall, they stop."*

**NARRATION (~35 words, 15s):**
> "AI agents are powerful — but they hit a wall the moment they meet a paywall. They stop, wait for a human to approve a ten-cent payment. Every single time. That breaks autonomous AI."

---

## SECTION 2 — SOLUTION (0:18–0:45)

**VISUAL:** PayCrawl logo. Animated flow:

```
Agent hits 402 paywall
  → Venice AI: "Is this worth $0.10?"
  → Pays gasless (no popup)
  → Synthesizes report
```

**NARRATION (~60 words, 27s):**
> "Meet PayCrawl. An AI agent that crawls paid data sources, reasons about value versus cost using Venice AI, and pays gasless via MetaMask Smart Accounts. One popup to grant a spending cap. After that — the agent decides what's worth buying, pays on-chain on Base, and synthesizes insights. No human in the loop."

---

## SECTION 3 — LIVE: PERMISSION GRANT (0:45–1:25)

**VISUAL:** Browser → `localhost:5173` → Agent page

**ACTION:** Click "Grant Permissions". MetaMask popup appears.

**NARRATION (~70 words, 30s):**
> "I open the dashboard and connect MetaMask on Base mainnet. I set a budget — one USDC per day — and click Grant Permissions. This is the MetaMask Smart Accounts Kit in action — requesting an ERC-7715 advanced permission. A fine-grained spending cap. This is the only popup the user ever sees. I approve — and the agent is now authorized to spend autonomously."

**⚠️ CRITICAL:** MetaMask popup must be clearly visible. This is the qualification moment.

---

## SECTION 4 — LIVE: AUTONOMOUS CRAWL (1:25–2:55)

**VISUAL:** Terminal output streaming in UI.

**ACTION:** Start crawl: "Asian crypto market sentiment this week"

**NARRATION (~130 words, 70s):**
> "Now I start the crawl. The agent fetches a catalog — three paid reports with different prices and quality.
>
> Phase one — the Scout. Venice AI scores every resource on value, freshness, trust, and relevance. Asia Daily: score 92, buy. Quick Take: score 22, skip — stale and overpriced. Deep Dive: score 91, buy — five verified sources.
>
> Phase two — the Buyer. Based on scout scores, the agent executes. It hits the 402 paywall, encodes a USDC transfer, and sends it to the 1Shot Permissionless Relayer — which executes it gasless on Base. No second popup. No gas. Watch — payment confirmed, with a real transaction hash.
>
> It paid for two reports, skipped one, and stayed within budget."

**VISUAL HIGHLIGHTS:**
- Scout scoring table (BUY / SKIP verdicts)
- `[payX402][live]` lines — zoom if needed
- Budget meter: $0.10 → $0.70
- 🔗 BaseScan link appears in terminal

---

## SECTION 5 — PROOF + RESULT (2:55–3:40)

**VISUAL:** Click BaseScan link → opens real tx on basescan.org

**NARRATION (~55 words, 25s):**
> "A real on-chain transaction on BaseScan. A genuine USDC transfer, executed gasless via the 1Shot relayer. This is not a mock — this is real money moving between an AI agent and a content provider, on Base mainnet."

**VISUAL:** Back to UI → synthesized report card (markdown rendered) → Provider Dashboard showing revenue + purchase history with tx links.

**NARRATION (~30 words, 13s):**
> "Venice AI synthesizes both reports into a comprehensive analysis. And the provider dashboard shows real revenue — with every purchase linking to BaseScan."

---

## SECTION 6 — CLOSE (3:40–4:00)

**VISUAL:** Summary card:

```
PayCrawl
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MetaMask Smart Accounts Kit (ERC-7715 + EIP-7702)
✅ Venice AI 4-phase pipeline (Scout → Buyer → Analyst → Synthesis)
✅ 1Shot Relayer gasless payments (ERC-7710)
✅ x402 HTTP-native paywall protocol
✅ Real on-chain transactions on Base mainnet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
github.com/dwlpra/PayCrawl
```

**NARRATION (~30 words, 13s):**
> "PayCrawl — where AI agents become autonomous economic actors. One popup. Then agents pay for what they need, on their own. That's the agent economy — today."

---

## TIMING SUMMARY

| Section | Duration | Cumulative |
|---------|----------|------------|
| 1. Hook | 0:18 | 0:18 |
| 2. Solution | 0:27 | 0:45 |
| 3. Permission Grant | 0:40 | 1:25 |
| 4. Autonomous Crawl | 1:30 | 2:55 |
| 5. Proof + Result | 0:45 | 3:40 |
| 6. Close | 0:20 | 4:00 |
| **Total** | **4:00** | |

---

## 🎯 TECH JUDGES LOOK FOR

| Tech | When it appears | Required? |
|------|-----------------|-----------|
| MetaMask Smart Accounts Kit | ERC-7715 popup (Section 3) | ✅ YES |
| ERC-7715 Advanced Permissions | "$1/day spending cap" in popup | ✅ YES |
| 1Shot Relayer (gasless) | `[payX402][live]` lines (Section 4) | ✅ YES |
| Venice AI reasoning | Scout scoring table (Section 4) | ✅ YES |
| x402 protocol | 402 + accepts[] in terminal | ✅ YES |
| On-chain tx (BaseScan) | Real tx on basescan.org (Section 5) | ✅ YES |
