import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

interface Props {
  value: number
  onChange: (val: number) => void
  disabled?: boolean
}

export const EXPIRY_OPTIONS = [
  { label: '1 Hour', seconds: 3600 },
  { label: '6 Hours', seconds: 21600 },
  { label: '24 Hours', seconds: 86400 },
  { label: '7 Days', seconds: 604800 },
  { label: '30 Days', seconds: 2592000 },
] as const

export function ExpirySelect({ value, onChange, disabled }: Props) {
  const current = EXPIRY_OPTIONS.find((o) => o.seconds === value) ?? EXPIRY_OPTIONS[3]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-accent-400" />
        <span className="text-sm font-medium text-white">Permission Expiry</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl font-bold text-white">{current.label}</span>
        <span className="text-xs text-surface-400">from now</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {EXPIRY_OPTIONS.map((opt) => (
          <button
            key={opt.seconds}
            onClick={() => onChange(opt.seconds)}
            disabled={disabled}
            className={`py-2.5 px-2 rounded-xl text-xs font-medium transition-all ${
              value === opt.seconds
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'text-surface-400 hover:text-white glass-hover border border-transparent'
            } disabled:opacity-50`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
