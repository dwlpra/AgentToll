import { useState, useEffect, useCallback } from 'react'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || ''

export interface Resource {
  id: string
  path: string
  title: string
  priceUSD: number
  priceUnits: string
  description: string
}

export interface Purchase {
  id: string
  taskId: string
  wallet: string
  resource: string
  amount: string
  amountUSD: string
  txHash: string
  asset: string
  timestamp: string
}

export interface DashboardData {
  revenue: string
  purchases: Purchase[]
  resourceStats: { path: string; count: number; revenue: string }[]
}

export interface AgentConfig {
  budget: number
  expiry: number
  expiryLabel: string
  wallet: string
  permissionsContext: string
  status: 'active' | 'expired' | 'none'
}

export interface CrawlJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  query: string
  output: string
  startedAt: string
  doneAt?: string
}

export function useGatewayApi() {
  const [resources, setResources] = useState<Resource[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [providerWallet, setProviderWallet] = useState<string>('')
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([])
  const [loading, setLoading] = useState(false)

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/resources`)
      if (res.ok) {
        const data = await res.json()
        setResources(data.resources ?? [])
      }
    } catch {
      // Gateway not running
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/dashboard`)
      if (res.ok) {
        const data = await res.json()
        setDashboard(data)
      }
    } catch {
      // Gateway not running
    }
  }, [])

  const fetchAgentConfig = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/agent-config`)
      if (res.ok) {
        const data = await res.json()
        setAgentConfig(data)
      }
    } catch {
      // Gateway not running
    }
  }, [])

  const fetchProviderConfig = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/provider-config`)
      if (res.ok) {
        const data = await res.json()
        setProviderWallet(data.wallet || '')
      }
    } catch {
      // Gateway not running
    }
  }, [])

  const fetchCrawlStatus = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/crawl`)
      if (res.ok) {
        const data = await res.json()
        setCrawlJobs(data.jobs ?? [])
      }
    } catch {
      // Gateway not running
    }
  }, [])

  const updateResourcePrice = useCallback(async (path: string, priceUSD: number) => {
    setLoading(true)
    try {
      const res = await fetch(`${GATEWAY_URL}/api/resources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, priceUSD }),
      })
      if (res.ok) {
        await fetchResources()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [fetchResources])

  const saveAgentConfig = useCallback(async (config: Partial<AgentConfig>) => {
    setLoading(true)
    try {
      const res = await fetch(`${GATEWAY_URL}/api/agent-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        await fetchAgentConfig()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [fetchAgentConfig])

  const saveProviderWallet = useCallback(async (wallet: string) => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/provider-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      })
      if (res.ok) {
        setProviderWallet(wallet)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const startCrawl = useCallback(async (query?: string) => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || 'Summarize this week\'s Asian crypto market sentiment' }),
      })
      if (res.ok) {
        await fetchCrawlStatus()
        return true
      }
      return false
    } catch {
      return false
    }
  }, [fetchCrawlStatus])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      fetchResources(),
      fetchDashboard(),
      fetchAgentConfig(),
      fetchProviderConfig(),
      fetchCrawlStatus(),
    ])
    setLoading(false)
  }, [fetchResources, fetchDashboard, fetchAgentConfig, fetchProviderConfig, fetchCrawlStatus])

  useEffect(() => {
    refreshAll()
    const interval = setInterval(() => {
      fetchDashboard()
      fetchCrawlStatus()
    }, 5000)
    return () => clearInterval(interval)
  }, [refreshAll, fetchDashboard, fetchCrawlStatus])

  return {
    resources,
    dashboard,
    agentConfig,
    providerWallet,
    crawlJobs,
    loading,
    updateResourcePrice,
    saveAgentConfig,
    saveProviderWallet,
    startCrawl,
    refreshAll,
  }
}
