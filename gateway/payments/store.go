package payments

import (
	"fmt"
	"strconv"
	"sync"
	"time"
)

type Authorization struct {
	Wallet    string
	Path      string
	ExpiresAt time.Time
}

type Purchase struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	Wallet    string    `json:"wallet"`
	Resource  string    `json:"resource"`
	Amount    string    `json:"amount"`
	AmountUSD string    `json:"amountUSD"`
	TxHash    string    `json:"txHash"`
	Asset     string    `json:"asset"`
	Timestamp time.Time `json:"timestamp"`
}

type Store struct {
	mu       sync.RWMutex
	auth     map[string]Authorization
	purchases []Purchase
}

type X402Config struct {
	GatewayWallet string
	USDCAddress   string
	Network       string
	Prices        map[string]PriceEntry
}

type PriceEntry struct {
	Units       string
	Description string
}

func NewStore() *Store {
	return &Store{
		auth:     make(map[string]Authorization),
		purchases: []Purchase{},
	}
}

func NewX402Config(wallet, usdc, network string) X402Config {
	return X402Config{
		GatewayWallet: wallet,
		USDCAddress:   usdc,
		Network:       network,
		Prices: map[string]PriceEntry{
			"/reports/asia-daily": {
				Units:       "100000",
				Description: "Asia Crypto Market Daily — Sentiment Snapshot",
			},
			"/reports/quick-take": {
				Units:       "400000",
				Description: "Quick Take — Market Flash",
			},
			"/reports/deep-dive": {
				Units:       "600000",
				Description: "Asia Crypto Sentiment — Deep Dive Analysis",
			},
		},
	}
}

func (c X402Config) GetPriceForPath(path string) (units string, desc string, ok bool) {
	entry, exists := c.Prices[path]
	if !exists {
		return "", "", false
	}
	return entry.Units, entry.Description, true
}

func (s *Store) Authorize(wallet, path string, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := wallet + ":" + path
	s.auth[key] = Authorization{
		Wallet:    wallet,
		Path:      path,
		ExpiresAt: time.Now().Add(ttl),
	}
}

func (s *Store) IsAuthorized(wallet, path string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	key := wallet + ":" + path
	auth, exists := s.auth[key]
	if !exists {
		return false
	}
	if time.Now().After(auth.ExpiresAt) {
		return false
	}
	return true
}

func (s *Store) Cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, v := range s.auth {
		if now.After(v.ExpiresAt) {
			delete(s.auth, k)
		}
	}
}

func (s *Store) RecordPurchase(p Purchase) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p.ID == "" {
		p.ID = fmt.Sprintf("p-%d", len(s.purchases)+1)
	}
	s.purchases = append(s.purchases, p)
}

func (s *Store) GetPurchases() []Purchase {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Purchase, len(s.purchases))
	copy(result, s.purchases)
	return result
}

func (s *Store) GetRevenue() string {
	total := 0.0
	for _, p := range s.purchases {
		val, _ := strconv.ParseFloat(p.AmountUSD, 64)
		total += val
	}
	return fmt.Sprintf("%.2f", total)
}
