import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Clock, Shield, BarChart3, Tag, ChevronLeft,
  AlertTriangle, CheckCircle2, XCircle, ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface ArticleSection {
  title: string
  content: string
}

interface Article {
  id: string
  title: string
  path: string
  priceUSD: number
  freshness: string
  sources: number
  verified: boolean
  summary: string
  category: string
  tags: string[]
  confidence: number
  keyMetrics: Record<string, any>
  analysis: ArticleSection[]
  riskFactors: string[]
  verdict: string
  generatedAt: string
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : pct >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <BarChart3 className="w-3 h-3" />
      {pct}% confidence
    </span>
  )
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified
    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Verified</span>
    : <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" /> Unverified</span>
}

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  const isLowQuality = article.confidence < 0.5 || !article.verified
  return (
    <motion.div
      variants={item}
      onClick={onClick}
      className="glass rounded-2xl p-6 glass-hover cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {article.category}
            </span>
            <ConfidenceBadge value={article.confidence} />
            {isLowQuality && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="w-3 h-3" /> Low quality
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
            {article.title}
          </h3>
        </div>
      </div>

      <p className="text-sm text-surface-400 mb-4 line-clamp-2 leading-relaxed">
        {article.summary}
      </p>

      <div className="flex items-center gap-4 text-xs text-surface-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {article.freshness}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {article.sources} source{article.sources !== 1 ? 's' : ''}
        </span>
        <VerifiedBadge verified={article.verified} />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-200/30">
        <div className="flex gap-1.5 flex-wrap">
          {article.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded bg-surface-100/50 text-surface-400 text-[10px]">
              {tag}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-xs text-brand-400 group-hover:text-brand-300 transition-colors">
          Read more <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </motion.div>
  )
}

function ArticleDetail({ article, onBack }: { article: Article; onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to articles
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-xs border border-brand-500/20">
            {article.category}
          </span>
          <ConfidenceBadge value={article.confidence} />
          <VerifiedBadge verified={article.verified} />
          <span className="flex items-center gap-1 text-xs text-surface-500">
            <Clock className="w-3 h-3" /> {article.freshness}
          </span>
          <span className="flex items-center gap-1 text-xs text-surface-500">
            <FileText className="w-3 h-3" /> {article.sources} sources
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">{article.title}</h1>
        <p className="text-surface-400 leading-relaxed">{article.summary}</p>
      </div>

      {article.keyMetrics && Object.keys(article.keyMetrics).length > 0 && (
        <div className="glass rounded-2xl p-5 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
            <BarChart3 className="w-4 h-4 text-brand-400" />
            Key Metrics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(article.keyMetrics).map(([key, value]) => (
              <div key={key} className="bg-surface-50/50 rounded-xl p-3">
                <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-sm font-semibold text-white">
                  {value === null ? 'N/A' : String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {article.analysis && article.analysis.length > 0 && (
        <div className="space-y-4 mb-6">
          {article.analysis.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-5"
            >
              <h3 className="text-base font-semibold text-white mb-3">{section.title}</h3>
              <p className="text-sm text-surface-400 leading-relaxed">{section.content}</p>
            </motion.div>
          ))}
        </div>
      )}

      {article.riskFactors && article.riskFactors.length > 0 && (
        <div className="glass rounded-2xl p-5 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Risk Factors
          </h2>
          <ul className="space-y-2">
            {article.riskFactors.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-surface-400">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {article.verdict && (
        <div className="glass rounded-2xl p-5 mb-6 gradient-border">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
            <Shield className="w-4 h-4 text-brand-400" />
            Verdict
          </h2>
          <p className="text-sm text-surface-300 leading-relaxed">{article.verdict}</p>
        </div>
      )}

      {article.tags && article.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3 h-3 text-surface-500" />
          {article.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 rounded-lg bg-surface-100/50 text-surface-400 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function Articles() {
  const [articles, setArticles] = useState<Article[]>([])
  const [selected, setSelected] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchArticles() {
      try {
        // Fetch catalog for metadata (public, no auth needed)
        const catRes = await fetch('/catalog')
        const catData = await catRes.json()
        const catalog = catData.catalog || []

        // Fetch full article content via Vite proxy
        // The proxy (vite.config.ts) injects X-Browser-Token SERVER-SIDE
        // so the token is NEVER exposed in the browser JavaScript bundle.
        // An agent looking at DevTools will only see:
        //   GET /reports/asia-daily  (no secret header visible)
        const fullArticles = await Promise.all(
          catalog.map(async (entry: any) => {
            try {
              // Relative URL → goes through Vite proxy → token injected server-side
              const res = await fetch(entry.path)
              if (res.ok) return await res.json()
            } catch {}
            return null
          })
        )

        const merged = catalog.map((entry: any, i: number) => {
          const full = fullArticles[i]
          return full || entry
        }).filter(Boolean)

        setArticles(merged)
      } catch (err) {
        console.error('Failed to fetch articles:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchArticles()
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-surface-500 mb-2">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-surface-400">Articles</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Articles</h1>
        <p className="text-sm text-surface-400 mt-1">
          Crypto market intelligence — free for human readers, agents pay per crawl via x402
        </p>
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <ArticleDetail
            key={selected.id}
            article={selected}
            onBack={() => setSelected(null)}
          />
        ) : (
          <motion.div
            key="list"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                    <div className="h-4 bg-surface-200 rounded w-48 mb-3" />
                    <div className="h-6 bg-surface-200 rounded w-full mb-4" />
                    <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-surface-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center">
                <FileText className="w-12 h-12 text-surface-500 mx-auto mb-3" />
                <p className="text-sm text-surface-400">No articles available yet</p>
                <p className="text-xs text-surface-500 mt-1">
                  Start the mock-api service: <code className="text-surface-300">cd mock-api && go run .</code>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {articles.map((article) => (
                  <ArticleCard
                    key={article.id || article.path}
                    article={article}
                    onClick={() => setSelected(article)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
