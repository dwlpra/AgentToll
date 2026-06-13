import { motion } from 'framer-motion'
import { TrendingUp, DollarSign } from 'lucide-react'
import type { Purchase } from '../hooks/useGatewayApi'

interface Props {
  revenue: string
  purchases: Purchase[]
}

export function RevenueChart({ revenue, purchases }: Props) {
  const totalPurchases = purchases.length
  const resourceCounts: Record<string, { count: number; revenue: number }> = {}

  purchases.forEach((p) => {
    const key = p.resource
    if (!resourceCounts[key]) {
      resourceCounts[key] = { count: 0, revenue: 0 }
    }
    resourceCounts[key].count++
    resourceCounts[key].revenue += parseFloat(p.amountUSD || '0')
  })

  const maxRevenue = Math.max(...Object.values(resourceCounts).map((r) => r.revenue), 0.01)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Revenue</h3>
            <p className="text-xs text-surface-400">{totalPurchases} purchases</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-2xl font-bold text-white">{revenue}</span>
          </div>
          <p className="text-xs text-surface-400">Total USDC earned</p>
        </div>
      </div>

      {Object.keys(resourceCounts).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(resourceCounts).map(([resource, data], i) => {
            const shortName = resource.split('/').pop() || resource
            const pct = (data.revenue / maxRevenue) * 100
            return (
              <motion.div
                key={resource}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-surface-400 truncate max-w-[160px]">{shortName}</span>
                  <span className="text-xs font-medium text-white">
                    ${data.revenue.toFixed(2)} ({data.count}x)
                  </span>
                </div>
                <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-surface-400">No purchases yet</p>
          <p className="text-xs text-surface-500 mt-1">Revenue will appear here when agents buy your resources</p>
        </div>
      )}
    </motion.div>
  )
}
