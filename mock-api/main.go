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
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Path        string    `json:"path"`
	PriceUSD    float64   `json:"priceUSD"`
	PriceUnits  string    `json:"priceUnits"`
	Freshness   string    `json:"freshness"`
	Sources     int       `json:"sources"`
	Verified    bool      `json:"verified"`
	Summary     string    `json:"summary"`
	GeneratedAt time.Time `json:"generatedAt"`
}

type CatalogEntry struct {
	Path        string  `json:"path"`
	Title       string  `json:"title"`
	PriceUSD    float64 `json:"priceUSD"`
	PriceUnits  string  `json:"priceUnits"`
	Freshness   string  `json:"freshness"`
	Sources     int     `json:"sources"`
	Verified    bool    `json:"verified"`
	Summary     string  `json:"summary"`
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
		Summary: "Daily roundup of crypto market sentiment across major Asian exchanges (Binance, OKX, Upbit). " +
			"Coverage: BTC/USDT order flow from East Asian wallets, KRW premium index, JPY stablecoin volume. " +
			"Overall sentiment: cautiously bullish. BTC holding $67.2K support, ETH showing strength vs BTC pair. " +
			"Notable: South Korean retail volume spiked 23% in the last 24h, driven by altcoin rotation into L2 tokens. " +
			"Key data points: Fear & Greed Index at 62, funding rates neutral-to-slightly-positive across major perps.",
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
		Summary: "Brief market flash based on a single unverified Twitter thread. " +
			"Claims of 'imminent breakout' based on anecdotal chart pattern from an anonymous account. " +
			"No on-chain data, no exchange volume correlation, no multi-source validation. " +
			"Content is thin: 3 paragraphs of opinion with no quantitative backing. " +
			"This report was generated 9 days ago and has not been updated since.",
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
		Summary: "Comprehensive multi-source deep dive into Asian crypto market sentiment. " +
			"Data sources: (1) Binance/OKX order book depth analysis for BTC, ETH, SOL; " +
			"(2) On-chain whale tracking — 3 large BTC accumulations from Korean wallets in past 48h; " +
			"(3) KRW/BTC premium index at 2.3% (above 30-day average of 1.1%); " +
			"(4) Japanese regulatory sentiment — FSA signals openness to stablecoin framework expansion; " +
			"(5) Singapore MAS fintech report showing 34% YoY increase in licensed crypto firms. " +
			"Analysis: Strong institutional accumulation signal from East Asia. Retail FOMO building but not yet peaked. " +
			"Risk factors: potential regulatory tightening in China re: OTC desks, macro headwinds from BOJ rate policy. " +
			"Verdict: Bullish medium-term (2-4 weeks) with high conviction. Key level to watch: BTC $68.5K resistance.",
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
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Gateway-Secret", "")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"catalog": entries,
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
