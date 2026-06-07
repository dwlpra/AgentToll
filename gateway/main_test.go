package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gateway/middleware"
	"gateway/payments"
)

// Test that catalog endpoint returns JSON with all 3 resources
func TestCatalogHandler(t *testing.T) {
	mockAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/catalog" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"catalog": []map[string]any{
					{"path": "/reports/asia-daily", "priceUSD": 0.10},
					{"path": "/reports/quick-take", "priceUSD": 0.40},
					{"path": "/reports/deep-dive", "priceUSD": 0.60},
				},
				"totalCount": 3,
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer mockAPI.Close()

	req := httptest.NewRequest("GET", "/catalog", nil)
	w := httptest.NewRecorder()

	handler := catalogHandler(mockAPI.URL)
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	cat, ok := body["catalog"].([]any)
	if !ok {
		t.Fatal("catalog should be an array")
	}
	if len(cat) != 3 {
		t.Fatalf("expected 3 catalog entries, got %d", len(cat))
	}
}

// Test that unauthorized request to /reports/ gets 402
func TestX402MiddlewareReturns402(t *testing.T) {
	store := payments.NewStore()
	cfg := payments.NewX402Config("0xGW", "0xUSDC", "base-sepolia")

	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":"should not reach"}`))
	})

	handler := middleware.X402Middleware(store, cfg, upstream)

	req := httptest.NewRequest("GET", "/reports/asia-daily", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Fatalf("expected 402, got %d", w.Code)
	}

	var body map[string]any
	json.NewDecoder(w.Body).Decode(&body)

	if body["x402Version"] != float64(1) {
		t.Fatalf("expected x402Version 1, got %v", body["x402Version"])
	}

	accepts, ok := body["accepts"].([]any)
	if !ok || len(accepts) != 1 {
		t.Fatal("accepts should have 1 entry")
	}

	entry := accepts[0].(map[string]any)
	if entry["maxAmountRequired"] != "100000" {
		t.Fatalf("expected 100000 units, got %v", entry["maxAmountRequired"])
	}
	if entry["scheme"] != "exact" {
		t.Fatalf("expected scheme exact, got %v", entry["scheme"])
	}
}

// Test that authorized request passes through
func TestX402MiddlewarePassesAuthorized(t *testing.T) {
	store := payments.NewStore()
	cfg := payments.NewX402Config("0xGW", "0xUSDC", "base-sepolia")

	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	handler := middleware.X402Middleware(store, cfg, upstream)

	// Authorize first
	store.Authorize("0xTEST", "/reports/asia-daily", 5*60*1000000000) // 5 min

	req := httptest.NewRequest("GET", "/reports/asia-daily", nil)
	req.Header.Set("X-AUTHORIZED-WALLET", "0xTEST")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for authorized request, got %d", w.Code)
	}
}

// Test that /catalog bypasses x402
func TestX402MiddlewareBypassesCatalog(t *testing.T) {
	store := payments.NewStore()
	cfg := payments.NewX402Config("0xGW", "0xUSDC", "base-sepolia")

	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"catalog":[]}`))
	})

	handler := middleware.X402Middleware(store, cfg, upstream)

	req := httptest.NewRequest("GET", "/catalog", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("catalog should bypass x402, got %d", w.Code)
	}
}
