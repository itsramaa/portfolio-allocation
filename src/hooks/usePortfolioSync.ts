import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ConnectionStatus, Asset, TargetAllocation } from '../types'
import { loadCredentials, saveSnapshot, clearHistory } from '../utils/storage'
import { syncPortfolio, demoPortfolio } from '../services/api'
import type { BackendAsset } from '../services/api'
import { calcRebalanceBand, resolveTargetPct } from '../lib/portfolio'

function mapBackendAsset(a: BackendAsset, targets: TargetAllocation): Asset {
  const logoColors: Record<string, string> = {
    BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', BNB: '#F3BA2F',
    NEAR: '#00C1DE', USDT: '#26A17B', USDC: '#2775CA', AVAX: '#E84142',
    DOT: '#E6007A', LINK: '#2A5ADA', ADA: '#0033AD', ATOM: '#2E3148',
    MATIC: '#8247E5', FTM: '#1969FF', OP: '#FF0420', ARB: '#12AAFF',
  }
  const colorFallback = `hsl(${[...a.symbol].reduce((n, c) => n + c.charCodeAt(0), 0) % 360}, 65%, 55%)`

  const targetPct = resolveTargetPct(a.symbol, targets)
  return {
    symbol: a.symbol,
    quoteSymbol: a.symbol === 'USDT' ? 'USDT' : `${a.symbol}USDT`,
    amount: a.amount,
    usdtValue: a.value,
    price: a.price,
    currentPct: a.currentPct,
    targetPct,
    drift: a.currentPct - targetPct,
    rebalanceBand: calcRebalanceBand(targetPct, a.symbol),
    logoColor: logoColors[a.symbol] ?? colorFallback,
  }
}

export function usePortfolioSync(targets: TargetAllocation) {
  const [credentials, setCredentials] = useState(() => loadCredentials())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    loadCredentials() ? 'loading' : 'unconfigured'
  )
  const [isDemoMode, setIsDemoMode] = useState(() => !loadCredentials())

  const [assets, setAssets] = useState<Asset[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

  // ─── Fetch live portfolio from backend ─────────────────────────────────────
  const loadLiveData = useCallback(async (currentTargets: TargetAllocation) => {
    setLoading(true)
    setError(null)
    setConnectionStatus('loading')
    try {
      const res = await syncPortfolio()
      if (res.status === 'error') {
        setError(res.error ?? 'Backend sync failed')
        setConnectionStatus('error')
        return
      }
      setPrices(res.prices)
      setAssets(res.assets.map(a => mapBackendAsset(a, currentTargets)))
      setConnectionStatus('connected')
      setLastRefreshed(res.lastRefreshed)
      if (res.totalUSDT > 0) {
        saveSnapshot({ timestamp: res.lastRefreshed, totalUSDT: res.totalUSDT, btcPrice: res.btcPrice })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync portfolio')
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Load demo portfolio from backend ──────────────────────────────────────
  const loadDemoData = useCallback(async (currentTargets: TargetAllocation) => {
    setLoading(true)
    setError(null)
    try {
      const res = await demoPortfolio()
      setPrices(res.prices)
      setAssets(res.assets.map(a => mapBackendAsset(a, currentTargets)))
      setConnectionStatus('connected')
      setLastRefreshed(res.lastRefreshed)
      if (res.totalUSDT > 0) {
        saveSnapshot({ timestamp: res.lastRefreshed, totalUSDT: res.totalUSDT, btcPrice: res.btcPrice })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo data generation failed')
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Initial sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (credentials) {
      void loadLiveData(targets)
    } else if (isDemoMode) {
      void loadDemoData(targets)
    }
  }, [credentials, isDemoMode, loadLiveData, loadDemoData, targets])

  // ─── Auto refresh every 60s ────────────────────────────────────────────────
  useEffect(() => {
    if (!credentials && !isDemoMode) return
    const interval = setInterval(() => {
      if (credentials) void loadLiveData(targets)
      else if (isDemoMode) void loadDemoData(targets)
    }, 60_000)
    return () => clearInterval(interval)
  }, [credentials, isDemoMode, loadLiveData, loadDemoData, targets])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleCredentialsChange = (creds: typeof credentials) => {
    setCredentials(creds)
    if (creds) {
      clearHistory()
      setIsDemoMode(false)
      void loadLiveData(targets)
    } else {
      setIsDemoMode(false)
      setConnectionStatus('unconfigured')
      setAssets([])
    }
  }

  const refreshData = () => {
    if (credentials) void loadLiveData(targets)
    else if (isDemoMode) void loadDemoData(targets)
  }

  const totalPortfolioUSDT = useMemo(() => assets.reduce((s, a) => s + a.usdtValue, 0), [assets])
  const btcPrice = useMemo(() => assets.find(a => a.symbol === 'BTC')?.price, [assets])

  return {
    credentials,
    setCredentials,
    connectionStatus,
    isDemoMode,
    setIsDemoMode,
    assets,
    setAssets,
    prices,
    loading,
    error,
    lastRefreshed,
    handleCredentialsChange,
    refreshData,
    loadDemoData,
    totalPortfolioUSDT,
    btcPrice,
  }
}
