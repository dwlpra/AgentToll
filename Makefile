# AgentToll — Makefile
# Usage:
#   make all          → start semua services (background)
#   make agent        → run agent (foreground, tunggu output)
#   make stop         → stop semua services
#   make status       → cek semua services running atau tidak
#   make test         → run semua tests
#   make clean        → kill semua + hapus build artifacts
#   make demo         → full demo: start services, tunggu, run agent

# Colors
CYAN  := \033[36m
GREEN := \033[32m
YELLOW:= \033[33m
RED   := \033[31m
RESET := \033[0m
BOLD  := \033[1m

# Ports
MOCK_PORT   := 18091
GATEWAY_PORT:= 19090
UI_PORT     := 5173

# PID files
PID_DIR     := .pids
MOCK_PID    := $(PID_DIR)/mock-api.pid
GATEWAY_PID := $(PID_DIR)/gateway.pid
UI_PID      := $(PID_DIR)/ui.pid

.PHONY: all install mock gateway ui agent stop status test clean demo logs help mainnet mainnet-stop mainnet-demo

help: ## Tampilkan help
	@echo ""
	@echo "$(BOLD)$(CYAN)AgentToll — Perintah yang tersedia:$(RESET)"
	@echo ""
	@echo "  $(GREEN)make all$(RESET)          Start semua services (background)"
	@echo "  $(GREEN)make demo$(RESET)         Full demo: start services + run agent"
	@echo "  $(GREEN)make agent$(RESET)        Run agent dengan Venice AI (foreground)"
	@echo "  $(GREEN)make stop$(RESET)         Stop semua services"
	@echo "  $(GREEN)make restart$(RESET)      Restart semua services"
	@echo "  $(GREEN)make status$(RESET)       Cek status semua services"
	@echo "  $(GREEN)make test$(RESET)         Run semua tests"
	@echo "  $(GREEN)make logs$(RESET)         Tampilkan log semua services"
	@echo "  $(GREEN)make clean$(RESET)        Stop semua + hapus artifacts"
	@echo "  $(GREEN)make install$(RESET)      Install semua dependencies"
	@echo "  $(GREEN)make check$(RESET)        Cek prerequisites (Go, Node, env)"
	@echo ""
	@echo "$(BOLD)$(YELLOW)Mainnet (Base):$(RESET)"
	@echo "  $(GREEN)make mainnet$(RESET)      Switch ke mainnet config"
	@echo "  $(GREEN)make mainnet-demo$(RESET)  Run demo di mainnet"
	@echo "  $(GREEN)make mainnet-stop$(RESET)  Stop + switch balik ke testnet"
	@echo ""

install: ## Install dependencies
	@echo "$(CYAN)Installing agent dependencies...$(RESET)"
	cd agent && npm install
	@echo "$(CYAN)Installing UI dependencies...$(RESET)"
	cd ui && npm install
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

$(PID_DIR):
	@mkdir -p $(PID_DIR)

# ── Individual Services ──────────────────────────────────────

mock: $(PID_DIR) ## Start mock API
	@echo "$(CYAN)Starting mock-api on :$(MOCK_PORT)...$(RESET)"
	@cd mock-api && go run . > ../$(PID_DIR)/mock-api.log 2>&1 & echo $$! > $(MOCK_PID)
	@sleep 1
	@curl -sf http://localhost:$(MOCK_PORT)/catalog > /dev/null 2>&1 && echo "$(GREEN)✓ mock-api running (PID $$(cat $(MOCK_PID)))$(RESET)" || echo "$(RED)✗ mock-api failed to start$(RESET)"

gateway: $(PID_DIR) ## Start gateway
	@echo "$(CYAN)Starting gateway on :$(GATEWAY_PORT)...$(RESET)"
	@cd gateway && go run . > ../$(PID_DIR)/gateway.log 2>&1 & echo $$! > $(GATEWAY_PID)
	@sleep 2
	@curl -sf http://localhost:$(GATEWAY_PORT)/health > /dev/null 2>&1 && echo "$(GREEN)✓ gateway running (PID $$(cat $(GATEWAY_PID)))$(RESET)" || echo "$(RED)✗ gateway failed to start$(RESET)"

ui: $(PID_DIR) ## Start React UI (Vite dev server)
	@echo "$(CYAN)Starting React UI on :$(UI_PORT)...$(RESET)"
	@cd ui && npx vite --host > ../$(PID_DIR)/ui.log 2>&1 & echo $$! > $(UI_PID)
	@sleep 3
	@curl -sf http://localhost:$(UI_PORT) > /dev/null 2>&1 && echo "$(GREEN)✓ React UI running (PID $$(cat $(UI_PID)))$(RESET)" || echo "$(YELLOW)⚠ UI may still be starting$(RESET)"

# ── Combined Commands ────────────────────────────────────────

all: $(PID_DIR) ## Start semua services
	@echo ""
	@echo "$(BOLD)$(CYAN)═══ AgentToll — Starting All Services ═══$(RESET)"
	@echo ""
	@$(MAKE) mock
	@$(MAKE) gateway
	@$(MAKE) ui
	@echo ""
	@echo "$(BOLD)$(GREEN)All services started!$(RESET)"
	@echo ""
	@echo "  Mock API:      http://localhost:$(MOCK_PORT)/catalog"
	@echo "  Gateway:       http://localhost:$(GATEWAY_PORT)/health"
	@echo "  Dashboard:     http://localhost:$(GATEWAY_PORT)/dashboard"
	@echo "  React UI:      http://localhost:$(UI_PORT)"
	@echo ""
	@echo "$(YELLOW)Open the React UI, connect MetaMask, grant permissions, then run the agent.$(RESET)"
	@echo "$(YELLOW)Run 'make agent' to start the agent (or 'make demo' for full flow).$(RESET)"
	@echo ""

stop: ## Stop semua services
	@echo "$(YELLOW)Stopping all services...$(RESET)"
	@for pidfile in $(MOCK_PID) $(GATEWAY_PID) $(UI_PID); do \
		if [ -f "$$pidfile" ]; then \
			pid=$$(cat $$pidfile 2>/dev/null); \
			if [ -n "$$pid" ] && kill -0 $$pid 2>/dev/null; then \
				kill $$pid 2>/dev/null && echo "$(GREEN)✓ Stopped PID $$pid ($$pidfile)$(RESET)"; \
			else \
				echo "$(DIM)  Already stopped ($$pidfile)$(RESET)"; \
			fi; \
			rm -f $$pidfile; \
		fi; \
	done
	@# Also kill any lingering processes on our ports
	@for port in $(MOCK_PORT) $(GATEWAY_PORT) $(UI_PORT); do \
		pid=$$(lsof -ti :$$port 2>/dev/null); \
		if [ -n "$$pid" ]; then \
			kill $$pid 2>/dev/null && echo "$(GREEN)✓ Killed process on port $$port$(RESET)"; \
		fi; \
	done
	@echo "$(GREEN)✓ All stopped$(RESET)"

restart: stop ## Restart semua services
	@sleep 1
	@$(MAKE) all

status: ## Cek status semua services
	@echo ""
	@echo "$(BOLD)$(CYAN)═══ AgentToll — Service Status ═══$(RESET)"
	@echo ""
	@for name in "mock-api" "gateway" "react-ui"; do \
		case $$name in \
			mock-api)   port=$(MOCK_PORT);; \
			gateway)    port=$(GATEWAY_PORT);; \
			react-ui)   port=$(UI_PORT);; \
		esac; \
		if curl -sf http://localhost:$$port > /dev/null 2>&1; then \
			echo "  $(GREEN)✓ $$name$(RESET) — running on :$$port"; \
		else \
			echo "  $(RED)✗ $$name$(RESET) — NOT running on :$$port"; \
		fi; \
	done
	@echo ""

logs: ## Tampilkan log semua services
	@echo "$(CYAN)═══ mock-api.log ═══$(RESET)"
	@[ -f $(PID_DIR)/mock-api.log ] && cat $(PID_DIR)/mock-api.log | tail -20 || echo "(no log)"
	@echo ""
	@echo "$(CYAN)═══ gateway.log ═══$(RESET)"
	@[ -f $(PID_DIR)/gateway.log ] && cat $(PID_DIR)/gateway.log | tail -20 || echo "(no log)"
	@echo ""
	@echo "$(CYAN)═══ ui.log ═══$(RESET)"
	@[ -f $(PID_DIR)/ui.log ] && cat $(PID_DIR)/ui.log | tail -20 || echo "(no log)"

# ── Agent ────────────────────────────────────────────────────

agent: ## Run agent dengan Venice AI
	@cd agent && npx tsx src/index.ts "$(QUERY)"

# ── Demo ─────────────────────────────────────────────────────

demo: ## Full demo: start services + run agent (live)
	@$(MAKE) stop 2>/dev/null
	@$(MAKE) all
	@echo ""
	@echo "$(BOLD)$(YELLOW)Running agent (live, real Venice AI + on-chain payments)...$(RESET)"
	@echo ""
	@sleep 2
	@cd agent && npx tsx src/index.ts
	@echo ""
	@echo "$(BOLD)$(GREEN)Demo complete! Check dashboard: http://localhost:$(GATEWAY_PORT)/dashboard$(RESET)"

# ── Test ─────────────────────────────────────────────────────

test: ## Run semua tests (start services, test, stop)
	@echo "$(CYAN)Starting services for testing...$(RESET)"
	@$(MAKE) all
	@sleep 3
	@echo ""
	@echo "$(CYAN)Running gateway tests...$(RESET)"
	@cd gateway && go test ./... -v
	@echo ""
	@echo "$(CYAN)Running agent tests...$(RESET)"
	@cd agent && npx vitest run
	@echo ""
	@$(MAKE) stop

test-go: ## Run Go tests saja
	@cd gateway && go test ./... -v

test-ts: ## Run TypeScript tests saja (need services running)
	@cd agent && npx vitest run

# ── Utility ──────────────────────────────────────────────────

check: ## Cek prerequisites
	@echo ""
	@echo "$(BOLD)$(CYAN)═══ Prerequisites Check ═══$(RESET)"
	@echo ""
	@which go > /dev/null 2>&1 && echo "  $(GREEN)✓ Go$(RESET) ($$(go version))" || echo "  $(RED)✗ Go not found$(RESET) — install from go.dev/dl"
	@which node > /dev/null 2>&1 && echo "  $(GREEN)✓ Node.js$(RESET) ($$(node --version))" || echo "  $(RED)✗ Node.js not found$(RESET) — install from nodejs.org"
	@which npx > /dev/null 2>&1 && echo "  $(GREEN)✓ npx$(RESET)" || echo "  $(RED)✗ npx not found$(RESET)"
	@[ -f agent/node_modules/.package-lock.json ] && echo "  $(GREEN)✓ node_modules$(RESET) (installed)" || echo "  $(YELLOW)⚠ node_modules missing$(RESET) — run 'make install'"
	@[ -f agent/.env ] && echo "  $(GREEN)✓ .env$(RESET) (found)" || echo "  $(RED)✗ .env not found$(RESET) — copy from .env.example"
	@grep -q "VENICE_API_KEY=.\+" agent/.env 2>/dev/null && echo "  $(GREEN)✓ VENICE_API_KEY$(RESET) (set)" || echo "  $(YELLOW)⚠ VENICE_API_KEY$(RESET) (empty — mock mode only)"
	@echo ""

clean: stop ## Stop semua + hapus build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	rm -rf $(PID_DIR)
	rm -rf agent/dist
	@echo "$(GREEN)✓ Clean$(RESET)"

# Dashboard shortcut
dashboard: ## Open dashboard in browser
	@open http://localhost:$(GATEWAY_PORT)/dashboard 2>/dev/null || xdg-open http://localhost:$(GATEWAY_PORT)/dashboard 2>/dev/null || echo "Open manually: http://localhost:$(GATEWAY_PORT)/dashboard"

# ── Mainnet (Base) ─────────────────────────────────────────

mainnet: ## Switch agent ke mainnet config (backup testnet .env)
	@echo "$(YELLOW)Switching to mainnet config...$(RESET)"
	@[ -f agent/.env ] && cp agent/.env agent/.env.testnet.bak && echo "$(GREEN)✓ Testnet .env backed up to agent/.env.testnet.bak$(RESET)"
	@cp agent/.env.mainnet agent/.env
	@echo "$(GREEN)✓ Switched to mainnet$(RESET)"
	@echo ""
	@echo "$(BOLD)$(YELLOW)IMPORTANT: Edit agent/.env with your real wallets and API keys!$(RESET)"
	@echo ""
	@echo "  Required changes in agent/.env:"
	@echo "    AGENT_WALLET=0xYourWalletWithUSDC"
	@echo "    PROVIDER_WALLET=0xYourProviderWallet"
	@echo "    VENICE_API_KEY=your_real_key"
	@echo ""
	@echo "  Also set gateway env vars before starting:"
	@echo "    export GATEWAY_WALLET=0xYourProviderWallet"
	@echo "    export GATEWAY_SECRET=your-secret"
	@echo "    export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
	@echo ""
	@echo "$(YELLOW)Then: make stop && make all$(RESET)"
	@echo "$(YELLOW)Re-grant permissions on Base mainnet via React UI (http://localhost:5173)$(RESET)"

mainnet-stop: ## Stop services + switch balik ke testnet
	@$(MAKE) stop
	@if [ -f agent/.env.testnet.bak ]; then \
		cp agent/.env.testnet.bak agent/.env; \
		echo "$(GREEN)✓ Switched back to testnet config$(RESET)"; \
		rm -f agent/.env.testnet.bak; \
	else \
		echo "$(YELLOW)⚠ No testnet backup found — staying on current config$(RESET)"; \
	fi

mainnet-demo: ## Run demo di mainnet (start + agent)
	@$(MAKE) stop 2>/dev/null
	@echo "$(BOLD)$(YELLOW)═══ MAINNET MODE — Real USDC on Base ═══$(RESET)"
	@echo ""
	@$(MAKE) all
	@sleep 2
	@echo ""
	@echo "$(BOLD)$(YELLOW)Running agent (live mode, mainnet)...$(RESET)"
	@echo ""
	@cd agent && npx tsx src/index.ts
	@echo ""
	@echo "$(BOLD)$(GREEN)Done! Check dashboard: http://localhost:$(GATEWAY_PORT)/dashboard$(RESET)"
	@echo "$(YELLOW)Verify transactions: https://basescan.org$(RESET)"
