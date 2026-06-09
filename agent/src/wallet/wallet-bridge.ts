/**
 * wallet-bridge.ts — WebSocket bridge antara CLI agent dan browser MetaMask
 *
 * Bridge ini punya 2 peran:
 *
 * 1. SETUP: Menyimpan permissionsContext setelah user grant permissions
 *    - Browser → MetaMask popup → Grant → kirim context via WebSocket
 *    - Bridge simpan ke file .permissions-context.json
 *    - Agent fetch context dari GET /permissions-context
 *
 * 2. FALLBACK: Proxy pembayaran browser-based (bridge mode)
 *    - Agent POST /request-payment → Bridge kirim ke browser via WebSocket
 *    - User klik Approve di browser → Browser kirim response via WebSocket
 *    - Bridge panggil gateway webhook → resolve HTTP promise ke agent
 *
 * Endpoints:
 *   GET  /                      → Browser UI (wallet-bridge.html)
 *   GET  /wallet-bridge-bundle.js → Browser JS bundle
 *   GET  /permissions-context   → Agent ambil stored context (JSON)
 *   POST /request-payment       → Agent minta browser approval
 *   GET  /status                → Status check
 */

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// File tempat menyimpan permissionsContext (persisten antar restart)
const CONTEXT_FILE = resolve(__dirname, ".permissions-context.json");

// === TYPES ===

interface PaymentRequest {
  id: string;
  resource: string;
  amount: string;
  asset: string;
  payTo: string;
  network: string;
}

interface PaymentResponse {
  id: string;
  success: boolean;
  txHash?: string;
  error?: string;
}

// Map dari payment ID → Promise resolver + timeout
// Dipakai untuk mencocokkan request dari agent dengan response dari browser
const pendingRequests = new Map<string, {
  resolve: (resp: PaymentResponse) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

// WebSocket connection ke browser (hanya 1 client)
let browserWs: WebSocket | null = null;

// === PERMISSIONS CONTEXT STORAGE ===
// Disimpan ke file agar survive bridge restart

interface StoredContext {
  permissionsContext: string;  // hex-encoded delegation data dari MetaMask
  wallet: string;              // address yang grant permissions
  grantedAt: string;           // ISO timestamp
  chainId: number;             // chain ID (84532 untuk Base Sepolia)
}

function saveContext(ctx: StoredContext) {
  writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2));
  console.log("[bridge] permissions context saved to", CONTEXT_FILE);
}

function loadContext(): StoredContext | null {
  if (!existsSync(CONTEXT_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONTEXT_FILE, "utf-8"));
  } catch {
    return null;
  }
}

// === HTTP SERVER ===

const server = createServer((req, res) => {
  // Serve browser UI (HTML)
  if (req.url === "/" || req.url === "/index.html") {
    const html = readFileSync(resolve(__dirname, "wallet-bridge.html"), "utf-8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }

  // Serve browser JS bundle (esbuild output)
  if (req.url === "/wallet-bridge-bundle.js") {
    const js = readFileSync(resolve(__dirname, "wallet-bridge-bundle.js"), "utf-8");
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(js);
    return;
  }

  // === KEY ENDPOINT ===
  // Agent CLI fetch context dari sini untuk autonomous payment.
  // Context ini sudah disimpan saat user klik Grant Permissions di browser.
  if (req.url === "/permissions-context" && req.method === "GET") {
    const ctx = loadContext();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ctx || { error: "no context stored" }));
    return;
  }

  // Bridge mode payment: agent kirim request, browser approve
  // (hanya dipakai jika PAYMENT_MODE=bridge)
  if (req.url === "/request-payment" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const payment: PaymentRequest = JSON.parse(body);
      console.log(`[bridge] payment request: ${payment.resource} ${payment.amount} units`);

      // Cek apakah browser terhubung
      if (!browserWs || browserWs.readyState !== WebSocket.OPEN) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: payment.id, success: false, error: "browser not connected" }));
        return;
      }

      // Buat promise yang akan di-resolve saat browser kirim response
      const promise = new Promise<PaymentResponse>((resolve) => {
        // Timeout 60 detik — jika browser tidak merespons, reject
        const timeout = setTimeout(() => {
          pendingRequests.delete(payment.id);
          resolve({ id: payment.id, success: false, error: "timeout waiting for browser" });
        }, 60000);

        pendingRequests.set(payment.id, { resolve, timeout });
      });

      // Forward request ke browser via WebSocket
      browserWs.send(JSON.stringify({ type: "payment_request", ...payment }));

      // Kirim response ke agent saat browser merespons (atau timeout)
      promise.then((resp) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(resp));
      });
    });
    return;
  }

  // Status endpoint — dipakai agent dan debugging
  if (req.url === "/status") {
    const ctx = loadContext();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      browserConnected: browserWs !== null && browserWs.readyState === WebSocket.OPEN,
      pendingRequests: pendingRequests.size,
      permissionsContext: ctx ? { wallet: ctx.wallet, grantedAt: ctx.grantedAt, chainId: ctx.chainId } : null,
    }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// === WEBSOCKET SERVER ===

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("[bridge] browser connected");
  browserWs = ws;

  ws.on("message", async (data) => {
    const msg = JSON.parse(data.toString());

    // === Browser mengkonfirmasi pembayaran (bridge mode) ===
    if (msg.type === "payment_response") {
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingRequests.delete(msg.id);

        // Jika approved, bridge panggil webhook gateway server-side
        // (menghindari CORS issue dari browser)
        if (msg.success) {
          try {
            console.log(`[bridge] calling webhook for ${msg.id}...`);
            const webhookResp = await fetch(`${config.gatewayUrl}/webhook`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId: msg.id,
                status: "confirmed",
                wallet: msg.wallet || config.agentWallet,
                resource: msg.resource,
                amount: msg.amount,
                asset: msg.asset,
                txHash: msg.txHash,
              }),
            });
            const webhookResult = await webhookResp.json();
            console.log(`[bridge] webhook response:`, webhookResult);
          } catch (webhookErr: any) {
            console.error(`[bridge] webhook call failed: ${webhookErr.message}`);
          }
        }

        // Resolve promise → agent CLI mendapat response
        pending.resolve({
          id: msg.id,
          success: msg.success,
          txHash: msg.txHash,
          error: msg.error,
        });
      }
    }

    // === Browser grants permissions — store context ===
    if (msg.type === "permissions_granted") {
      console.log("[bridge] permissions granted:", msg.permissionsContext ? "OK" : "FAILED");
      if (msg.permissionsContext) {
        saveContext({
          permissionsContext: msg.permissionsContext,
          wallet: msg.wallet || "",
          grantedAt: new Date().toISOString(),
          chainId: config.chainId,
        });
      }
    }

    // === Browser revokes permissions — delete stored context ===
    if (msg.type === "permissions_revoked") {
      console.log("[bridge] permissions REVOKED — deleting stored context");
      if (existsSync(CONTEXT_FILE)) {
        unlinkSync(CONTEXT_FILE);
        console.log("[bridge] context file deleted — agent will fall back to stub mode");
      }
    }
  });

  ws.on("close", () => {
    console.log("[bridge] browser disconnected");
    browserWs = null;
  });
});

// === START SERVER ===

const PORT = parseInt(process.env.BRIDGE_PORT || "3000");
server.listen(PORT, () => {
  console.log(`[bridge] wallet bridge running:`);
  console.log(`  Browser UI:     http://localhost:${PORT}`);
  console.log(`  Permissions:    GET http://localhost:${PORT}/permissions-context`);
  console.log(`  Bridge payment: POST http://localhost:${PORT}/request-payment`);
  console.log(`  Status:         GET http://localhost:${PORT}/status`);

  // Cek apakah ada context yang sudah disimpan sebelumnya
  const ctx = loadContext();
  if (ctx) {
    console.log(`[bridge] existing context found: wallet=${ctx.wallet} granted=${ctx.grantedAt}`);
  } else {
    console.log(`[bridge] no stored context — open browser to grant permissions first`);
  }
});
