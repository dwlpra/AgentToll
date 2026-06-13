import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, useDisconnect, useConnect } from 'wagmi'
import {
  Zap,
  LayoutDashboard,
  Bot,
  Wallet,
  LogOut,
  ExternalLink,
  ChevronDown,
  FileText,
} from 'lucide-react'
import { useState } from 'react'
import { useUsdcBalance } from '../hooks/useUsdcBalance'

function WalletButton() {
  const { address, chainId, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect, connectors } = useConnect()
  const { balance } = useUsdcBalance()
  const [open, setOpen] = useState(false)

  if (!address) {
    return (
      <button
        onClick={() => {
          const injected = connectors.find((c) => c.id === 'injected')
          if (injected) connect({ connector: injected })
        }}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 rounded-xl text-sm font-medium text-white transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    )
  }

  const short = `${address.slice(0, 6)}...${address.slice(-4)}`
  const chainName = chainId === 8453 ? 'Base' : chainId === 84532 ? 'Base Sepolia' : `Chain ${chainId}`
  const explorer = chainId === 8453 ? 'basescan.org' : 'sepolia.basescan.org'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 glass glass-hover rounded-xl px-4 py-2 text-sm font-medium transition-all cursor-pointer"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-white">{short}</span>
        <span className="text-surface-400 text-xs">{chainName}</span>
        <ChevronDown className="w-3 h-3 text-surface-400" />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute right-0 top-full mt-2 w-72 glass rounded-xl p-4 z-50"
        >
          <div className="flex items-center gap-3 mb-3">
            <Wallet className="w-5 h-5 text-brand-400" />
            <div>
              <p className="text-sm font-medium text-white">{short}</p>
              <p className="text-xs text-surface-400">Connected via {connector?.name}</p>
            </div>
          </div>
          <div className="bg-surface-50/50 rounded-lg p-3 mb-3">
            <p className="text-xs text-surface-400 mb-1">USDC Balance</p>
            <p className="text-lg font-semibold text-white">${balance}</p>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://${explorer}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 text-xs text-surface-400 hover:text-white transition-colors py-2 rounded-lg hover:bg-surface-50/50"
            >
              <ExternalLink className="w-3 h-3" /> Explorer
            </a>
            <button
              onClick={() => { disconnect(); setOpen(false) }}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors py-2 rounded-lg hover:bg-red-500/10"
            >
              <LogOut className="w-3 h-3" /> Disconnect
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export function Navbar() {
  const location = useLocation()

  const links = [
    { to: '/', label: 'Home', icon: Zap },
    { to: '/articles', label: 'Articles', icon: FileText },
    { to: '/provider', label: 'Provider', icon: LayoutDashboard },
    { to: '/agent', label: 'Agent', icon: Bot },
  ]

  return (
    <nav className="sticky top-0 z-40 glass border-b border-surface-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">
                PayCrawl
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {links.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-brand-500/10 text-brand-400'
                        : 'text-surface-400 hover:text-white hover:bg-surface-100/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
          <WalletButton />
        </div>
      </div>
    </nav>
  )
}
