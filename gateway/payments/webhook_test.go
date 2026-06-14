package payments

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func testConfig() X402Config {
	return NewX402Config("0xGW", "0xUSDC", "base-sepolia")
}

func testConfigPtr() *X402Config {
	cfg := testConfig()
	return &cfg
}

func TestWebhookAuthorizesOnConfirmed(t *testing.T) {
	store := NewStore()
	handler := WebhookHandler(store, testConfigPtr())

	payload := WebhookPayload{
		TaskID:   "task-001",
		Status:   "confirmed",
		Wallet:   "0xWALLET",
		Resource: "/reports/asia-daily",
		Amount:   "100000",
		Asset:    "0xUSDC",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	if !store.IsAuthorized("0xWALLET", "/reports/asia-daily") {
		t.Fatal("wallet should be authorized after confirmed webhook")
	}
}

func TestWebhookRejectsGet(t *testing.T) {
	store := NewStore()
	handler := WebhookHandler(store, testConfigPtr())

	req := httptest.NewRequest("GET", "/webhook", nil)
	w := httptest.NewRecorder()

	handler(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestWebhookDoesNotAuthorizeOnPending(t *testing.T) {
	store := NewStore()
	handler := WebhookHandler(store, testConfigPtr())

	payload := WebhookPayload{
		TaskID:   "task-002",
		Status:   "pending",
		Wallet:   "0xWALLET",
		Resource: "/reports/deep-dive",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler(w, req)

	if store.IsAuthorized("0xWALLET", "/reports/deep-dive") {
		t.Fatal("pending status should not authorize")
	}
}

func TestWebhookRejectsAmountMismatch(t *testing.T) {
	store := NewStore()
	handler := WebhookHandler(store, testConfigPtr())

	payload := WebhookPayload{
		TaskID:   "task-003",
		Status:   "confirmed",
		Wallet:   "0xWALLET",
		Resource: "/reports/asia-daily",
		Amount:   "999999", // wrong amount (expected 100000)
		Asset:    "0xUSDC",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for amount mismatch, got %d", w.Code)
	}

	if store.IsAuthorized("0xWALLET", "/reports/asia-daily") {
		t.Fatal("should not authorize with wrong amount")
	}
}

func TestWebhookAcceptsEmptyAmount(t *testing.T) {
	store := NewStore()
	handler := WebhookHandler(store, testConfigPtr())

	// Empty amount should pass (legacy compatibility)
	payload := WebhookPayload{
		TaskID:   "task-004",
		Status:   "confirmed",
		Wallet:   "0xWALLET",
		Resource: "/reports/asia-daily",
		Amount:   "",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for empty amount, got %d", w.Code)
	}
}
