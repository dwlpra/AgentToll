<div align="center">

# AgentToll

### Autonomous Pay-Per-Crawl with MetaMask Smart Accounts

An AI agent that crawls paid data sources, reasons about value vs. cost, pays gasless via ERC-7715/ERC-7710, and synthesizes insights — all without human in the loop.

</div>

---

## How It Works

1. **Setup (once):** User grants ERC-7715 permissions to the agent via MetaMask popup — sets a spending cap ($1.00 USDC/24h)
2. **Crawl:** Agent fetches catalog, encounters x402 paywalls (HTTP 402) on premium content
3. **Reason:** Venice AI evaluates each resource — is it fresh? verified? worth the price?
4. **Pay:** Agent executes gasless USDC transfer via 1Shot relayer using stored permissions — no MetaMask popup needed
5. **Synthesize:** Agent combines purchased data into a comprehensive answer

## Architecture

```mermaid
graph TB
    subgraph Setup["Setup (One-Time)"]
        Browser["Browser<br/>localhost:3000"]
        MM["MetaMask Flask<br/>Smart Accounts Kit"]
        Browser -->|"Grant ERC-7715"| MM
        MM -->|"permissionsContext"| Bridge["Wallet Bridge"]
        Bridge -->|"Store"| Ctx[("context.json")]
    end

    subgraph Execution["Autonomous Execution"]
        Agent["Agent CLI"]
        Agent -->|"GET /resource"| GW["Gateway :19090"]
        GW -->|"402 + accepts[]"| Agent
        Agent -->|"reason"| Venice["Venice AI"]
        Venice -->|"pay / skip"| Agent
        Agent -->|"transfer + context"| Relayer["1Shot Relayer"]
        Relayer -->|"gasless tx"| Chain["Base Sepolia"]
        Agent -->|"webhook"| GW
        GW -->|"proxy"| API["Mock API :18091"]
        GW -->|"data"| Agent
    end

    subgraph Provider["Content Provider View"]
        GW -->|"revenue + history"| Dashboard["Provider Dashboard<br/>/dashboard"]
        Dashboard -->|"tx links"| Explorer["BaseScan"]
    end

    Bridge -.->|"GET /context"| Agent
```

## Payment Flow

```mermaid
sequenceDiagram
    participant A as Agent
    participant G as Gateway
    participant V as Venice AI
    participant R as 1Shot Relayer

    A->>G: GET /reports/asia-daily
    G-->>A: 402 Payment Required + accepts[]

    A->>V: Is this worth $0.10? (fresh, 3 verified sources)
    V-->>A: YES — pay

    Note over A,R: Gasless payment (no popup)
    A->>A: encodeTransfer(USDC, provider, 100000)
    A->>R: send7710Transaction(calldata + permissionsContext)
    R-->>A: txHash confirmed

    A->>G: POST /webhook (confirm payment)
    A->>G: GET /reports/asia-daily (authorized)
    G-->>A: 200 OK + full report
```

## Permission Model

```mermaid
graph LR
    U["User"] -->|"Grant"| MM["MetaMask"]
    MM -->|"Spending cap:<br/>$1.00 USDC / 24h"| Ctx["permissionsContext"]
    Ctx -->|"Stored"| Agent["Agent"]
    Agent -->|"Autonomous<br/>payment"| TX["On-chain TX"]

    U -->|"Revoke anytime"| Revoke["Revoke"]
    Revoke -->|"Deletes context"| Agent
```

## Demo Scenario

| Resource | Price | Quality | Decision | Reasoning |
|---|---|---|---|---|
| Asia Daily | $0.10 | Fresh (4h), 3 verified sources | ✅ Pay | Excellent value — cheap, fresh, multi-source |
| Quick Take | $0.40 | Stale (9 days), 1 unverified | ❌ Skip | Overpriced for stale, unverified data |
| Deep Dive | $0.60 | Fresh (today), 5 verified sources | ✅ Pay | Essential for in-depth analysis |

**Result:** $0.70 / $1.00 budget — agent maximizes data quality, not cheapest price.

## Quick Start

```bash
# 1. Start services (3 terminals)
cd mock-api && go run .          # Data provider on :18091
cd gateway && go run .           # x402 gateway on :19090
cd agent && npx tsx src/wallet/wallet-bridge.ts  # Wallet bridge on :3000

# 2. Setup MetaMask (browser)
#    Open http://localhost:3000 → Connect → Grant Permissions

# 3. Run agent
cd agent && npx tsx src/index.ts
```

## Tech Stack

| Component | Tech | Role |
|---|---|---|
| Gateway | Go | x402 middleware, webhook, provider dashboard |
| Mock API | Go | Paid content endpoints |
| Agent | TypeScript + Venice AI | Reasoning, budget management, synthesis |
| Wallet Bridge | TypeScript + WebSocket | MetaMask connection, context storage |
| Smart Accounts | MetaMask Kit v1.6.0 | ERC-7715 permissions, ERC-7710 delegation |
| Relayer | 1Shot API | Gasless execution via JSON-RPC |
| Chain | Base Sepolia / Base | USDC payments |

## Project Structure

```
├── gateway/                  # Go — x402 gateway + provider dashboard
│   ├── main.go
│   ├── dashboard.go
│   ├── middleware/x402.go
│   ├── payments/store.go
│   └── payments/webhook.go
├── mock-api/                 # Go — paid content data
│   └── main.go
├── agent/                    # TypeScript — AI agent
│   ├── src/brain.ts          # Venice AI agent loop
│   ├── src/tools/payX402.ts  # 3 payment modes: live/bridge/stub
│   ├── src/wallet/erc20.ts   # ERC-20 transfer encoder
│   ├── src/wallet/relayer.ts # 1Shot JSON-RPC client
│   ├── src/wallet/wallet-bridge.ts    # Bridge server
│   ├── src/wallet/wallet-bridge-app.ts # Browser app
│   └── src/wallet/wallet-bridge.html  # Browser UI
└── README.md
```

## License

MIT
