package main

import (
	"encoding/json"
	"net/http"

	"gateway/payments"
)

const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Provider Dashboard — x402 Revenue</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Fira Code', monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 24px;
      max-width: 960px;
      margin: 0 auto;
    }
    h1 { font-size: 20px; color: #f6851b; margin-bottom: 8px; }
    h2 { font-size: 14px; color: #888; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 1px; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card {
      background: #111;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-card .value { font-size: 28px; color: #f6851b; font-weight: bold; }
    .stat-card .label { font-size: 11px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .badge.live { background: #1a5c2e; color: #4caf50; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; color: #666; padding: 8px 12px; border-bottom: 1px solid #222; text-transform: uppercase; letter-spacing: 1px; }
    td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #181818; }
    tr:hover { background: #111; }
    .resource { color: #2196f3; }
    .wallet { font-size: 11px; color: #888; }
    .amount { color: #4caf50; font-weight: bold; }
    .tx-link { color: #f6851b; text-decoration: none; font-size: 11px; }
    .tx-link:hover { text-decoration: underline; }
    .empty { text-align: center; padding: 40px; color: #555; }
    .auto-refresh { font-size: 11px; color: #555; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>Provider Dashboard</h1>
  <div class="subtitle">x402 Pay-per-Crawl Revenue <span class="badge live">LIVE</span></div>

  <div class="stats" id="stats"></div>

  <h2>Purchase History</h2>
  <div class="auto-refresh">Auto-refreshes every 5 seconds</div>
  <table>
    <thead>
      <tr><th>#</th><th>Time</th><th>Resource</th><th>Amount</th><th>Buyer</th><th>Tx</th></tr>
    </thead>
    <tbody id="history"></tbody>
  </table>

  <script>
    var EXPLORER = "https://sepolia.basescan.org";

    function refresh() {
      fetch("/api/dashboard")
        .then(function(res) { return res.json(); })
        .then(function(data) {
          document.getElementById("stats").innerHTML =
            '<div class="stat-card"><div class="value">$' + data.revenue + '</div><div class="label">Total Revenue</div></div>' +
            '<div class="stat-card"><div class="value">' + data.purchaseCount + '</div><div class="label">Purchases</div></div>' +
            '<div class="stat-card"><div class="value">' + Object.keys(data.resources).length + '</div><div class="label">Resources Listed</div></div>';

          var tbody = document.getElementById("history");
          if (data.purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No purchases yet. Waiting for agent to buy...</td></tr>';
            return;
          }

          var html = "";
          for (var i = data.purchases.length - 1; i >= 0; i--) {
            var p = data.purchases[i];
            var shortWallet = p.wallet.slice(0, 6) + "..." + p.wallet.slice(-4);
            var shortTx = p.txHash ? p.txHash.slice(0, 10) + "..." : "pending";
            var txLink;
            if (p.txHash && p.txHash.indexOf("stub") === -1 && p.txHash.indexOf("0x") === 0) {
              txLink = '<a class="tx-link" href="' + EXPLORER + "/tx/" + p.txHash + '" target="_blank">' + shortTx + " ↗</a>";
            } else {
              txLink = '<span style="color:#555">' + shortTx + "</span>";
            }
            var time = new Date(p.timestamp).toLocaleTimeString();
            html += "<tr>" +
              "<td>" + (i + 1) + "</td>" +
              "<td>" + time + "</td>" +
              '<td class="resource">' + p.resource + "</td>" +
              '<td class="amount">$' + p.amountUSD + "</td>" +
              '<td class="wallet">' + shortWallet + "</td>" +
              "<td>" + txLink + "</td>" +
              "</tr>";
          }
          tbody.innerHTML = html;
        })
        .catch(function(e) { console.error("refresh error", e); });
    }

    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`

func dashboardHandler(store *payments.Store, x402Cfg payments.X402Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/dashboard" {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(dashboardHTML))
			return
		}

		if r.URL.Path == "/api/dashboard" {
			purchases := store.GetPurchases()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"revenue":       store.GetRevenue(),
				"purchaseCount": len(purchases),
				"purchases":     purchases,
				"resources":     x402Cfg.Prices,
			})
			return
		}

		http.NotFound(w, r)
	}
}
