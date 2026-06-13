package main

import (
	"encoding/json"
	"math"
	"net/http"
	"sort"
	"strconv"

	"gateway/payments"
)

const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PayCrawl — Provider Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter','system-ui','sans-serif'], mono: ['SF Mono','Fira Code','monospace'] },
          colors: { base: { blue:'#0000ff', cerulean:'#3c8aff', green:'#66c800', red:'#fc401f', tan:'#b8a581' } }
        }
      }
    }
  </script>
  <style>
    @keyframes fadeIn{from{background:rgba(0,0,255,.06)}to{background:transparent}}
    @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}
  </style>
</head>
<body class="bg-gray-50 text-gray-900 font-sans min-h-screen">

  <!-- Navbar -->
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-base-blue rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
          <span class="text-white font-extrabold text-base">PC</span>
        </div>
        <div>
          <h1 class="text-xl font-extrabold text-gray-900 leading-tight tracking-tight">PayCrawl</h1>
          <p class="text-sm text-gray-400 font-medium">Revenue Dashboard</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 px-4 py-2 bg-green-50 text-base-green rounded-full text-sm font-bold">
          <span class="w-2 h-2 rounded-full bg-base-green" style="animation:pulse-dot 2s infinite"></span>
          Live
        </div>
        <div id="networkBadge" class="px-4 py-2 bg-blue-50 text-base-blue text-sm font-bold rounded-full border border-blue-100">
          TESTNET
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-6xl mx-auto px-6 py-10">

    <!-- Stats -->
    <div id="stats" class="grid grid-cols-4 gap-5 mb-10"></div>

    <!-- Revenue Chart -->
    <div class="mb-10">
      <h2 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Revenue Over Time</h2>
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6" style="height:280px" id="chartContainer">
        <canvas class="w-full h-full" id="revenueChart"></canvas>
      </div>
    </div>

    <!-- Resources -->
    <div class="mb-10">
      <h2 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Resources</h2>
      <div id="resourceCards" class="grid grid-cols-3 gap-5"></div>
    </div>

    <!-- Purchase History -->
    <div class="mb-10">
      <h2 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Purchase History</h2>
      <p class="text-sm text-gray-400 mb-4">Auto-refreshes every 5 seconds</p>
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b-2 border-gray-100">
              <th class="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-5 py-4">#</th>
              <th class="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-5 py-4">Time</th>
              <th class="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-5 py-4">Resource</th>
              <th class="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-5 py-4">Amount</th>
              <th class="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-5 py-4">Buyer</th>
              <th class="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-5 py-4">Transaction</th>
            </tr>
          </thead>
          <tbody id="history"></tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center pt-8 mt-8 border-t border-gray-200 text-sm text-gray-400">
      PayCrawl — Autonomous Pay-Per-Crawl with MetaMask Smart Accounts &middot;
      <a href="https://x402.org" target="_blank" class="text-base-cerulean font-semibold hover:underline">x402 Protocol</a> &middot;
      <a href="https://docs.metamask.io/smart-accounts-kit/" target="_blank" class="text-base-cerulean font-semibold hover:underline">MetaMask Smart Accounts Kit</a>
    </div>

  </main>

  <script>
    var EXPLORER = "https://basescan.org";
    var prevPurchaseCount = 0;
    var revenueHistory = [];
    var chartCanvas = document.getElementById("revenueChart");
    var chartCtx = chartCanvas ? chartCanvas.getContext("2d") : null;

    function resizeCanvas() {
      if (!chartCanvas) return;
      var c = document.getElementById("chartContainer");
      chartCanvas.width = c.clientWidth;
      chartCanvas.height = c.clientHeight;
    }
    window.addEventListener("resize", function() { resizeCanvas(); drawChart(); });
    resizeCanvas();

    function drawChart() {
      if (!chartCtx || !chartCanvas) return;
      var w = chartCanvas.width, h = chartCanvas.height, ctx = chartCtx;
      ctx.clearRect(0, 0, w, h);

      if (revenueHistory.length < 2) {
        ctx.fillStyle = "#5b616e";
        ctx.font = "16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Revenue chart will appear after purchases are made", w / 2, h / 2);
        return;
      }

      var pad = { top: 24, right: 24, bottom: 36, left: 60 };
      var cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
      var maxVal = Math.max.apply(null, revenueHistory.map(function(r) { return r.total; }));
      maxVal = Math.max(maxVal, 0.5);

      // Grid
      ctx.strokeStyle = "#dee1e7"; ctx.lineWidth = 1;
      for (var i = 0; i <= 4; i++) {
        var y = pad.top + (ch / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
        ctx.fillStyle = "#5b616e"; ctx.font = "12px Inter, sans-serif"; ctx.textAlign = "right";
        ctx.fillText("$" + (maxVal - (maxVal / 4) * i).toFixed(2), pad.left - 10, y + 4);
      }

      // Points
      var pts = revenueHistory.map(function(r, idx) {
        return { x: pad.left + (cw / (revenueHistory.length - 1)) * idx, y: pad.top + ch - (r.total / maxVal) * ch };
      });

      // Gradient fill
      var grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
      grad.addColorStop(0, "rgba(0,0,255,0.12)"); grad.addColorStop(1, "rgba(0,0,255,0)");
      ctx.beginPath(); ctx.moveTo(pts[0].x, h - pad.bottom);
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.lineTo(pts[i].x, pts[i].y);
        else { var cx = (pts[i-1].x + pts[i].x) / 2; ctx.bezierCurveTo(cx, pts[i-1].y, cx, pts[i].y, pts[i].x, pts[i].y); }
      }
      ctx.lineTo(pts[pts.length-1].x, h - pad.bottom); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

      // Line
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else { var cx = (pts[i-1].x + pts[i].x) / 2; ctx.bezierCurveTo(cx, pts[i-1].y, cx, pts[i].y, pts[i].x, pts[i].y); }
      }
      ctx.strokeStyle = "#0000ff"; ctx.lineWidth = 3; ctx.stroke();

      // Dots
      for (var i = 0; i < pts.length; i++) {
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 5, 0, Math.PI * 2); ctx.fillStyle = "#0000ff"; ctx.fill();
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
      }
    }

    function refresh() {
      fetch("/api/dashboard")
        .then(function(res) { return res.json(); })
        .then(function(data) {
          // Stats
          document.getElementById("stats").innerHTML =
            '<div class="bg-white rounded-2xl p-7 text-center shadow-sm border border-gray-200 relative overflow-hidden">' +
              '<div class="absolute top-0 left-6 right-6 h-1 bg-base-blue rounded-b"></div>' +
              '<div class="text-4xl font-extrabold text-base-blue mb-1">$' + data.revenue + '</div>' +
              '<div class="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Revenue</div></div>' +
            '<div class="bg-white rounded-2xl p-7 text-center shadow-sm border border-gray-200 relative overflow-hidden">' +
              '<div class="absolute top-0 left-6 right-6 h-1 bg-base-cerulean rounded-b"></div>' +
              '<div class="text-4xl font-extrabold text-base-cerulean mb-1">' + data.purchaseCount + '</div>' +
              '<div class="text-xs font-bold text-gray-400 uppercase tracking-widest">Purchases</div></div>' +
            '<div class="bg-white rounded-2xl p-7 text-center shadow-sm border border-gray-200 relative overflow-hidden">' +
              '<div class="absolute top-0 left-6 right-6 h-1 bg-base-green rounded-b"></div>' +
              '<div class="text-4xl font-extrabold text-base-green mb-1">' + data.resourcesBought + '</div>' +
              '<div class="text-xs font-bold text-gray-400 uppercase tracking-widest">Resources Bought</div></div>' +
            '<div class="bg-white rounded-2xl p-7 text-center shadow-sm border border-gray-200 relative overflow-hidden">' +
              '<div class="absolute top-0 left-6 right-6 h-1 bg-base-tan rounded-b"></div>' +
              '<div class="text-4xl font-extrabold text-base-tan mb-1">' + Object.keys(data.resources).length + '</div>' +
              '<div class="text-xs font-bold text-gray-400 uppercase tracking-widest">Resources Listed</div></div>';

          // Chart
          if (data.purchaseCount > 0) { revenueHistory = data.revenueTimeline || []; drawChart(); }

          // Resource cards
          var prices = data.resources || {}, purchaseMap = data.purchaseBreakdown || {}, cardsHtml = "";
          Object.keys(prices).forEach(function(p) {
            var price = prices[p], bought = purchaseMap[p] || 0;
            var pct = Math.min((bought / 5) * 100, 100), short = p.replace("/reports/", "");
            cardsHtml +=
              '<div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:border-base-blue hover:shadow-md transition-all">' +
              '<div class="flex justify-between items-start mb-3">' +
              '<div class="text-base font-bold text-base-cerulean">' + short + '</div>' +
              '<div class="text-2xl font-extrabold text-base-blue">$' + price.toFixed(2) + '</div></div>' +
              '<div class="text-sm text-gray-400">' + bought + ' purchase' + (bought !== 1 ? 's' : '') + ' &middot; $' + (price * bought).toFixed(2) + ' revenue</div>' +
              '<div class="h-1 bg-gray-100 rounded mt-4"><div class="h-1 rounded bg-base-blue transition-all duration-500" style="width:' + pct + '%"></div></div></div>';
          });
          document.getElementById("resourceCards").innerHTML = cardsHtml;

          // History
          var tbody = document.getElementById("history");
          if (data.purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-16 text-gray-400 text-lg"><div class="text-4xl mb-3 opacity-30">📡</div>Waiting for agents to buy resources...</td></tr>';
            return;
          }
          var html = "", newRows = data.purchaseCount > prevPurchaseCount;
          for (var i = data.purchases.length - 1; i >= 0; i--) {
            var p = data.purchases[i];
            var isNew = newRows && i >= data.purchases.length - (data.purchaseCount - prevPurchaseCount);
            var rowClass = isNew ? ' style="animation:fadeIn .6s ease"' : '';
            var shortWallet = p.wallet.slice(0, 6) + "..." + p.wallet.slice(-4);
            var shortTx = p.txHash ? p.txHash.slice(0, 10) + "..." : "pending";
            var txLink;
            if (p.txHash && p.txHash.indexOf("stub") === -1 && p.txHash.indexOf("0x") === 0 && p.txHash.length > 20) {
              txLink = '<a class="text-sm font-mono font-semibold text-base-blue hover:underline" href="' + EXPLORER + "/tx/" + p.txHash + '" target="_blank">' + shortTx + " ↗</a>";
            } else {
              txLink = '<span class="text-sm font-mono text-gray-400">' + shortTx + '</span>';
            }
            var time = new Date(p.timestamp).toLocaleTimeString();
            var resName = p.resource.replace("/reports/", "");
            html += "<tr" + rowClass + " class='border-b border-gray-100 hover:bg-blue-50/30 transition-colors'>" +
              '<td class="px-5 py-4 text-base">' + (i + 1) + "</td>" +
              '<td class="px-5 py-4 text-base">' + time + "</td>" +
              '<td class="px-5 py-4 text-base font-semibold text-base-cerulean">' + resName + "</td>" +
              '<td class="px-5 py-4 text-lg font-bold text-base-green">$' + p.amountUSD + "</td>" +
              '<td class="px-5 py-4 text-sm font-mono text-gray-400">' + shortWallet + "</td>" +
              "<td class='px-5 py-4'>" + txLink + "</td></tr>";
          }
          tbody.innerHTML = html;
          prevPurchaseCount = data.purchaseCount;
        })
        .catch(function(e) { console.error("refresh error", e); });
    }

    refresh();
    setInterval(refresh, 5000);

    fetch("/api/dashboard")
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var badge = document.getElementById("networkBadge");
        if (data.usdcAddress && data.usdcAddress.toLowerCase() === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") {
          badge.textContent = "MAINNET";
          badge.className = "px-4 py-2 bg-green-50 text-base-green text-sm font-bold rounded-full border border-green-100";
        } else {
          badge.textContent = "TESTNET";
        }
      })
      .catch(function() {});
  </script>
</body>
</html>`

func dashboardHandler(store *payments.Store, x402Cfg *payments.X402Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/dashboard" {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(dashboardHTML))
			return
		}

		if r.URL.Path == "/api/dashboard" {
			purchases := store.GetPurchases()
			revenue := store.GetRevenue()

			purchaseBreakdown := map[string]int{}
			resourcesBought := map[string]bool{}
			for _, p := range purchases {
				purchaseBreakdown[p.Resource]++
				resourcesBought[p.Resource] = true
			}

			type timelinePoint struct {
				Time  string  `json:"time"`
				Total float64 `json:"total"`
			}
			sorted := make([]payments.Purchase, len(purchases))
			copy(sorted, purchases)
			sort.Slice(sorted, func(i, j int) bool {
				return sorted[i].Timestamp.Before(sorted[j].Timestamp)
			})
			timeline := []timelinePoint{}
			runningTotal := 0.0
			for _, p := range sorted {
				amt, _ := strconv.ParseFloat(p.AmountUSD, 64)
				runningTotal += amt
				timeline = append(timeline, timelinePoint{
					Time:  p.Timestamp.Format("15:04:05"),
					Total: math.Round(runningTotal*100) / 100,
				})
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"revenue":           revenue,
				"purchaseCount":     len(purchases),
				"resourcesBought":   len(resourcesBought),
				"purchases":         purchases,
				"resources":         x402Cfg.Prices,
				"purchaseBreakdown": purchaseBreakdown,
				"revenueTimeline":   timeline,
				"usdcAddress":       x402Cfg.USDCAddress,
				"network":           x402Cfg.Network,
			})
			return
		}

		http.NotFound(w, r)
	}
}
