package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type Report struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Path        string                 `json:"path"`
	PriceUSD    float64                `json:"priceUSD"`
	PriceUnits  string                 `json:"priceUnits"`
	Freshness   string                 `json:"freshness"`
	Sources     int                    `json:"sources"`
	Verified    bool                   `json:"verified"`
	Summary     string                 `json:"summary"`
	GeneratedAt time.Time              `json:"generatedAt"`
	Category    string                 `json:"category"`
	Tags        []string               `json:"tags"`
	Confidence  float64                `json:"confidence"`
	KeyMetrics  map[string]interface{} `json:"keyMetrics"`
	Analysis    []AnalysisSection      `json:"analysis"`
	RiskFactors []string               `json:"riskFactors"`
	Verdict     string                 `json:"verdict"`
}

type AnalysisSection struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type CatalogEntry struct {
	Path       string  `json:"path"`
	Title      string  `json:"title"`
	PriceUSD   float64 `json:"priceUSD"`
	PriceUnits string  `json:"priceUnits"`
	Freshness  string  `json:"freshness"`
	Sources    int     `json:"sources"`
	Verified   bool    `json:"verified"`
	Summary    string  `json:"summary"`
	Category   string  `json:"category"`
	Confidence float64 `json:"confidence"`
}

var reports = []Report{
	{
		ID: "asia-daily",
		Title: "Asia Crypto Market Daily — Sentiment Snapshot",
		Path: "/reports/asia-daily",
		PriceUSD: 0.10,
		PriceUnits: "100000",
		Freshness: "fresh — published 4 hours ago",
		Sources: 3,
		Verified: true,
		Category: "daily-briefing",
		Tags: []string{"BTC", "ETH", "KRW", "JPY", "sentiment"},
		Confidence: 0.87,
		Summary: "Daily roundup of crypto market sentiment across major Asian exchanges (Binance, OKX, Upbit). " +
			"Coverage: BTC/USDT order flow from East Asian wallets, KRW premium index, JPY stablecoin volume. " +
			"Overall sentiment: cautiously bullish. BTC holding $67.2K support, ETH showing strength vs BTC pair. " +
			"Notable: South Korean retail volume spiked 23% in the last 24h, driven by altcoin rotation into L2 tokens. " +
			"Key data points: Fear & Greed Index at 62, funding rates neutral-to-slightly-positive across major perps.",
		KeyMetrics: map[string]interface{}{
			"fearGreedIndex":      62,
			"krwPremiumIndex":     2.3,
			"krwPremiumAvg30d":    1.1,
			"btcSupport":          "$67,200",
			"ethBtcRatio":         0.0523,
			"koreanVolumeChange":  "+23%",
			"fundingRates":        "neutral-to-positive",
			"totalMarketCap":      "$2.41T",
		},
		Analysis: []AnalysisSection{
			{
				Title: "Order Flow Analysis",
				Content: "BTC/USDT order books on Binance show asymmetric bid depth at $66.8K–$67.5K, " +
					"suggesting strong buy-side support. OKX perpetual funding rates at 0.008% (8h) — " +
					"marginally positive, not yet overheated. East Asian wallet inflows to exchanges decreased " +
					"12% vs 7-day average, indicating holders are reluctant to sell at current levels.",
			},
			{
				Title: "Regional Volume Breakdown",
				Content: "South Korean Won (KRW) trading pairs accounted for 8.7% of global BTC volume (up from " +
					"6.2% last week). Upbit alone saw $1.2B in 24h volume. Japanese Yen pairs remain stable at " +
					"3.1%. Notable rotation: KRW-denominated altcoins (XRP, ADA, DOGE) saw 40–65% volume spikes " +
					"as retail traders chase momentum plays.",
			},
			{
				Title: "Sentiment Indicators",
				Content: "Social sentiment across Korean crypto communities (Naver cafes, Kakao groups) shows " +
					"rising optimism. Keyword analysis: '매수' (buy) mentions up 34% WoW, '하락' (decline) " +
					"mentions down 18%. Japanese crypto Twitter sentiment more cautious — focus on BOJ policy " +
					"uncertainty. Overall Fear & Greed composite: 62/100 (Greed territory, but not extreme).",
			},
		},
		RiskFactors: []string{
			"BOJ interest rate decision next week could strengthen JPY and suppress risk appetite",
			"Chinese OTC regulatory tightening rumors circulating on Weibo",
			"BTC must hold $66.5K or risk cascade to $64K support",
		},
		Verdict: "Cautiously bullish short-term. Strong accumulation signals from Korean retail. " +
			"Monitor BTC $67.5K breakout for confirmation of next leg up.",
		GeneratedAt: time.Now().Add(-4 * time.Hour),
	},
	{
		ID: "quick-take",
		Title: "Quick Take — Market Flash",
		Path: "/reports/quick-take",
		PriceUSD: 0.40,
		PriceUnits: "400000",
		Freshness: "stale — 9 days old",
		Sources: 1,
		Verified: false,
		Category: "market-flash",
		Tags: []string{"BTC", "speculation"},
		Confidence: 0.23,
		Summary: "Brief market flash based on a single unverified Twitter thread. " +
			"Claims of 'imminent breakout' based on anecdotal chart pattern from an anonymous account. " +
			"No on-chain data, no exchange volume correlation, no multi-source validation. " +
			"Content is thin: 3 paragraphs of opinion with no quantitative backing. " +
			"This report was generated 9 days ago and has not been updated since.",
		KeyMetrics: map[string]interface{}{
			"fearGreedIndex":  nil,
			"krwPremiumIndex": nil,
			"btcSupport":      "not analyzed",
			"fundingRates":    "not analyzed",
		},
		Analysis: []AnalysisSection{
			{
				Title: "Twitter Thread Claims",
				Content: "Anonymous account @CryptoWhaleXXX posted a thread claiming BTC is forming a " +
					"'textbook cup-and-handle' pattern on the 4H chart. No supporting volume data, " +
					"no on-chain metrics, no exchange flow analysis. Thread has 47 likes and 12 retweets. " +
					"Account has 890 followers and was created 3 months ago.",
			},
		},
		RiskFactors: []string{
			"Single unverified source with no track record",
			"9-day-old data — market conditions have changed significantly",
			"No quantitative analysis or multi-source validation",
			"Author has undisclosed positions (no transparency)",
		},
		Verdict: "Low confidence, stale data. Not recommended for trading decisions. " +
			"This report does not meet editorial standards for verification.",
		GeneratedAt: time.Now().Add(-9 * 24 * time.Hour),
	},
	{
		ID: "deep-dive",
		Title: "Asia Crypto Sentiment — Deep Dive Analysis",
		Path: "/reports/deep-dive",
		PriceUSD: 0.60,
		PriceUnits: "600000",
		Freshness: "fresh — published today",
		Sources: 5,
		Verified: true,
		Category: "deep-analysis",
		Tags: []string{"BTC", "ETH", "SOL", "KRW", "JPY", "regulation", "institutional", "on-chain"},
		Confidence: 0.94,
		Summary: "Comprehensive multi-source deep dive into Asian crypto market sentiment. " +
			"Data sources: (1) Binance/OKX order book depth analysis for BTC, ETH, SOL; " +
			"(2) On-chain whale tracking — 3 large BTC accumulations from Korean wallets in past 48h; " +
			"(3) KRW/BTC premium index at 2.3% (above 30-day average of 1.1%); " +
			"(4) Japanese regulatory sentiment — FSA signals openness to stablecoin framework expansion; " +
			"(5) Singapore MAS fintech report showing 34% YoY increase in licensed crypto firms. " +
			"Analysis: Strong institutional accumulation signal from East Asia. Retail FOMO building but not yet peaked. " +
			"Risk factors: potential regulatory tightening in China re: OTC desks, macro headwinds from BOJ rate policy. " +
			"Verdict: Bullish medium-term (2-4 weeks) with high conviction. Key level to watch: BTC $68.5K resistance.",
		KeyMetrics: map[string]interface{}{
			"fearGreedIndex":       62,
			"krwPremiumIndex":      2.3,
			"krwPremiumAvg30d":     1.1,
			"btcResistance":        "$68,500",
			"btcSupport":           "$67,200",
			"btcDominance":         "52.3%",
			"ethBtcRatio":          0.0523,
			"solTvl":               "$4.8B",
			"totalMarketCap":       "$2.41T",
			"whaleAccumulations":   3,
			"koreanVolumeChange":   "+23%",
			"fundingRates":         "neutral-to-positive",
			"japanFsaSentiment":    "positive",
			"singaporeLicensedFirms": "34% YoY growth",
		},
		Analysis: []AnalysisSection{
			{
				Title: "1. Order Book Depth Analysis",
				Content: "BTC/USDT on Binance: Bid depth at $66.5K–$68K totals $142M (up 18% vs last week). " +
					"Ask depth at $68K–$70K totals $89M. Bid/ask ratio of 1.60 is strongly bullish — " +
					"buyers are stacking. ETH/USDT shows similar pattern with bid/ask ratio of 1.42. " +
					"SOL order book more neutral at 1.05 — profit-taking after recent rally to $178. " +
					"Overall: Smart money is accumulating BTC and ETH, taking profits on SOL.",
			},
			{
				Title: "2. On-Chain Whale Tracking",
				Content: "Three significant accumulation events detected in past 48 hours: " +
					"(a) 450 BTC ($30.2M) moved from Upbit to cold storage — Korean whale taking long position; " +
					"(b) 280 BTC ($18.8M) transferred from Binance to unknown wallet — likely OTC settlement; " +
					"(c) 120 BTC ($8.1M) moved from OKX to new multi-sig — possibly institutional custody. " +
					"Net exchange outflow: -850 BTC (24h), consistent with accumulation phase. " +
					"Stablecoin inflow to exchanges: +$240M (24h), suggesting capital ready to deploy.",
			},
			{
				Title: "3. KRW Premium & Regional Flows",
				Content: "KRW/BTC premium at 2.3% is the highest reading in 45 days. " +
					"Historical correlation: KRW premium above 2.0% has preceded 5–15% BTC rallies " +
					"within 2 weeks in 7 of the last 8 occurrences (back-tested to Jan 2024). " +
					"Upbit BTC/KRW volume: $1.2B/24h (ranking #3 globally behind Binance and Coinbase). " +
					"Korean altcoin rotation: XRP/KRW volume up 52%, DOGE/KRW up 67% — classic retail FOMO pattern " +
					"but not yet at euphoria levels (which typically sees 3x these numbers).",
			},
			{
				Title: "4. Regulatory Landscape",
				Content: "Japan FSA: Published discussion paper on expanded stablecoin framework, " +
					"signaling openness to foreign-issuer stablecoins beyond JPY-backed. " +
					"Timeline: draft guidelines expected Q3 2026. Impact: Could unlock significant " +
					"Japanese institutional demand for USDC/USDT-denominated DeFi. " +
					"Singapore MAS: Annual fintech report shows 34% YoY increase in licensed crypto firms " +
					"(now 187 licensed entities). Singapore positioning as Asia's crypto hub. " +
					"China: Unconfirmed rumors of OTC desk crackdown circulating on Weibo/WeChat. " +
					"Risk level: Medium — previous crackdowns have caused short-term selling pressure.",
			},
			{
				Title: "5. Macro & Derivatives",
				Content: "BTC options: Put/call ratio at 0.62 — traders positioning bullish. " +
					"Max pain for June expiry at $65K, suggesting upside bias into month-end. " +
					"Perpetual funding rates: Binance 0.009%, OKX 0.007%, Bybit 0.011% — all positive but low, " +
					"indicating healthy long bias without leverage excess. " +
					"Macro context: BOJ rate decision next week (June 18) — if dovish, JPY weakens, " +
					"risk-on sentiment boosts crypto. If hawkish, expect short-term pullback to $65K support. " +
					"US CPI data next week also in focus — consensus expects 3.2% YoY.",
			},
		},
		RiskFactors: []string{
			"BOJ interest rate decision (June 18) — hawkish outcome could trigger risk-off across Asia",
			"Chinese OTC regulatory tightening rumors — unconfirmed but historically impactful",
			"BTC must break $68.5K resistance or risk forming lower-high pattern",
			"US CPI data could affect global risk appetite",
			"Ethereum ETF flow data showing mixed signals — could drag BTC",
		},
		Verdict: "Bullish medium-term (2-4 weeks) with HIGH conviction (0.94 confidence). " +
			"Key thesis: Korean retail accumulation + institutional cold storage flows + favorable " +
			"regulatory momentum in Japan/Singapore = strong buy signal. Entry: current levels ($67.2K). " +
			"Target: $72K–$75K. Stop-loss: close below $65K on daily. Risk/reward: 1:3.2.",
		GeneratedAt: time.Now().Add(-2 * time.Hour),
	},
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/catalog", handleCatalog)
	mux.HandleFunc("/reports/", handleReport)

	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = ":18091"
	}
	log.Println("mock-api listening on", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func handleCatalog(w http.ResponseWriter, r *http.Request) {
	entries := make([]CatalogEntry, len(reports))
	for i, rp := range reports {
		entries[i] = CatalogEntry{
			Path:       rp.Path,
			Title:      rp.Title,
			PriceUSD:   rp.PriceUSD,
			PriceUnits: rp.PriceUnits,
			Freshness:  rp.Freshness,
			Sources:    rp.Sources,
			Verified:   rp.Verified,
			Summary:    truncate(rp.Summary, 120) + "...",
			Category:   rp.Category,
			Confidence: rp.Confidence,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Gateway-Secret", "")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"catalog":    entries,
		"totalCount": len(entries),
	})
}

func handleReport(w http.ResponseWriter, r *http.Request) {
	secret := r.Header.Get("X-Gateway-Secret")
	if secret == "" {
		http.Error(w, `{"error":"missing X-Gateway-Secret — access via gateway only"}`, http.StatusForbidden)
		return
	}

	path := r.URL.Path
	for _, rp := range reports {
		if rp.Path == path {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(rp)
			return
		}
	}

	http.Error(w, fmt.Sprintf(`{"error":"report not found: %s"}`, path), http.StatusNotFound)
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
