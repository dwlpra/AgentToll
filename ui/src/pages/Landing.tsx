import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Zap, ArrowRight, LayoutDashboard, Bot, Shield, DollarSign,
  BarChart3, Wallet, FileText, Play, CheckCircle2, ChevronRight,
  Globe, Cpu, Link2, Activity,
} from 'lucide-react'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
}
const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

const TECH_BADGES = [
  { label: 'Base', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { label: 'MetaMask SAK', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { label: 'ERC-7715', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { label: '1Shot Relayer', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { label: 'Venice AI', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  { label: 'x402 Protocol', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
]

const FLOW_STEPS = [
  {
    num: '01',
    icon: Wallet,
    title: 'Connect & Grant',
    desc: 'Connect MetaMask, set budget, sign one ERC-7715 permission grant.',
    color: 'brand',
  },
  {
    num: '02',
    icon: Cpu,
    title: 'Agent Reasons',
    desc: 'Venice AI evaluates data value across 4 phases: Scout → Buyer → Analyst → Synthesis.',
    color: 'accent',
  },
  {
    num: '03',
    icon: Play,
    title: 'Autonomous Pay',
    desc: 'Agent pays gaslessly via 1Shot Relayer + ERC-7710. No popup, fully autonomous.',
    color: 'emerald',
  },
  {
    num: '04',
    icon: CheckCircle2,
    title: 'Data Delivered',
    desc: 'Provider receives USDC on-chain. Agent gets premium data. All verifiable on Basescan.',
    color: 'amber',
  },
]

const LIVE_LINES = [
  { text: '[SCOUT] asia-daily score 92/100 --> BUY', color: 'text-emerald-400' },
  { text: '[BUYER] paying 0.10 USDC via 1Shot relayer...', color: 'text-blue-400' },
  { text: '[TX] confirmed: 0x9f2e...a3b1 on Base', color: 'text-emerald-400' },
  { text: '[ANALYST] quality 88/100 -- EXCELLENT VALUE', color: 'text-cyan-400' },
  { text: '[SCOUT] quick-take score 28/100 --> SKIP', color: 'text-yellow-400' },
  { text: '[SYNTHESIS] "Asian crypto sentiment bullish..."', color: 'text-purple-400' },
]

export function Landing() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-accent-500/5 rounded-full blur-[100px] animate-float-delay" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/3 rounded-full blur-[150px]" />
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 relative">
          <motion.div variants={container} initial="hidden" animate="show" className="text-center">
            {/* Badges */}
            <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {TECH_BADGES.map((b) => (
                <span key={b.label} className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold border ${b.color}`}>
                  {b.label}
                </span>
              ))}
            </motion.div>

            {/* Title */}
            <motion.h1 variants={item} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
              <span className="text-white">AI Agents That</span>
              <br />
              <span className="gradient-text animate-gradient-shift" style={{
                backgroundSize: '200% 200%',
                backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4, #8b5cf6, #3b82f6)',
              }}>
                Pay for Data
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={item} className="text-lg text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              The first autonomous pay-per-crawl protocol. Venice AI reasons about data value,
              MetaMask Smart Accounts authorize spending, and 1Shot Relayer executes gasless
              payments — all on Base mainnet.
            </motion.p>

            {/* CTA buttons */}
            <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/agent"
                className="neon-btn flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold text-white"
              >
                <Bot className="w-4 h-4" />
                Start Agent
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/provider"
                className="flex items-center gap-2 px-6 py-3.5 glass glass-hover rounded-xl text-sm font-semibold text-white"
              >
                <LayoutDashboard className="w-4 h-4" />
                Provider Dashboard
              </Link>
              <Link
                to="/articles"
                className="flex items-center gap-2 px-6 py-3.5 glass glass-hover rounded-xl text-sm font-semibold text-surface-300 hover:text-white"
              >
                <FileText className="w-4 h-4" />
                Read Articles
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ LIVE PREVIEW (terminal) ═══ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="console-bg rounded-2xl overflow-hidden"
        >
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-200/30">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs text-surface-500 font-mono">paycrawl-agent — live session</span>
          </div>
          {/* Terminal body */}
          <div className="p-5 space-y-1.5 text-[12px] font-mono">
            <p className="text-surface-500">╔═══════════════════════════════════════════════╗</p>
            <p className="text-cyan-400 font-bold">  PayCrawl — Multi-Agent Venice AI Pipeline</p>
            <p className="text-surface-500">╚═══════════════════════════════════════════════╝</p>
            <p className="text-surface-400 mt-2">Query: "Asian crypto market sentiment"</p>
            <p className="text-surface-400">Budget: $1.00 USDC | Mode: live | Chain: Base</p>
            <p className="text-surface-500 mt-3">── Phase 1: SCOUT ──────────────────────────</p>
            {LIVE_LINES.slice(0, 2).map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.3 }}
                viewport={{ once: true }}
                className={line.color}
              >
                {line.text}
              </motion.p>
            ))}
            <p className="text-surface-500 mt-3">── Phase 2: BUYER ──────────────────────────</p>
            {LIVE_LINES.slice(2, 3).map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.3 }}
                viewport={{ once: true }}
                className={line.color}
              >
                {line.text}
              </motion.p>
            ))}
            <p className="text-surface-500 mt-3">── Phase 3: ANALYST ────────────────────────</p>
            <p className={LIVE_LINES[3].color}>{LIVE_LINES[3].text}</p>
            <p className="text-surface-500 mt-3">── Phase 4: SYNTHESIS ──────────────────────</p>
            <p className={LIVE_LINES[5].color}>{LIVE_LINES[5].text}</p>
            <p className="text-surface-500 mt-2">──────────────────────────────────────────────</p>
            <p className="text-emerald-400 font-bold">
              ✓ Total spent: $0.70 | Resources: 2/3 | Budget remaining: $0.30
            </p>
            <p className="text-surface-500 mt-1">
              <span className="animate-blink text-brand-400">▊</span>
            </p>
          </div>
        </motion.div>
      </section>

      {/* ═══ HOW IT WORKS (4 steps) ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-extrabold text-white mb-3">How It Works</h2>
          <p className="text-sm text-surface-400">One permission grant, then fully autonomous</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FLOW_STEPS.map((step, i) => {
            const Icon = step.icon
            const colorMap: Record<string, string> = {
              brand: 'from-brand-500 to-brand-600 shadow-brand-500/20',
              accent: 'from-accent-500 to-cyan-500 shadow-accent-500/20',
              emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
              amber: 'from-amber-500 to-orange-500 shadow-amber-500/20',
            }
            const iconColorMap: Record<string, string> = {
              brand: 'text-brand-400 bg-brand-500/10',
              accent: 'text-accent-400 bg-accent-500/10',
              emerald: 'text-emerald-400 bg-emerald-500/10',
              amber: 'text-amber-400 bg-amber-500/10',
            }
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="glass rounded-2xl p-6 relative group glass-hover"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconColorMap[step.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="absolute top-4 right-4 text-3xl font-extrabold text-surface-200/30">{step.num}</div>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-surface-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ═══ TWO ROLES ═══ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Provider */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/provider" className="block glass rounded-2xl p-8 glass-hover group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-brand-600 rounded-t-2xl" />
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-5 group-hover:bg-brand-500/20 transition-colors">
                <LayoutDashboard className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Data Provider</h3>
              <p className="text-sm text-surface-400 mb-5 leading-relaxed">
                List paid resources, set prices, and track revenue in real-time.
                Your wallet receives USDC payments directly on-chain.
              </p>
              <ul className="space-y-3">
                {[
                  { icon: Wallet, text: 'Connect MetaMask — dynamic payment recipient' },
                  { icon: DollarSign, text: 'Set prices per resource ($0.10 - $0.60)' },
                  { icon: BarChart3, text: 'Live revenue chart & purchase history' },
                  { icon: Activity, text: 'On-chain USDC balance — verifiable' },
                ].map(({ icon: I, text }) => (
                  <li key={text} className="flex items-center gap-3 text-xs text-surface-300">
                    <I className="w-4 h-4 text-brand-400/60 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1 mt-6 text-xs font-semibold text-brand-400 group-hover:text-brand-300 transition-colors">
                Open Dashboard <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </motion.div>

          {/* Agent */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/agent" className="block glass rounded-2xl p-8 glass-hover group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-500 to-cyan-500 rounded-t-2xl" />
              <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex items-center justify-center mb-5 group-hover:bg-accent-500/20 transition-colors">
                <Bot className="w-6 h-6 text-accent-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">AI Agent</h3>
              <p className="text-sm text-surface-400 mb-5 leading-relaxed">
                Configure budget, grant spending permissions, then watch the agent
                crawl and buy data autonomously with Venice AI reasoning.
              </p>
              <ul className="space-y-3">
                {[
                  { icon: Wallet, text: 'Connect MetaMask — dynamic agent wallet' },
                  { icon: Shield, text: 'Grant ERC-7715 permissions (one MetaMask popup)' },
                  { icon: Globe, text: 'Enter keyword, click Start Crawl' },
                  { icon: Zap, text: 'Venice AI decides: buy or skip each resource' },
                ].map(({ icon: I, text }) => (
                  <li key={text} className="flex items-center gap-3 text-xs text-surface-300">
                    <I className="w-4 h-4 text-accent-400/60 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1 mt-6 text-xs font-semibold text-accent-400 group-hover:text-accent-300 transition-colors">
                Setup Agent <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ TECH STACK ═══ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-8 text-center"
        >
          <h3 className="text-lg font-bold text-white mb-6">Built With</h3>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { name: 'MetaMask Smart Accounts Kit', desc: 'ERC-7715 Permissions' },
              { name: '1Shot Permissionless Relayer', desc: 'Gasless ERC-7710' },
              { name: 'Venice AI', desc: 'Multi-Agent Reasoning' },
              { name: 'x402 Protocol', desc: 'HTTP 402 Paywall' },
              { name: 'Base', desc: 'L2 Mainnet' },
              { name: 'USDC', desc: 'Stablecoin Payments' },
            ].map((tech) => (
              <div key={tech.name} className="px-4 py-2.5 bg-surface-50/50 rounded-xl border border-surface-200/30">
                <p className="text-xs font-semibold text-white">{tech.name}</p>
                <p className="text-[10px] text-surface-500">{tech.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-surface-200/20 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">PayCrawl</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-surface-500">
            <a href="https://x402.org" target="_blank" className="hover:text-surface-300 transition-colors">x402 Protocol</a>
            <span>·</span>
            <a href="https://docs.metamask.io/smart-accounts-kit/" target="_blank" className="hover:text-surface-300 transition-colors">MetaMask SAK</a>
            <span>·</span>
            <a href="https://venice.ai" target="_blank" className="hover:text-surface-300 transition-colors">Venice AI</a>
          </div>
          <p className="text-xs text-surface-500">
            MetaMask Smart Accounts × 1Shot × Venice AI
          </p>
        </div>
      </footer>
    </div>
  )
}
