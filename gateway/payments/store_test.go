package payments

import (
	"testing"
	"time"
)

func TestNewStore(t *testing.T) {
	s := NewStore()
	if s == nil {
		t.Fatal("store should not be nil")
	}
}

func TestAuthorizeAndCheck(t *testing.T) {
	s := NewStore()

	if s.IsAuthorized("0xA", "/reports/asia-daily") {
		t.Fatal("should not be authorized before authorizing")
	}

	s.Authorize("0xA", "/reports/asia-daily", 5*time.Minute)

	if !s.IsAuthorized("0xA", "/reports/asia-daily") {
		t.Fatal("should be authorized after authorizing")
	}
}

func TestDifferentWalletsNotAuthorized(t *testing.T) {
	s := NewStore()
	s.Authorize("0xA", "/reports/asia-daily", 5*time.Minute)

	if s.IsAuthorized("0xB", "/reports/asia-daily") {
		t.Fatal("different wallet should not be authorized")
	}
}

func TestDifferentPathsNotAuthorized(t *testing.T) {
	s := NewStore()
	s.Authorize("0xA", "/reports/asia-daily", 5*time.Minute)

	if s.IsAuthorized("0xA", "/reports/deep-dive") {
		t.Fatal("different path should not be authorized")
	}
}

func TestAuthorizationExpires(t *testing.T) {
	s := NewStore()
	s.Authorize("0xA", "/reports/asia-daily", 1*time.Nanosecond)

	time.Sleep(10 * time.Millisecond)

	if s.IsAuthorized("0xA", "/reports/asia-daily") {
		t.Fatal("should expire after ttl")
	}
}

func TestCleanupRemovesExpired(t *testing.T) {
	s := NewStore()
	s.Authorize("0xA", "/reports/asia-daily", 1*time.Nanosecond)
	s.Authorize("0xB", "/reports/deep-dive", 5*time.Minute)

	time.Sleep(10 * time.Millisecond)
	s.Cleanup()

	if s.IsAuthorized("0xA", "/reports/asia-daily") {
		t.Fatal("expired should be cleaned up")
	}
	if !s.IsAuthorized("0xB", "/reports/deep-dive") {
		t.Fatal("valid should remain after cleanup")
	}
}
