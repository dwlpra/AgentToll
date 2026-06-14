import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWalletClient } from 'wagmi'
import { baseSepolia, base } from 'wagmi/chains'
import {
  Wallet, Shield, Zap, AlertTriangle, Loader2, CheckCircle2, ArrowRight,
  Play, Terminal, ChevronRight, Clock, DollarSign, Bot, Activity,
  FileText, ExternalLink,
} from 'lucide-react'
import { BudgetSlider } from '../components/BudgetSlider'
import { ExpirySelect, EXPIRY_OPTIONS } from '../components/ExpirySelect'
import { PermissionStatus } from '../components/PermissionStatus'
import { useGatewayApi } from '../hooks/useGatewayApi'

const CHAIN_CONFIG: Record<number, { name: string }> = {
  84532: { name: 'Base Sepolia' },
  8453: { name: 'Base' },
}

export function AgentBridge() {
  const { address, chainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { agentConfig, saveAgentConfig, crawlJobs, startCrawl } = useGatewayApi()

  const [budget, setBudget] = useState(agentConfig?.budget ?? 1.0)
  const [expiry, setExpiry] = useState(agentConfig?.expiry ?? EXPIRY_OPTIONS[3].seconds)
  const [granting, setGranting] = useState(false)
  const [grantResult, setGrantResult] = useState<'success' | 'error' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [crawlQuery, setCrawlQuery] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const supportedChain = chainId === 84532 || chainId === 8453
  const chainName = CHAIN_CONFIG[chainId ?? 8453]?.name ?? 'Base'
  const latestJob = crawlJobs.length > 0 ? crawlJobs[crawlJobs.length - 1] : null
  const isRunning = latestJob?.status === 'running'
  const permissionsGranted = agentConfig?.status === 'active'

  // Auto-advance step indicators
  useEffect(() => {
    if (!address) setActiveStep(0)
    else if (!permissionsGranted) setActiveStep(1)
    else if (!latestJob || latestJob.status !== 'running') setActiveStep(2)
    else setActiveStep(3)
  }, [address, permissionsGranted, latestJob])

  const handleGrantPermissions = useCallback(async () => {
    if (!walletClient || !address || !supportedChain) return
    setGranting(true)
    setGrantResult(null)
    setErrorMsg('')
    try {
      const { erc7715ProviderActions } = await import('@metamask/smart-accounts-kit/actions')
      const chain = chainId === 8453 ? base : baseSepolia
      const extendedClient = walletClient.extend(erc7715ProviderActions())
      const now = Math.floor(Date.now() / 1000)
      const expiryTimestamp = now + expiry
      const usdcAddress = chainId === 8453
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`
      const budgetUnits = BigInt(Math.round(budget * 1_000_000))
      const granted = await (extendedClient as any).grantPermissions([{
        chainId: chain.id,
        expiry: expiryTimestamp,
        signer: { type: 'account', data: { address } },
        permission: {
          type: 'erc20-token-periodic',
          data: {
            tokenAddress: usdcAddress,
            periodAmount: budgetUnits,
            periodDuration: 86400,
            startTime: now,
            justification: `PayCrawl: $${budget.toFixed(2)} USDC/day budget for autonomous data purchases`,
          },
        },
      }])
      const expiryLabel = EXPIRY_OPTIONS.find((o) => o.seconds === expiry)?.label ?? `${expiry}s`
      const context = typeof granted === 'string' ? granted : JSON.stringify(granted)
      await saveAgentConfig({
        budget, expiry, expiryLabel, wallet: address,
        permissionsContext: context, status: 'active',
      })
      setGrantResult('success')
    } catch (err: any) {
      setGrantResult('error')
      setErrorMsg(err?.message || err?.toString() || 'Failed to grant permissions')
    } finally {
      setGranting(false)
    }
  }, [walletClient, address, chainId, budget, expiry, supportedChain, saveAgentConfig])

  const handleStartCrawl = useCallback(async () => {
    setCrawling(true)
    await startCrawl(crawlQuery || undefined)
    setCrawling(false)
  }, [crawlQuery, startCrawl])

  // Not connected
  if (!address) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-accent-500" />
          <div className="w-16 h-16 rounded-2xl bg-accent-500/10 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-accent-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-sm text-surface-400 max-w-md mx-auto">
            Connect MetaMask Flask to grant spending permissions and start the autonomous crawl agent.
          </p>
          <p className="text-xs text-surface-500 mt-4">
            Use the wallet button in the top right corner.
          </p>
        </motion.div>
      </div>
    )
  }

  const STEPS = [
    { label: 'Connect', icon: Wallet, done: true },
    { label: 'Configure', icon: Shield, done: permissionsGranted },
    { label: 'Crawl', icon: Play, done: latestJob?.status === 'completed' },
    { label: 'Results', icon: FileText, done: false },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ═══ Header ═══ */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white">Agent Setup</h1>
        <p className="text-sm text-surface-400 mt-1">
          Configure, grant permissions, and start crawling — all from one page
        </p>
      </div>

      {/* ═══ Step Indicator ═══ */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isActive = i === activeStep
          const isDone = step.done && i < activeStep
          return (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  isActive ? 'step-active text-white' :
                  isDone ? 'step-done text-white' :
                  'step-pending text-surface-500'
                }`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${isActive ? 'text-white' : 'text-surface-500'}`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-surface-500/50 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* ═══ Chain Warning ═══ */}
      <AnimatePresence>
        {!supportedChain && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Wrong Network</p>
                <p className="text-xs text-surface-400">Switch to Base (mainnet) or Base Sepolia (testnet).</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ STEP 1-2: Configure ═══ */}
      <div className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-accent-500" />
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">Step 1 — Budget & Permissions</h3>
          {permissionsGranted && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full">
              ✓ GRANTED
            </span>
          )}
        </div>

        {/* Wallet info */}
        <div className="flex items-center gap-3 mb-5 bg-surface-50/50 rounded-xl p-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-brand-400" />
          </div>
          <div>
            <p className="text-xs text-surface-500">Connected Wallet</p>
            <p className="text-sm font-mono font-semibold text-white">
              {address.slice(0, 6)}...{address.slice(-4)}
              <span className="text-surface-500 ml-2 text-[10px]">{chainName}</span>
            </p>
          </div>
        </div>

        {/* Budget + Expiry */}
        <div className="mb-5">
          <label className="text-xs text-surface-400 mb-1.5 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Daily Budget
          </label>
          <BudgetSlider value={budget} onChange={setBudget} disabled={!supportedChain || granting} />
        </div>
        <div className="mb-5">
          <label className="text-xs text-surface-400 mb-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Permission Expiry
          </label>
          <ExpirySelect value={expiry} onChange={setExpiry} disabled={!supportedChain || granting} />
        </div>

        <PermissionStatus config={agentConfig} />

        {/* Grant button */}
        <button
          onClick={handleGrantPermissions}
          disabled={!supportedChain || granting}
          className="w-full mt-5 flex items-center justify-center gap-2 px-5 py-3.5 neon-btn rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {granting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Granting via MetaMask...</>
          ) : permissionsGranted ? (
            <><CheckCircle2 className="w-4 h-4" /> Permissions Active — Re-grant</>
          ) : (
            <><Shield className="w-4 h-4" /> Grant Permissions (ERC-7715) <ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        {/* Result */}
        <AnimatePresence>
          {grantResult === 'success' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} className="mt-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400">Agent authorized to spend up to <b>${budget.toFixed(2)}</b> USDC/day autonomously.</p>
            </motion.div>
          )}
          {grantResult === 'error' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} className="mt-4 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{errorMsg || 'Check MetaMask Flask and network.'}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ STEP 3: Crawl ═══ */}
      <div className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500" />
        <div className="flex items-center gap-2 mb-5">
          <Play className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Step 2 — Start Crawl</h3>
          {isRunning && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
            </span>
          )}
        </div>

        <p className="text-xs text-surface-400 mb-4">
          Enter a keyword. The agent uses Venice AI to reason about data value, decides which
          resources to buy, pays gaslessly via MetaMask Smart Accounts, and synthesizes a report.
        </p>

        {/* Query input */}
        <div className="mb-4">
          <input
            type="text"
            value={crawlQuery}
            onChange={(e) => setCrawlQuery(e.target.value)}
            placeholder="e.g. Asian crypto market sentiment this week"
            className="w-full px-4 py-3 bg-surface-50/80 rounded-xl text-sm text-white placeholder-surface-500 border border-surface-200/50 focus:border-emerald-500/50 focus:outline-none transition-colors font-mono"
            onKeyDown={(e) => { if (e.key === 'Enter' && !isRunning && !crawling) handleStartCrawl() }}
          />
        </div>

        {/* Start button */}
        <button
          onClick={handleStartCrawl}
          disabled={isRunning || crawling}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isRunning || crawling ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Agent Running...</>
          ) : (
            <><Play className="w-4 h-4" /> Start Crawl</>
          )}
        </button>
      </div>

      {/* ═══ Console Output ═══ */}
      <AnimatePresence>
        {latestJob && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} className="console-bg rounded-2xl overflow-hidden mb-6">
            {/* Console header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-200/20">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                <span className="ml-2 text-[10px] text-surface-500 font-mono">
                  {latestJob.id}: "{latestJob.query}"
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                latestJob.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                latestJob.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                'bg-yellow-500/10 text-yellow-400'
              }`}>
                {latestJob.status === 'running' ? '● LIVE' : latestJob.status.toUpperCase()}
              </span>
            </div>
            {/* Console body */}
            <div className="p-4 max-h-80 overflow-auto">
              {latestJob.output ? (
                <pre className="text-[11px] text-surface-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {latestJob.output.slice(-3000)}
                </pre>
              ) : (
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Waiting for output...
                </div>
              )}
              {latestJob.status === 'running' && (
                <span className="animate-blink text-brand-400 text-sm">▊</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ CLI Fallback ═══ */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-surface-400" />
          <h3 className="text-sm font-semibold text-surface-300">Or run from terminal</h3>
        </div>
        <div className="console-bg rounded-lg p-3 font-mono text-[11px] text-surface-400">
          <p className="text-surface-500 mb-1"># Start all services</p>
          <p className="text-white">make all</p>
          <p className="text-surface-500 mb-1 mt-2"># Run agent with Venice AI</p>
          <p className="text-white">cd agent && npx tsx src/index.ts "Asian crypto sentiment"</p>
        </div>
      </div>
    </motion.div>
  )
}
