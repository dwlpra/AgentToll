import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Package, X, ShieldAlert } from 'lucide-react'
import type { Role } from '../hooks/useRole'

interface RolePickerModalProps {
  open: boolean
  address: string
  isWhitelistedProvider: boolean
  onSelect: (role: Role) => void
}

export function RolePickerModal({ open, address, isWhitelistedProvider, onSelect }: RolePickerModalProps) {
  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="glass rounded-3xl p-8 max-w-md w-full mx-4 relative overflow-hidden"
          >
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-accent-500 to-emerald-500" />

            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold text-white mb-1">Choose Your Role</h2>
              <p className="text-sm text-surface-400">
                Connected as <span className="text-brand-400 font-mono">{short}</span>
              </p>
            </div>

            {/* Role cards */}
            <div className="space-y-3">
              {/* Agent */}
              <button
                onClick={() => onSelect('agent')}
                className="w-full group glass glass-hover rounded-2xl p-5 text-left transition-all hover:ring-2 hover:ring-brand-500/40 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0 group-hover:bg-brand-500/20 transition-colors">
                    <Bot className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">Agent</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-semibold">
                        DATA BUYER
                      </span>
                    </div>
                    <p className="text-xs text-surface-400 leading-relaxed">
                      Grant ERC-20 spending permissions, set budgets, and let the autonomous
                      agent buy data on your behalf via the 1Shot relayer.
                    </p>
                  </div>
                </div>
              </button>

              {/* Provider */}
              <button
                disabled={!isWhitelistedProvider}
                onClick={() => isWhitelistedProvider && onSelect('provider')}
                className={`w-full group rounded-2xl p-5 text-left transition-all ${
                  isWhitelistedProvider
                    ? 'glass glass-hover hover:ring-2 hover:ring-emerald-500/40 cursor-pointer'
                    : 'glass opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">Provider</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">
                        DATA SELLER
                      </span>
                    </div>
                    {isWhitelistedProvider ? (
                      <p className="text-xs text-surface-400 leading-relaxed">
                        Manage resource prices, track revenue, and receive USDC payments
                        from agent purchases. All on Base.
                      </p>
                    ) : (
                      <div className="flex items-start gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-400/80 leading-relaxed">
                          This wallet is not registered as a provider. Only authorized
                          wallets can sell data.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>

            <p className="text-center text-[10px] text-surface-500 mt-5">
              You can switch roles anytime by reconnecting your wallet
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
