package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"os"
	"strings"
	"sync"
	"time"

	"gateway/payments"
)

type ResourceManager struct {
	mu        sync.RWMutex
	x402Cfg   *payments.X402Config
	resources map[string]ResourceInfo
}

type ResourceInfo struct {
	ID          string  `json:"id"`
	Path        string  `json:"path"`
	Title       string  `json:"title"`
	PriceUSD    float64 `json:"priceUSD"`
	PriceUnits  string  `json:"priceUnits"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
}

func NewResourceManager(x402Cfg *payments.X402Config) *ResourceManager {
	rm := &ResourceManager{
		x402Cfg:   x402Cfg,
		resources: make(map[string]ResourceInfo),
	}

	// Default resources (matching mock-api data)
	rm.resources["/reports/asia-daily"] = ResourceInfo{
		ID: "asia-daily", Path: "/reports/asia-daily",
		Title: "Asia Crypto Market Daily", PriceUSD: 0.10,
		PriceUnits: "100000", Description: "Daily sentiment snapshot", Category: "daily-briefing",
	}
	rm.resources["/reports/quick-take"] = ResourceInfo{
		ID: "quick-take", Path: "/reports/quick-take",
		Title: "Quick Take", PriceUSD: 0.40,
		PriceUnits: "400000", Description: "Market flash update", Category: "market-flash",
	}
	rm.resources["/reports/deep-dive"] = ResourceInfo{
		ID: "deep-dive", Path: "/reports/deep-dive",
		Title: "Deep Dive Analysis", PriceUSD: 0.60,
		PriceUnits: "600000", Description: "Comprehensive multi-source analysis", Category: "deep-analysis",
	}

	// Sync initial prices to x402 config
	rm.syncPrices()

	return rm
}

func (rm *ResourceManager) syncPrices() {
	prices := make(map[string]string)
	descriptions := make(map[string]string)
	for path, r := range rm.resources {
		prices[path] = r.PriceUnits
		descriptions[path] = r.Title
	}
	rm.x402Cfg.UpdatePrices(prices, descriptions)
}

func (rm *ResourceManager) HandleList(w http.ResponseWriter, r *http.Request) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	list := make([]ResourceInfo, 0, len(rm.resources))
	for _, r := range rm.resources {
		list = append(list, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"resources": list,
		"count":     len(list),
	})
}

func (rm *ResourceManager) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path     string  `json:"path"`
		PriceUSD float64 `json:"priceUSD"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.PriceUSD <= 0 || req.PriceUSD > 1000 {
		http.Error(w, `{"error":"price must be between 0.01 and 1000"}`, http.StatusBadRequest)
		return
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	resource, ok := rm.resources[req.Path]
	if !ok {
		http.Error(w, `{"error":"resource not found"}`, http.StatusNotFound)
		return
	}

	// Convert USD to USDC units (6 decimals)
	units := int64(req.PriceUSD * 1e6)
	resource.PriceUSD = req.PriceUSD
	resource.PriceUnits = fmt.Sprintf("%d", units)
	rm.resources[req.Path] = resource

	// Sync to x402 config so middleware uses new prices
	rm.syncPrices()

	log.Printf("[resources] updated %s: $%.2f (%s units)", req.Path, req.PriceUSD, resource.PriceUnits)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "updated",
		"path":     req.Path,
		"priceUSD": req.PriceUSD,
		"units":    resource.PriceUnits,
	})
}

// --- Agent Config Manager ---

type AgentConfigManager struct {
	mu     sync.RWMutex
	config *AgentConfigData
}

type AgentConfigData struct {
	Budget             float64 `json:"budget"`
	Expiry             int     `json:"expiry"`
	ExpiryLabel        string  `json:"expiryLabel"`
	Wallet             string  `json:"wallet"`
	PermissionsContext string  `json:"permissionsContext"`
	Status             string  `json:"status"`
}

func NewAgentConfigManager() *AgentConfigManager {
	return &AgentConfigManager{
		config: &AgentConfigData{Status: "none"},
	}
}

func (ac *AgentConfigManager) HandleGet(w http.ResponseWriter, r *http.Request) {
	ac.mu.RLock()
	defer ac.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ac.config)
}

func (ac *AgentConfigManager) HandlePost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req AgentConfigData
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	ac.mu.Lock()
	defer ac.mu.Unlock()

	if req.Budget > 0 {
		ac.config.Budget = req.Budget
	}
	if req.Expiry > 0 {
		ac.config.Expiry = req.Expiry
	}
	if req.ExpiryLabel != "" {
		ac.config.ExpiryLabel = req.ExpiryLabel
	}
	if req.Wallet != "" {
		ac.config.Wallet = req.Wallet
	}
	if req.PermissionsContext != "" {
		ac.config.PermissionsContext = req.PermissionsContext
	}
	if req.Status != "" {
		ac.config.Status = req.Status
	}

	log.Printf("[agent-config] saved: budget=$%.2f expiry=%s wallet=%s status=%s",
		ac.config.Budget, ac.config.ExpiryLabel, ac.config.Wallet, ac.config.Status)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "saved",
	})
}

// --- Provider Config Manager ---
// Stores the provider's wallet address dynamically (set when provider connects MetaMask).
// This replaces the hardcoded GATEWAY_WALLET from env.

type ProviderConfigManager struct {
	mu     sync.RWMutex
	wallet string
}

func NewProviderConfigManager(defaultWallet string) *ProviderConfigManager {
	return &ProviderConfigManager{wallet: defaultWallet}
}

func (pc *ProviderConfigManager) GetWallet() string {
	pc.mu.RLock()
	defer pc.mu.RUnlock()
	return pc.wallet
}

func (pc *ProviderConfigManager) HandleGet(w http.ResponseWriter, r *http.Request) {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"wallet": pc.wallet,
	})
}

func (pc *ProviderConfigManager) HandlePost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Wallet string `json:"wallet"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.Wallet == "" {
		http.Error(w, `{"error":"wallet is required"}`, http.StatusBadRequest)
		return
	}

	// Whitelist check: only the authorized provider wallet can register
	if !strings.EqualFold(req.Wallet, pc.wallet) {
		log.Printf("[provider-config] REJECTED wallet %s (not whitelisted)", req.Wallet)
		http.Error(w, `{"error":"wallet not authorized as provider"}`, http.StatusForbidden)
		return
	}

	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.wallet = req.Wallet

	log.Printf("[provider-config] updated: wallet=%s", pc.wallet)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "saved",
		"wallet": pc.wallet,
	})
}

// --- Crawl Manager ---
// Manages crawl jobs triggered from the UI.
// Simple: input keyword → agent runs with Venice AI → results shown in UI.

type CrawlJob struct {
	ID        string     `json:"id"`
	Status    string     `json:"status"` // running, completed, failed
	Query     string     `json:"query"`
	Output    string     `json:"output"`
	StartedAt time.Time  `json:"startedAt"`
	DoneAt    *time.Time `json:"doneAt,omitempty"`
}

type CrawlManager struct {
	mu   sync.RWMutex
	jobs []CrawlJob
}

func NewCrawlManager() *CrawlManager {
	return &CrawlManager{
		jobs: []CrawlJob{},
	}
}

func (cm *CrawlManager) HandleCrawl(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var req struct {
			Query string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Query == "" {
			req.Query = "Summarize this week's Asian crypto market sentiment"
		}

		cm.mu.Lock()
		// Prevent duplicate running jobs
		for _, j := range cm.jobs {
			if j.Status == "running" {
				cm.mu.Unlock()
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusConflict)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "agent already running",
					"jobId": j.ID,
				})
				return
			}
		}
		jobID := fmt.Sprintf("crawl-%d", len(cm.jobs)+1)
		now := time.Now()
		job := CrawlJob{
			ID: jobID, Status: "running", Query: req.Query, StartedAt: now,
		}
		cm.jobs = append(cm.jobs, job)
		cm.mu.Unlock()

		query := req.Query

		// Run agent as subprocess (non-blocking).
		// Requires VENICE_API_KEY in the agent's .env (real Venice AI reasoning).
		go func() {
			cmd := exec.Command("npx", "tsx", "src/index.ts", query)
			// Gateway runs from PM2 with cwd=/home/clawuser/PayCrawl
			// So agent path is ./agent/
			cmd.Dir = "./agent"
			cmd.Env = append(os.Environ(), "DOTENVX_QUIET=true")
			// Don't override VENICE_API_KEY — let agent .env decide
			output, err := cmd.CombinedOutput()

			cm.mu.Lock()
			defer cm.mu.Unlock()
			done := time.Now()
			for i := range cm.jobs {
				if cm.jobs[i].ID == jobID {
					cm.jobs[i].DoneAt = &done
					if err != nil {
						cm.jobs[i].Status = "failed"
						cm.jobs[i].Output = string(output) + "\n" + err.Error()
					} else {
						cm.jobs[i].Status = "completed"
						cm.jobs[i].Output = string(output)
					}
					break
				}
			}
		}()

		log.Printf("[crawl] started job %s: %q", jobID, req.Query)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "started",
			"jobId":  jobID,
		})

	case http.MethodGet:
		cm.mu.RLock()
		defer cm.mu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"jobs":  cm.jobs,
			"count": len(cm.jobs),
		})

	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}
