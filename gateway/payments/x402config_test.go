package payments

import (
	"testing"
)

func TestNewX402Config(t *testing.T) {
	cfg := NewX402Config("0xGW", "0xUSDC", "base-sepolia")

	if cfg.GatewayWallet != "0xGW" {
		t.Fatalf("expected gateway wallet 0xGW, got %s", cfg.GatewayWallet)
	}
	if cfg.USDCAddress != "0xUSDC" {
		t.Fatalf("expected USDC 0xUSDC, got %s", cfg.USDCAddress)
	}
	if cfg.Network != "base-sepolia" {
		t.Fatalf("expected network base-sepolia, got %s", cfg.Network)
	}
}

func TestGetPriceForPath(t *testing.T) {
	cfg := NewX402Config("0xGW", "0xUSDC", "base-sepolia")

	tests := []struct {
		path        string
		wantUnits   string
		wantOk      bool
	}{
		{"/reports/asia-daily", "100000", true},
		{"/reports/quick-take", "400000", true},
		{"/reports/deep-dive", "600000", true},
		{"/reports/unknown", "", false},
		{"/other", "", false},
	}

	for _, tt := range tests {
		units, desc, ok := cfg.GetPriceForPath(tt.path)
		if ok != tt.wantOk {
			t.Errorf("path %s: ok=%v, want %v", tt.path, ok, tt.wantOk)
		}
		if ok && units != tt.wantUnits {
			t.Errorf("path %s: units=%s, want %s", tt.path, units, tt.wantUnits)
		}
		if ok && desc == "" {
			t.Errorf("path %s: description should not be empty", tt.path)
		}
	}
}
