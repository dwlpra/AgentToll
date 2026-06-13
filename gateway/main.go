package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
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

	// Provider config manager: stores provider wallet dynamically from MetaMask login
	providerCfgMgr := NewProviderConfigManager(cfg.GatewayWallet)

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
	log.Printf("  React UI:      http://localhost:5173", cfg.ListenAddr)
	log.Printf("  Resources:     http://localhost%s/api/resources", cfg.ListenAddr)
	log.Printf("  Agent Cfg:     http://localhost%s/api/agent-config", cfg.ListenAddr)
	log.Printf("  Provider Cfg:  http://localhost%s/api/provider-config", cfg.ListenAddr)
	log.Printf("  Crawl:         http://localhost%s/api/crawl", cfg.ListenAddr)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	log.Println("gateway stopped")
}
