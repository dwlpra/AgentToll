import { motion } from 'framer-motion'
import { Shield, ShieldCheck, ShieldX, Clock, DollarSign, AlertTriangle } from 'lucide-react'
import type { AgentConfig } from '../hooks/useGatewayApi'

interface Props {
  config: AgentConfig | null
}

export function PermissionStatus({ config }: Props) {
  if (!config || config.status === 'none') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-surface-200/50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-surface-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Permissions</h3>
            <p className="text-xs text-surface-400">Not yet granted</p>
          </div>
        </div>
        <p className="text-xs text-surface-500">
          Connect your wallet and grant permissions to enable autonomous agent payments.
        </p>
      </motion.div>
    )
  }

  const isActive = config.status === 'active'
  const Icon = isActive ? ShieldCheck : ShieldX

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isActive ? 'bg-emerald-500/10' : 'bg-red-500/10'
        }`}>
          <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-red-400'}`} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Permissions</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`text-xs ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isActive ? 'Active' : 'Expired'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-50/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3 h-3 text-brand-400" />
            <span className="text-xs text-surface-400">Budget</span>
          </div>
          <p className="text-sm font-semibold text-white">
            ${(config.budget ?? 0).toFixed(2)} <span className="text-xs text-surface-400">/ day</span>
          </p>
        </div>
        <div className="bg-surface-50/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3 h-3 text-accent-400" />
            <span className="text-xs text-surface-400">Expiry</span>
          </div>
          <p className="text-sm font-semibold text-white">{config.expiryLabel || `${config.expiry}s`}</p>
        </div>
      </div>

      {config.wallet && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-surface-400">
          <AlertTriangle className="w-3 h-3" />
          <span>Wallet: {config.wallet.slice(0, 8)}...{config.wallet.slice(-6)}</span>
        </div>
      )}
    </motion.div>
  )
}
