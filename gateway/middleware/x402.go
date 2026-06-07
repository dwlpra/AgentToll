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

func X402Middleware(store *payments.Store, cfg payments.X402Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/catalog" || r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

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

		authWallet := r.Header.Get("X-AUTHORIZED-WALLET")
		if authWallet != "" && store.IsAuthorized(authWallet, r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		priceUnits, desc, ok := cfg.GetPriceForPath(r.URL.Path)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}

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
