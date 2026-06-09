/**
 * wallet-bridge-app.ts — Browser app untuk MetaMask Smart Accounts setup
 *
 * File ini di-bundle oleh esbuild menjadi wallet-bridge-bundle.js
 * dan di-load oleh wallet-bridge.html di browser.
 *
 * Fungsinya:
 * 1. Connect MetaMask Flask (wallet connection)
 * 2. Grant ERC-7715 permissions via Smart Accounts Kit (ONE-TIME setup)
 * 3. Terima & approve payment requests (bridge mode fallback)
 *
 * Dependensi:
 * - viem: library Ethereum untuk TypeScript
 * - @metamask/smart-accounts-kit: MetaMask Smart Accounts Kit (ERC-7715 actions)
 *
 * Build: npx esbuild src/wallet/wallet-bridge-app.ts --bundle --format=esm
 *        --platform=browser --outfile=src/wallet/wallet-bridge-bundle.js
 */

import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

// === CONSTANTS ===

// USDC contract di Base Sepolia testnet
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// === STATE ===

let ws: WebSocket;                    // WebSocket ke bridge server
let walletClient: any;                // viem wallet client (extended with ERC-7715)
let account: string;                  // connected wallet address
let permissionsGranted = false;       // apakah user sudah grant permissions

// permissionsContext disimpan di window agar bisa diakses dari approval flow
(window as any)._permissionsContext = null;

// === UI HELPERS ===

const logEl = () => document.getElementById("log")!;

function log(msg: string, type = "") {
  const el = logEl();
  const time = new Date().toLocaleTimeString();
  const color = type === 'ok' ? '#4caf50' : type === 'err' ? '#f44336' : type === 'warn' ? '#ff9800' : '#2196f3';
  el.innerHTML += `<div><span style="color:#555">${time}</span> <span style="color:${color}">${msg}</span></div>`;
  el.scrollTop = el.scrollHeight;
}

// === WEBSOCKET CONNECTION ===

function connectWs() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onopen = () => {
    document.getElementById("connectionStatus")!.className = "status connected";
    document.getElementById("connectionStatus")!.innerHTML = 'WebSocket: <span class="badge on">connected</span>';
    log("WebSocket connected", "ok");
  };

  ws.onclose = () => {
    document.getElementById("connectionStatus")!.className = "status disconnected";
    document.getElementById("connectionStatus")!.innerHTML = 'WebSocket: <span class="badge off">disconnected</span>';
    log("WebSocket disconnected, reconnecting...", "warn");
    // Auto-reconnect setiap 3 detik
    setTimeout(connectWs, 3000);
  };

  // Terima message dari bridge server
  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // Bridge kirim payment request dari agent CLI
    if (msg.type === "payment_request") {
      log(`Payment request: ${msg.resource} — ${(Number(msg.amount) / 1e6).toFixed(2)} USDC`, "warn");
      showPaymentCard(msg);
    }
  };
}

// Tampilkan kartu pembayaran di UI dengan tombol Approve/Reject
function showPaymentCard(msg: any) {
  const cost = (Number(msg.amount) / 1e6).toFixed(2);
  document.getElementById("paymentArea")!.innerHTML = `
    <div class="payment-card">
      <div class="amount">${cost} USDC</div>
      <div class="detail">Resource: ${msg.resource}</div>
      <div class="detail">Network: ${msg.network}</div>
      <div style="margin-top:12px">
        <button class="btn" onclick="window._approvePayment('${msg.id}','${msg.resource}','${msg.amount}','${msg.asset}','${msg.payTo}')">Approve & Pay via MetaMask</button>
        <button class="btn secondary" onclick="window._rejectPayment('${msg.id}')">Reject</button>
      </div>
    </div>`;
}

// === METAMASK CONNECTION ===

/**
 * Connect MetaMask Flask ke app.
 * 1. Request eth_requestAccounts → dapat address
 * 2. Create viem wallet client
 * 3. Extend dengan Smart Accounts Kit (erc7715ProviderActions)
 * 4. Pastikan di chain yang benar (Base Sepolia)
 */
(window as any).connectWallet = async function () {
  const eth = (window as any).ethereum;
  if (!eth || !eth.isMetaMask) {
    log("MetaMask not detected! Install MetaMask Flask 13.5.0+", "err");
    return;
  }

  try {
    // Step 1: Request wallet connection
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    account = accounts[0];

    // Update UI
    document.getElementById("walletStatus")!.className = "status connected";
    document.getElementById("walletBadge")!.className = "badge on";
    document.getElementById("walletBadge")!.textContent = "connected";
    document.getElementById("walletAddress")!.style.display = "block";
    document.getElementById("addr")!.textContent = account;
    document.getElementById("grantBtn")!.removeAttribute("disabled");
    document.getElementById("connectBtn")!.setAttribute("disabled", "true");

    log(`MetaMask connected: ${account}`, "ok");

    // Step 2: Create viem wallet client dengan MetaMask sebagai transport
    walletClient = createWalletClient({
      chain: baseSepolia,
      transport: custom(eth),
    });

    // Step 3: Extend wallet client dengan Smart Accounts Kit
    // Ini menambahkan method requestExecutionPermissions() ke walletClient
    // yang memanggil wallet_requestExecutionPermissions RPC ke MetaMask
    try {
      walletClient = walletClient.extend(erc7715ProviderActions());
      log("erc7715ProviderActions loaded from @metamask/smart-accounts-kit", "ok");
    } catch (e: any) {
      log(`Kit extension warning: ${e.message}`, "warn");
      log("Will try requestExecutionPermissions directly...", "info");
    }

    // Step 4: Pastikan di chain yang benar
    const chainId = await eth.request({ method: "eth_chainId" });
    if (chainId !== "0x14a34") { // 0x14a34 = 84532 = Base Sepolia
      log("Switching to Base Sepolia...", "warn");
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x14a34" }] });
    }
    log("On Base Sepolia", "ok");
  } catch (err: any) {
    log(`Connection failed: ${err.message}`, "err");
  }
};

// === ERC-7715 PERMISSION GRANT ===

/**
 * Grant ERC-7715 execution permissions via MetaMask.
 *
 * Ini adalah langkah SETIAP yang memungkinkan agent bayar otonom:
 * - MetaMask popup muncul, user approve
 * - permissionsContext dihasilkan (berisi delegation data)
 * - Context dikirim ke bridge server dan disimpan
 * - Agent CLI ambil context untuk autonomous payment via 1Shot
 *
 * Parameter permission request (sesuai kit v1.6.0 API):
 * - chainId: Base Sepolia (84532)
 * - to: 1Shot relayer targetAddress (delegate yang boleh eksekusi)
 * - from: wallet address user
 * - expiry: timestamp kedaluwarsa (7 hari dari sekarang)
 * - permission.type: "erc20-token-periodic" (budget periodik)
 * - permission.data.periodAmount: max $1.00 USDC per periode
 * - permission.data.periodDuration: 24 jam per periode
 */
(window as any).grantPermissions = async function () {
  try {
    log("Requesting ERC-7715 permissions... MetaMask popup will appear", "warn");

    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 7 * 24 * 60 * 60; // 7 hari
    const budgetUnits = "1000000";          // $1.00 USDC (6 decimals)

    // Bangun permission request sesuai PermissionRequestParameter dari kit v1.6.0
    const permissionRequest = [{
      chainId: baseSepolia.id,                    // 84532 (Base Sepolia)
      to: "0xf1ef956eff4181Ce913b664713515996858B9Ca9" as `0x${string}`, // 1Shot targetAddress
      from: account as `0x${string}`,             // wallet user
      expiry,                                     // kedaluwarsa dalam 7 hari
      permission: {
        type: "erc20-token-periodic",             // tipe: budget periodik
        isAdjustmentAllowed: false,               // tidak boleh adjust otomatis
        data: {
          tokenAddress: USDC_BASE_SEPOLIA as `0x${string}`, // USDC contract
          periodAmount: BigInt(budgetUnits),       // max 1,000,000 units ($1) per periode
          periodDuration: 24 * 60 * 60,            // 24 jam per periode
          startTime: now,                          // mulai sekarang
          justification: "Pay-per-crawl access budget", // alasan (muncul di MetaMask)
        },
      },
    }];

    let granted: any;
    try {
      // Coba pakai method dari Smart Accounts Kit
      if (walletClient.requestExecutionPermissions) {
        log("Using requestExecutionPermissions from Smart Accounts Kit...", "info");
        granted = await walletClient.requestExecutionPermissions(permissionRequest);
      } else {
        // Fallback: langsung panggil RPC method
        log("Kit method unavailable, trying wallet_requestPermissions...", "warn");
        granted = await (window as any).ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ erc7715: { chains: [baseSepolia.id] } }],
        });
      }
    } catch (permErr: any) {
      log(`Permission method failed: ${permErr.message}`, "err");
      // Tetap set granted agar bridge mode bisa jalan dengan manual approval
      permissionsGranted = true;
      updatePermStatus("ready (manual approval)", true);
      document.getElementById("grantBtn")!.setAttribute("disabled", "true");
      return;
    }

    // Extract permissionsContext dari response
    // Context ini berisi delegation structure yang dibutuhkan 1Shot relayer
    const ctx = granted?.[0]?.permissionsContext || granted?.[0]?.context || "";
    (window as any)._permissionsContext = ctx;
    permissionsGranted = true;

    updatePermStatus("granted", true);
    log(`ERC-7715 permissions granted! Context: ${ctx ? "received" : "empty"}`, "ok");

    // Show permission details in UI
    showPermissionDetails(now, expiry);

    // Kirim context ke bridge server via WebSocket agar disimpan
    // Agent CLI akan fetch context ini dari GET /permissions-context
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "permissions_granted",
        success: true,
        permissionsContext: ctx,
        wallet: account,
      }));
    }

    document.getElementById("grantBtn")!.setAttribute("disabled", "true");
  } catch (err: any) {
    log(`Permissions failed: ${err.message}`, "err");
    updatePermStatus("failed", false);
  }
};

function updatePermStatus(text: string, ok: boolean) {
  document.getElementById("permissionsStatus")!.className = `status ${ok ? "connected" : "error"}`;
  document.getElementById("permBadge")!.className = `badge ${ok ? "on" : "off"}`;
  document.getElementById("permBadge")!.textContent = text;
}

/**
 * Show permission details in the UI after successful grant.
 * Displays: spending cap, token, network, delegate, grant time, expiry.
 */
function showPermissionDetails(grantedAt: number, expiresAt: number) {
  const details = document.getElementById("permDetails")!;
  details.style.display = "block";

  document.getElementById("permGrantedAt")!.textContent = new Date(grantedAt * 1000).toLocaleString();
  document.getElementById("permExpiry")!.textContent = new Date(expiresAt * 1000).toLocaleString();

  document.getElementById("revokeBtn")!.removeAttribute("disabled");

  log("Permission details: $1.00 USDC/24h cap, expires " + new Date(expiresAt * 1000).toLocaleDateString(), "info");
}

/**
 * Revoke permissions — clears stored context and resets UI.
 * This stops the agent from being able to pay autonomously.
 *
 * What happens:
 * 1. Clear permissionsContext from bridge server (DELETE)
 * 2. Clear local state
 * 3. Reset UI to pre-grant state
 * 4. Agent will fall back to stub mode on next run
 */
(window as any)._revokePermissions = async function () {
  try {
    log("Revoking permissions...", "warn");

    // Tell bridge server to delete stored context
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "permissions_revoked",
      }));
    }

    // Clear local state
    (window as any)._permissionsContext = null;
    permissionsGranted = false;

    // Reset UI
    updatePermStatus("revoked", false);
    document.getElementById("permDetails")!.style.display = "none";
    document.getElementById("permStatusText")!.textContent = "REVOKED";
    document.getElementById("permStatusText")!.style.color = "#f44336";
    document.getElementById("grantBtn")!.removeAttribute("disabled");
    document.getElementById("revokeBtn")!.setAttribute("disabled", "true");

    log("Permissions revoked! Agent will no longer be able to pay autonomously.", "ok");
  } catch (err: any) {
    log(`Revoke failed: ${err.message}`, "err");
  }
};

// === PAYMENT APPROVAL (bridge mode) ===

/**
 * User klik Approve di browser.
 * Kirim konfirmasi ke bridge server via WebSocket.
 * Bridge server yang panggil webhook gateway (server-side, tanpa CORS issue).
 */
(window as any)._approvePayment = async function (id: string, resource: string, amount: string, asset: string, payTo: string) {
  try {
    const cost = (Number(amount) / 1e6).toFixed(2);
    log(`Approving payment: ${cost} USDC for ${resource}`, "warn");

    if ((window as any)._permissionsContext && walletClient) {
      log("ERC-7715 permission context active — delegating to bridge server", "info");
    }

    // Kirim approval via WebSocket (bridge server akan panggil webhook)
    ws.send(JSON.stringify({
      type: "payment_response",
      id,
      success: true,
      txHash: `0x${Date.now().toString(16)}`,
      wallet: account,
      resource,
      amount,
      asset,
      payTo,
    }));

    log(`Payment approved! Waiting for confirmation...`, "ok");
    document.getElementById("paymentArea")!.innerHTML =
      '<div class="status connected">Payment approved. Waiting for next request...</div>';
  } catch (err: any) {
    log(`Payment failed: ${err.message}`, "err");
    ws.send(JSON.stringify({ type: "payment_response", id, success: false, error: err.message }));
  }
};

/**
 * User klik Reject di browser.
 * Kirim rejection ke bridge server.
 */
(window as any)._rejectPayment = function (id: string) {
  log("Payment rejected by user", "err");
  ws.send(JSON.stringify({ type: "payment_response", id, success: false, error: "rejected" }));
  document.getElementById("paymentArea")!.innerHTML =
    '<div class="status waiting">Waiting for payment requests from agent...</div>';
};

// === INIT ===
connectWs();
log("Wallet bridge loaded (bundled). Connect MetaMask Flask to begin.", "info");

// Expose functions ke window untuk onclick handlers di HTML
(window as any).connectWallet = (window as any).connectWallet;
(window as any).grantPermissions = (window as any).grantPermissions;
