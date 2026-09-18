// ─── Main Application Shell ──────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AppTab, ConnectionStatus, ApiCredentials, Asset, TargetAllocation, CurrencyCode, FxRates, AlphaAssetConfig } from './types'
import { loadCredentials, loadTargetAllocation, saveTargetAllocation, saveSnapshot, clearCredentials, loadAlphaAssets, saveAlphaAssets, loadArchivedAssets, saveArchivedAssets } from './storage'
import { fetchAccountBalances, fetchAllPrices, fetchAlphaTokenList } from './binanceApi'
import { buildAssets, updateAlphaSymbols } from './portfolio'
import { loadSelectedCurrency, saveSelectedCurrency, loadCachedRates, fetchLiveFxRates } from './currency'

import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Inject } from './components/Inject'
import { Rebalance } from './components/Rebalance'
import { Settings } from './components/Settings'
import { History } from './components/History'
import { Onboarding } from './components/Onboarding'

// ── Default Mock / Demo Assets ───────────────────────────────────────────────
const DEMO_TARGETS: TargetAllocation = {
  BTC: 45,
  ETH: 25,
  SOL: 15,
  BNB: 10,
  NEAR: 5,
}


const DEMO_BALANCES = [
  { asset: 'BTC', free: '0.245', locked: '0' },
  { asset: 'ETH', free: '2.10', locked: '0' },
  { asset: 'SOL', free: '18.5', locked: '0' },
  { asset: 'BNB', free: '4.2', locked: '0' },
  { asset: 'NEAR', free: '150.0', locked: '0' },
  { asset: 'USDT', free: '480.0', locked: '0' },
]

export default function App() {
  const [credentials, setCredentials] = useState<ApiCredentials | null>(() => loadCredentials())
  const [targets, setTargets] = useState<TargetAllocation>(() => {
    const saved = loadTargetAllocation()
    return Object.keys(saved).length > 0 ? saved : DEMO_TARGETS
  })
  const [alphaAssets, setAlphaAssets] = useState<AlphaAssetConfig[]>(() => loadAlphaAssets())
  const [archivedAssets, setArchivedAssets] = useState<Set<string>>(() => loadArchivedAssets())
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)

  // Currency & FX rates
  const [currency, setCurrency] = useState<CurrencyCode>(() => loadSelectedCurrency())
  const [fxRates, setFxRates] = useState<FxRates>(() => loadCachedRates())

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => {
    return loadCredentials() ? 'loading' : 'unconfigured'
  })
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => !loadCredentials())

  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

  // ─── Fetch live rates on startup ───────────────────────────────────────────
  useEffect(() => {
    fetchLiveFxRates().then(rates => setFxRates(rates)).catch(() => {})
  }, [])

  // ─── Alpha token list ─────────────────────────────────────────────────────────
  // Fetch Alpha tokens from authenticated API, fallback to hardcoded list
  useEffect(() => {
    const fetchAlphaTokens = async () => {
      if (!credentials) {
        console.log('No credentials, using fallback Alpha symbols list')
        return
      }

      try {
        console.log('Fetching Alpha token list from Binance API...')
        const symbols = await fetchAlphaTokenList(credentials)
        console.log(`Loaded ${symbols.length} Alpha tokens from Binance API`)
        updateAlphaSymbols(new Set(symbols))
      } catch (err) {
        console.log('Failed to fetch Alpha token list, using fallback list:', err)
        // Fallback list is already initialized in portfolio.ts
      }
    }

    fetchAlphaTokens()
  }, [credentials])

  // ─── Fetch live data from Binance API ──────────────────────────────────────
  const loadLiveData = useCallback(async (
    creds: ApiCredentials,
    currentTargets: TargetAllocation,
    currentAlpha: AlphaAssetConfig[] = alphaAssets
  ) => {
    setLoading(true)
    setError(null)
    setConnectionStatus('loading')
    try {
      const [balances, prices] = await Promise.all([
        fetchAccountBalances(creds),
        fetchAllPrices(),
      ])

      const built = buildAssets(balances, prices, currentTargets, currentAlpha)
      setAssets(built)
      setConnectionStatus('connected')
      setLastRefreshed(Date.now())

      const total = built.reduce((s, a) => s + a.usdtValue, 0)
      if (total > 0) {
        saveSnapshot({
          timestamp: Date.now(),
          totalUSDT: total,
          btcPrice: prices['BTCUSDT'],
        })
      }
    } catch (err) {
      console.error('Binance API fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch Binance account data.')
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }, [alphaAssets])

  // ─── Load demo data ────────────────────────────────────────────────────────
  const loadDemoData = useCallback(async (
    currentTargets: TargetAllocation,
    currentAlpha: AlphaAssetConfig[] = alphaAssets
  ) => {
    setLoading(true)
    setError(null)
    try {
      let prices: Record<string, number> = {
        BTCUSDT: 68500,
        ETHUSDT: 3600,
        SOLUSDT: 175,
        BNBUSDT: 590,
        NEARUSDT: 5.4,
      }
      try {
        const livePrices = await fetchAllPrices()
        if (livePrices && Object.keys(livePrices).length > 0) {
          prices = livePrices
        }
      } catch {
        // fallback static demo prices
      }

      const built = buildAssets(DEMO_BALANCES, prices, currentTargets, currentAlpha)
      setAssets(built)
      setConnectionStatus('connected')
      setLastRefreshed(Date.now())

      const total = built.reduce((s, a) => s + a.usdtValue, 0)
      if (total > 0) {
        saveSnapshot({
          timestamp: Date.now(),
          totalUSDT: total,
          btcPrice: prices['BTCUSDT'],
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo data generation failed')
    } finally {
      setLoading(false)
    }
  }, [alphaAssets])

  // ─── Initial sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (credentials) {
      setIsDemoMode(false)
      loadLiveData(credentials, targets, alphaAssets)
    } else if (isDemoMode) {
      loadDemoData(targets, alphaAssets)
    }
  }, [credentials, isDemoMode, loadLiveData, loadDemoData, targets, alphaAssets])

  // ─── Auto refresh every 60s ────────────────────────────────────────────────
  useEffect(() => {
    if (!credentials && !isDemoMode) return
    const interval = setInterval(() => {
      if (credentials) {
        loadLiveData(credentials, targets, alphaAssets)
      } else if (isDemoMode) {
        loadDemoData(targets, alphaAssets)
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [credentials, isDemoMode, loadLiveData, loadDemoData, targets, alphaAssets])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleCredentialsChange = (creds: ApiCredentials | null) => {
    setCredentials(creds)
    if (creds) {
      // Clear out demo mock snapshots when connecting real credentials
      localStorage.removeItem('portfolio_history')
      setIsDemoMode(false)
      loadLiveData(creds, targets)
    } else {
      clearCredentials()
      setConnectionStatus('unconfigured')
      setAssets([])
    }
  }

  const handleTargetsChange = (newTargets: TargetAllocation) => {
    setTargets(newTargets)
    saveTargetAllocation(newTargets)
    setAssets(prev => {
      const total = prev.reduce((s, a) => s + a.usdtValue, 0)
      return prev.map(a => {
        const targetPct = newTargets[a.symbol] ?? 0
        const currentPct = total > 0 ? (a.usdtValue / total) * 100 : 0
        return {
          ...a,
          targetPct,
          drift: currentPct - targetPct,
        }
      })
    })
  }

  const handleAlphaAssetsChange = (newAlpha: AlphaAssetConfig[]) => {
    setAlphaAssets(newAlpha)
    saveAlphaAssets(newAlpha)
    if (credentials) {
      loadLiveData(credentials, targets, newAlpha)
    } else {
      loadDemoData(targets, newAlpha)
    }
  }

  const handleToggleArchive = (symbol: string) => {
    setArchivedAssets(prev => {
      const next = new Set(prev)
      if (next.has(symbol)) {
        next.delete(symbol)
      } else {
        next.add(symbol)
      }
      saveArchivedAssets(next)
      return next
    })
  }

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    setCurrency(newCurrency)
    saveSelectedCurrency(newCurrency)
  }

  const handleRefreshRates = async () => {
    const updated = await fetchLiveFxRates()
    setFxRates(updated)
  }

  const totalPortfolioUSDT = useMemo(() => assets.reduce((s, a) => s + a.usdtValue, 0), [assets])
  const btcPrice = useMemo(() => assets.find(a => a.symbol === 'BTC')?.price, [assets])

  // ─── Onboarding gate ───────────────────────────────────────────────────────
  if (!credentials && !isDemoMode) {
    return (
      <Onboarding
        onComplete={() => {
          const creds = loadCredentials()
          setCredentials(creds)
          setIsDemoMode(false)
        }}
        onExploreDemo={() => {
          setIsDemoMode(true)
          loadDemoData(targets)
        }}
      />
    )
  }

  const sidebarWidth = sidebarCollapsed ? 68 : 240

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'oklch(10% 0.01 240)' }}>
      {/* Fixed Left Navigation Bar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connectionStatus={connectionStatus}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      {/* Main Content Area - dynamically margined so it never overlaps the sidebar */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '2rem 2.5rem',
          marginLeft: sidebarWidth,
          width: `calc(100% - ${sidebarWidth}px)`,
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
        }}
      >
        {/* Top Header Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#F0B90B' }}>
                BINANCE
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'oklch(60% 0.01 240)' }}>
                Portfolio & Cash Allocation
              </span>
              {isDemoMode && (
                <span
                  className="badge badge-warning badge-sm mono"
                  style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.2rem 0.5rem' }}
                >
                  SIMULATION / DEMO
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'oklch(50% 0.01 240)', marginTop: '0.2rem' }}>
              {lastRefreshed ? `Last updated: ${new Date(lastRefreshed).toLocaleTimeString()}` : 'Connecting…'}
              {' · '}Auto-syncs every 60s
              {' · '}Currency: <strong>{currency}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              id="refresh-button"
              type="button"
              className="btn btn-sm btn-ghost mono"
              onClick={() => (credentials ? loadLiveData(credentials, targets) : loadDemoData(targets))}
              disabled={loading}
              style={{ border: '1px solid oklch(100% 0 0 / 0.1)', fontSize: '0.75rem' }}
              title="Refresh balances and ticker prices"
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync
            </button>

            {isDemoMode ? (
              <button
                type="button"
                className="btn btn-sm btn-primary mono"
                style={{ fontSize: '0.75rem' }}
                onClick={() => setActiveTab('settings')}
              >
                Connect Real API Key
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-ghost mono"
                style={{ fontSize: '0.75rem', border: '1px solid oklch(100% 0 0 / 0.1)' }}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            )}
          </div>
        </header>

        {/* Demo banner indicator */}
        {isDemoMode && (
          <div
            className="fade-up"
            style={{
              padding: '0.75rem 1.25rem',
              background: 'oklch(22% 0.05 85 / 0.25)',
              border: '1px solid oklch(80% 0.18 85 / 0.25)',
              borderRadius: '0.625rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <span style={{ color: 'oklch(85% 0.05 85)' }}>
                <strong>Demo Mode Active:</strong> Displaying simulated spot balances. Real Binance read-only keys can be added anytime in Settings.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-xs btn-outline btn-warning mono"
              onClick={() => setActiveTab('settings')}
            >
              Configure API
            </button>
          </div>
        )}

        {/* View Routing */}
        {activeTab === 'dashboard' && (
          <Dashboard
            assets={assets}
            loading={loading}
            error={error}
            onRetry={() => (credentials ? loadLiveData(credentials, targets) : loadDemoData(targets))}
            currency={currency}
            rates={fxRates.rates}
            archivedAssets={archivedAssets}
            onToggleArchive={handleToggleArchive}
          />
        )}

        {activeTab === 'inject' && (
          <Inject
            assets={assets}
            targets={targets}
            currency={currency}
            rates={fxRates.rates}
            onNavigateSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'rebalance' && (
          <Rebalance
            assets={assets}
            targets={targets}
            currency={currency}
            rates={fxRates.rates}
          />
        )}

        {activeTab === 'history' && (
          <History
            currentTotal={totalPortfolioUSDT}
            btcPrice={btcPrice}
            currency={currency}
            rates={fxRates.rates}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            credentials={credentials}
            targets={targets}
            assets={assets}
            currency={currency}
            rates={fxRates.rates}
            ratesLastUpdated={fxRates.lastUpdated}
            alphaAssets={alphaAssets}
            onCredentialsChange={handleCredentialsChange}
            onTargetsChange={handleTargetsChange}
            onCurrencyChange={handleCurrencyChange}
            onRefreshRates={handleRefreshRates}
            onAlphaAssetsChange={handleAlphaAssetsChange}
          />
        )}
      </main>
    </div>
  )
}
