import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, DollarSign, Save, Pencil, Clock, Shield, BarChart3 } from 'lucide-react'
import type { Resource } from '../hooks/useGatewayApi'

interface Props {
  resource: Resource
  onSave: (path: string, priceUSD: number) => Promise<boolean>
}

export function ResourceCard({ resource, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(resource.priceUSD.toString())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    const newPrice = parseFloat(price)
    if (isNaN(newPrice) || newPrice <= 0) return
    setSaving(true)
    const ok = await onSave(resource.path, newPrice)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 glass-hover group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{resource.title}</h3>
            <p className="text-xs text-surface-400 mt-0.5">{resource.path}</p>
          </div>
        </div>
        {saved && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-xs text-emerald-400 font-medium"
          >
            Saved
          </motion.span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-surface-50/50 rounded-lg p-2 text-center">
          <DollarSign className="w-3 h-3 text-accent-400 mx-auto mb-1" />
          <p className="text-xs text-surface-400">Price</p>
        </div>
        <div className="bg-surface-50/50 rounded-lg p-2 text-center">
          <Clock className="w-3 h-3 text-accent-400 mx-auto mb-1" />
          <p className="text-xs text-surface-400">Fresh</p>
        </div>
        <div className="bg-surface-50/50 rounded-lg p-2 text-center">
          <Shield className="w-3 h-3 text-accent-400 mx-auto mb-1" />
          <p className="text-xs text-surface-400">Verified</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">${resource.priceUSD.toFixed(2)}</span>
              <span className="text-xs text-surface-400">USDC</span>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-surface-400 hover:text-white border border-surface-200 rounded-lg hover:border-brand-500 transition-all"
            >
              <Pencil className="w-3 h-3" />
              Edit Price
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
