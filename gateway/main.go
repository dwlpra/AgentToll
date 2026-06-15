package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"gateway/middleware"
	"gateway/payments"
	"gateway/proxy"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-PAYMENT, X-AUTHORIZED-WALLET")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	cfg := LoadConfig()
	x402Cfg := payments.NewX402Config(cfg.GatewayWallet, cfg.USDCAddress, cfg.Network)
	store := payments.NewStore()

	// Set webhook secret for HMAC validation (if configured)
	payments.WebhookSecret = cfg.WebhookSecret

	// Set browser access secret (shared with React UI to verify browser requests)
	middleware.BrowserSecret = cfg.GatewaySecret

	// Mutable resource manager + agent config
	resourceMgr := NewResourceManager(&x402Cfg)
	agentCfgMgr := NewAgentConfigManager()

	// Provider config manager: hardcoded whitelist — only this wallet can be provider
	providerCfgMgr := NewProviderConfigManager("0x277B284B7c3D9ccc1a819c89e0378FB585085f6D")

	// When provider wallet is updated via UI, also update x402Config so middleware
	// generates 402 responses with the correct payTo address.
	// We watch for changes via a wrapper that updates both.

	// Crawl manager: handles crawl jobs triggered from UI
	crawlMgr := NewCrawlManager()

	// Periodic cleanup of expired authorizations
	go func() {
		for range time.Tick(1 * time.Minute) {
			store.Cleanup()
		}
	}()

	reverseProxy := proxy.NewProxy(cfg.MockAPIURL, cfg.GatewaySecret)
	handler := middleware.X402Middleware(store, &x402Cfg, reverseProxy)

	mux := http.NewServeMux()

	// x402 protected resources
	mux.Handle("/reports/", handler)

	// Public endpoints
	mux.HandleFunc("/catalog", catalogHandler(cfg.MockAPIURL))
	mux.HandleFunc("/webhook", payments.WebhookHandler(store, &x402Cfg))

	// Payment confirmation endpoint — agent calls this after on-chain payment succeeds.
	// This bridges the gap when the relayer webhook can't reach localhost.
	mux.HandleFunc("/api/payment-confirmed", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			Wallet  string `json:"wallet"`
			Path    string `json:"path"`
			Amount  string `json:"amount"`
			TxHash  string `json:"txHash"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
			return
		}
		if body.Wallet != "" && body.Path != "" {
			store.Authorize(body.Wallet, body.Path, 5*time.Minute)
			log.Printf("[payment-confirmed] authorized: wallet=%s resource=%s", body.Wallet, body.Path)

			// Append to purchase log (file-based, no DB needed)
			entry := map[string]interface{}{
				"wallet":   body.Wallet,
				"path":     body.Path,
				"amount":   body.Amount,
				"txHash":   body.TxHash,
				"chainId":  8453,
				"resource": body.Path,
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			}
			line, _ := json.Marshal(entry)
			logFile := "payments.jsonl"
			f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err == nil {
				f.Write(append(line, '\n'))
				f.Close()
			}

			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status":"authorized"}`))
		} else {
			http.Error(w, `{"error":"missing wallet or path"}`, http.StatusBadRequest)
		}
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Resource management API (provider sets prices)
	mux.HandleFunc("/api/resources", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			resourceMgr.HandleList(w, r)
		case http.MethodPut:
			resourceMgr.HandleUpdate(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Agent config API (budget, expiry, permissionsContext)
	mux.HandleFunc("/api/agent-config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			agentCfgMgr.HandleGet(w, r)
		case http.MethodPost:
			agentCfgMgr.HandlePost(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Provider config API (dynamic wallet from MetaMask login)
	mux.HandleFunc("/api/provider-config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			providerCfgMgr.HandleGet(w, r)
		case http.MethodPost:
			providerCfgMgr.HandlePost(w, r)
			// Also update x402Config so middleware generates correct payTo address
			x402Cfg.SetGatewayWallet(providerCfgMgr.GetWallet())
			log.Printf("[main] x402Config.GatewayWallet updated to %s", providerCfgMgr.GetWallet())
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Crawl API (trigger agent from UI)
	mux.HandleFunc("/api/crawl", crawlMgr.HandleCrawl)

	// Dashboard: redirect to React UI (gateway is API-only, all UI served by React)
	dashHandler := dashboardHandler(store, &x402Cfg)
	mux.HandleFunc("/dashboard", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://localhost:5173/provider", http.StatusTemporaryRedirect)
	})
	mux.HandleFunc("/api/dashboard", dashHandler)

	// Purchase history endpoint — reads from payments.jsonl (file-based, no DB)
	mux.HandleFunc("/api/purchases", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		data, err := os.ReadFile("payments.jsonl")
		if err != nil {
			w.Write([]byte(`{"purchases":[],"totalRevenue":"0.00","count":0}`))
			return
		}
		lines := strings.Split(strings.TrimSpace(string(data)), "\n")
		type Purchase struct {
			Wallet    string `json:"wallet"`
			Path      string `json:"path"`
			Amount    string `json:"amount"`
			TxHash    string `json:"txHash"`
			ChainId   int    `json:"chainId"`
			Timestamp string `json:"timestamp"`
		}
		var purchases []Purchase
		totalRev := 0.0
		for _, line := range lines {
			if line == "" {
				continue
			}
			var p Purchase
			if err := json.Unmarshal([]byte(line), &p); err != nil {
				continue
			}
			purchases = append(purchases, p)
			if amt, err := strconv.ParseFloat(p.Amount, 64); err == nil {
				totalRev += amt
			}
		}
		// Reverse order (newest first)
		for i, j := 0, len(purchases)-1; i < j; i, j = i+1, j-1 {
			purchases[i], purchases[j] = purchases[j], purchases[i]
		}
		resp := map[string]interface{}{
			"purchases":    purchases,
			"totalRevenue": fmt.Sprintf("%.2f", totalRev),
			"count":        len(purchases),
		}
		json.NewEncoder(w).Encode(resp)
	})

	// Gateway is API-only. Redirect any HTML requests to React UI.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/landing" {
			http.Redirect(w, r, "http://localhost:5173/", http.StatusTemporaryRedirect)
			return
		}
		http.NotFound(w, r)
	})

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: corsMiddleware(mux),
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("gateway listening on %s (network=%s, wallet=%s)", cfg.ListenAddr, cfg.Network, cfg.GatewayWallet)
	log.Printf("  React UI:      http://localhost:5173")
	log.Printf("  Resources:     http://localhost%s/api/resources", cfg.ListenAddr)
	log.Printf("  Agent Cfg:     http://localhost%s/api/agent-config", cfg.ListenAddr)
	log.Printf("  Provider Cfg:  http://localhost%s/api/provider-config", cfg.ListenAddr)
	log.Printf("  Crawl:         http://localhost%s/api/crawl", cfg.ListenAddr)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	log.Println("gateway stopped")
}
