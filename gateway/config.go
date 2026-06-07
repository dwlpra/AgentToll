package main

import "os"

type Config struct {
	GatewayWallet  string
	GatewaySecret  string
	MockAPIURL     string
	USDCAddress    string
	Network        string
	ListenAddr     string
}

func LoadConfig() Config {
	return Config{
		GatewayWallet: getEnv("GATEWAY_WALLET", "0x0000000000000000000000000000000000000000"),
		GatewaySecret: getEnv("GATEWAY_SECRET", "gateway-secret-key-change-me"),
		MockAPIURL:    getEnv("MOCK_API_URL", "http://localhost:18091"),
		USDCAddress:   getEnv("USDC_ADDRESS", "0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
		Network:       getEnv("NETWORK", "base-sepolia"),
		ListenAddr:    getEnv("LISTEN_ADDR", ":19090"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
