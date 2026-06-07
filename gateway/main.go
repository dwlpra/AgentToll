package main

import (
	"log"
	"net/http"
	"time"

	"gateway/middleware"
	"gateway/payments"
	"gateway/proxy"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

	go func() {
		for range time.Tick(1 * time.Minute) {
			store.Cleanup()
		}
	}()

	reverseProxy := proxy.NewProxy(cfg.MockAPIURL, cfg.GatewaySecret)
	handler := middleware.X402Middleware(store, x402Cfg, reverseProxy)

	mux := http.NewServeMux()
	mux.Handle("/reports/", handler)
	mux.HandleFunc("/catalog", catalogHandler(cfg.MockAPIURL))
	mux.HandleFunc("/webhook", payments.WebhookHandler(store, x402Cfg))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/dashboard", dashboardHandler(store, x402Cfg))
	mux.HandleFunc("/api/dashboard", dashboardHandler(store, x402Cfg))

	log.Printf("gateway listening on %s (network=%s, wallet=%s)", cfg.ListenAddr, cfg.Network, cfg.GatewayWallet)
	log.Printf("  Dashboard: http://localhost%s/dashboard", cfg.ListenAddr)
	log.Fatal(http.ListenAndServe(cfg.ListenAddr, corsMiddleware(mux)))
}
