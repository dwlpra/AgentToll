import { motion } from 'framer-motion'
import { ExternalLink, Clock, FileText } from 'lucide-react'

interface PurchaseEntry {
  wallet: string
  path: string
  amount: string
  txHash: string
  chainId: number
  timestamp: string
}

interface Props {
  purchases: PurchaseEntry[]
  chainId?: number
}

export function PurchaseTable({ purchases, chainId }: Props) {
  const explorer = chainId === 8453 ? 'basescan.org' : 'sepolia.basescan.org'

  if (purchases.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-brand-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Purchase History</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-surface-400">No purchases yet</p>
          <p className="text-xs text-surface-500 mt-1">Transactions will appear here when agents pay for resources</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-brand-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Purchase History</h3>
        <span className="ml-auto text-xs text-surface-400">{purchases.length} transactions</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-surface-400 border-b border-surface-200/50">
              <th className="text-left pb-3 font-medium">Time</th>
              <th className="text-left pb-3 font-medium">Resource</th>
              <th className="text-left pb-3 font-medium">Amount</th>
              <th className="text-left pb-3 font-medium">Buyer</th>
              <th className="text-right pb-3 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-surface-200/30 last:border-0"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1 text-xs text-surface-400">
                    <Clock className="w-3 h-3" />
                    {p.timestamp ? new Date(p.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-xs text-white font-medium">
                    {p.path?.split('/').pop() || p.path}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-xs text-emerald-400 font-medium">${p.amount || '0.00'}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-xs text-surface-400 font-mono">
                    {p.wallet ? `${p.wallet.slice(0, 6)}...${p.wallet.slice(-4)}` : '--'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  {p.txHash ? (
                    <a
                      href={`https://${explorer}/tx/${p.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-surface-500">pending</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
