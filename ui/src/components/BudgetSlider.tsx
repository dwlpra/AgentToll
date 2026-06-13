import { motion } from 'framer-motion'
import { DollarSign } from 'lucide-react'

interface Props {
  value: number
  onChange: (val: number) => void
  disabled?: boolean
}

export function BudgetSlider({ value, onChange, disabled }: Props) {
  const pct = ((value - 0.1) / (10 - 0.1)) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-medium text-white">Spending Cap</span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-white">${value.toFixed(2)}</span>
          <span className="text-xs text-surface-400 ml-1">USDC / 24h</span>
        </div>
      </div>

      <div className="relative mb-3">
        <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex justify-between text-xs text-surface-500">
        <span>$0.10</span>
        <span>$2.50</span>
        <span>$5.00</span>
        <span>$7.50</span>
        <span>$10.00</span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1">
        {[0.5, 1, 2, 5, 10].map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            disabled={disabled}
            className={`text-xs py-1.5 rounded-lg transition-all ${
              Math.abs(value - preset) < 0.01
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'text-surface-400 hover:text-white hover:bg-surface-100/50 border border-transparent'
            } disabled:opacity-50`}
          >
            ${preset}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
