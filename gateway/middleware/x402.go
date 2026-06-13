package middleware

import (
	"encoding/json"
	"net/http"

	"gateway/payments"
)

type AcceptEntry struct {
	Scheme            string `json:"scheme"`
	Network           string `json:"network"`
	MaxAmountRequired string `json:"maxAmountRequired"`
	Resource          string `json:"resource"`
	Description       string `json:"description"`
	PayTo             string `json:"payTo"`
	Asset             string `json:"asset"`
	MaxTimeoutSeconds int    `json:"maxTimeoutSeconds"`
}

type PaymentError struct {
	X402Version int           `json:"x402Version"`
	Error       string        `json:"error"`
	Accepts     []AcceptEntry `json:"accepts"`
}

// BrowserSecret is the shared secret between the React UI and the Gateway.
// The React UI sends this in the X-Browser-Token header to prove it's a
// legitimate browser client. Without the correct secret, the request is
// treated as an agent/crawler and hits the x402 paywall.
//
// This prevents agents from spoofing browser headers to bypass payment.
// Set via BROWSER_ACCESS_SECRET env var (falls back to GATEWAY_SECRET).
var BrowserSecret string

// isBrowserRequest determines if the request comes from the React UI
// by verifying a shared secret token.
//
// Security model:
//   - React UI knows the secret → sends it in X-Browser-Token header
//   - Gateway knows the secret → verifies it
//   - Agent/crawler does NOT know the secret → gets 402 paywall
//
// An agent cannot bypass this by adding headers because it doesn't know
// the secret value. This is the same pattern as X-Gateway-Secret used
// between Gateway and Mock API.
func isBrowserRequest(r *http.Request) bool {
	if BrowserSecret == "" {
		return false // No secret configured = no free browser access
	}

	token := r.Header.Get("X-Browser-Token")
	if token != "" && token == BrowserSecret {
		return true
	}

	// Also accept via query param for direct browser navigation
	q := r.URL.Query().Get("browser_token")
	if q != "" && q == BrowserSecret {
		return true
	}

	return false
}

func X402Middleware(store *payments.Store, cfg *payments.X402Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Always bypass: catalog and health
		if r.URL.Path == "/catalog" || r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		// Browser requests with valid shared secret pass through for free
		if isBrowserRequest(r) {
			next.ServeHTTP(w, r)
			return
		}

		// Already paid? Check X-PAYMENT header (signed payment proof)
		paymentHeader := r.Header.Get("X-PAYMENT")
		if paymentHeader != "" {
			var payload struct {
				Signature string `json:"signature"`
				Amount    string `json:"amount"`
				Asset     string `json:"asset"`
				Payer     string `json:"payer"`
			}
			if err := json.Unmarshal([]byte(paymentHeader), &payload); err == nil {
				if store.IsAuthorized(payload.Payer, r.URL.Path) {
					next.ServeHTTP(w, r)
					return
				}
			}
		}

		// Check if wallet is already authorized via webhook
		authWallet := r.Header.Get("X-AUTHORIZED-WALLET")
		if authWallet != "" && store.IsAuthorized(authWallet, r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Unknown path? Let it through (no paywall for non-resource paths)
		priceUnits, desc, ok := cfg.GetPriceForPath(r.URL.Path)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}

		// Agent/crawler: return 402 + accepts[] paywall
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)

		resp := PaymentError{
			X402Version: 1,
			Error:       "X-PAYMENT header is required",
			Accepts: []AcceptEntry{
				{
					Scheme:            "exact",
					Network:           cfg.Network,
					MaxAmountRequired: priceUnits,
					Resource:          r.URL.Path,
					Description:       desc,
					PayTo:             cfg.GatewayWallet,
					Asset:             cfg.USDCAddress,
					MaxTimeoutSeconds: 60,
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	})
}
