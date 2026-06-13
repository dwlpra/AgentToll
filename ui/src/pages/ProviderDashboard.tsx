import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'
import {
  Wallet, DollarSign, BarChart3, TrendingUp, RefreshCw, ExternalLink, Coins,
  CheckCircle2, Activity, ShoppingBag,
} from 'lucide-react'
import { useUsdcBalance } from '../hooks/useUsdcBalance'
import { useGatewayApi } from '../hooks/useGatewayApi'
import { ResourceCard } from '../components/ResourceCard'
import { RevenueChart } from '../components/RevenueChart'
import { PurchaseTable } from '../components/PurchaseTable'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export function ProviderDashboard() {
  const { address, chainId } = useAccount()
  const { balance, refetch: refetchBalance } = useUsdcBalance()
  const {
    resources, dashboard, updateResourcePrice, refreshAll, loading,
    providerWallet, saveProviderWallet,
  } = useGatewayApi()
  const [walletSaved, setWalletSaved] = useState(false)

  const explorer = chainId === 8453 ? 'basescan.org' : 'sepolia.basescan.org'
  const purchases = dashboard?.purchases ?? []
  const revenue = dashboard?.revenue ?? '0.00'

  // Auto-save provider wallet
  useEffect(() => {
    if (address && address !== providerWallet) {
      saveProviderWallet(address).then((ok) => { if (ok) setWalletSaved(true) })
    } else if (address === providerWallet) {
      setWalletSaved(true)
    }
  }, [address, providerWallet, saveProviderWallet])

  if (!address) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-brand-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect Provider Wallet</h2>
          <p className="text-sm text-surface-400 max-w-md mx-auto">
            Connect MetaMask to register as payment recipient. Your wallet receives USDC
            when agents buy your resources. All on Base mainnet.
          </p>
          <p className="text-xs text-surface-500 mt-4">
            Use the wallet button in the top right to connect.
          </p>
        </motion.div>
      </div>
    )
  }

  const stats = [
    {
      label: 'On-chain Balance',
      value: `$${balance}`,
      sub: 'USDC',
      icon: Coins,
      gradient: 'from-blue-500 to-cyan-500',
      iconBg: 'bg-brand-500/10',
      iconColor: 'text-brand-400',
    },
    {
      label: 'Total Revenue',
      value: revenue,
      sub: 'USDC earned',
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-cyan-500',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Purchases',
      value: String(purchases.length),
      sub: 'agent buys',
      icon: ShoppingBag,
      gradient: 'from-amber-500 to-orange-500',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
    },
    {
      label: 'Active Resources',
      value: String(resources.length),
      sub: 'listed',
      icon: BarChart3,
      gradient: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
    },
  ]

  return (
    <motion.div variants={container} initial="hidden" animate="show"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Provider Dashboard</h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage resources, track revenue, receive payments
          </p>
          {walletSaved && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Wallet registered as payment recipient</span>
            </div>
          )}
        </div>
        <button
          onClick={() => { refreshAll(); refetchBalance() }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 glass glass-hover rounded-xl text-xs text-surface-400 hover:text-white transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="glass rounded-2xl p-5 relative overflow-hidden group glass-hover">
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${stat.gradient}`} />
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${stat.iconColor}`} />
                </div>
                <span className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-white">{stat.value}</span>
                <span className="text-[10px] text-surface-500">{stat.sub}</span>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Resources + Purchases */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={item}>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-brand-400" />
              <h2 className="text-base font-bold text-white">Manage Resources</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {resources.length > 0 ? (
                resources.map((r) => (
                  <ResourceCard key={r.path} resource={r} onSave={updateResourcePrice} />
                ))
              ) : (
                <>
                  <ResourceSkeleton /><ResourceSkeleton /><ResourceSkeleton />
                </>
              )}
            </div>
          </motion.div>

          <motion.div variants={item}>
            <PurchaseTable purchases={purchases} chainId={chainId} />
          </motion.div>
        </div>

        {/* Right: Chart + Info */}
        <div className="space-y-6">
          <motion.div variants={item}>
            <RevenueChart revenue={revenue} purchases={purchases} />
          </motion.div>

          <motion.div variants={item} className="glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-brand-400" />
              How it works
            </h3>
            <div className="space-y-3 text-xs text-surface-400">
              {[
                { step: '1', text: 'Set prices for resources. Agents see them in the catalog.' },
                { step: '2', text: 'Agent reasons with Venice AI, decides to buy, pays USDC on-chain.' },
                { step: '3', text: 'Revenue updates in real-time. Click tx links to verify on Basescan.' },
              ].map(({ step, text }) => (
                <div key={step} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400 text-[10px] font-bold shrink-0">
                    {step}
                  </span>
                  <p>{text}</p>
                </div>
              ))}
            </div>
            <a
              href={`https://${explorer}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 mt-4 transition-colors"
            >
              View on Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

function ResourceSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-surface-200" />
        <div className="flex-1">
          <div className="h-4 bg-surface-200 rounded w-48 mb-1" />
          <div className="h-3 bg-surface-200 rounded w-32" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-50/50 rounded-lg p-2 h-12" />
        ))}
      </div>
      <div className="h-8 bg-surface-200 rounded-lg" />
    </div>
  )
}
