package main

import "os"

type Config struct {
	GatewayWallet   string
	GatewaySecret   string
	WebhookSecret   string
	MockAPIURL      string
	USDCAddress     string
	Network         string
	ListenAddr      string
}

func LoadConfig() Config {
	return Config{
		GatewayWallet:   getEnv("GATEWAY_WALLET", "0x0000000000000000000000000000000000000000"),
		GatewaySecret:   getEnv("GATEWAY_SECRET", "gateway-secret-key-change-me"),
		WebhookSecret:   getEnv("GATEWAY_WEBHOOK_SECRET", ""),
		MockAPIURL:      getEnv("MOCK_API_URL", "http://localhost:18091"),
		USDCAddress:     getEnv("USDC_ADDRESS", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
		Network:         getEnv("NETWORK", "base"),
		ListenAddr:      getEnv("LISTEN_ADDR", ":19090"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
