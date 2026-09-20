// ─── Main Application Shell ──────────────────────────────────────────────────
import { useState } from 'react'
import { usePortfolioApp } from './hooks/usePortfolioApp'
import type { AppTab, TargetAllocation } from './types'
import { loadCredentials } from './utils/storage'
import { useCurrencyRates } from './hooks/useCurrencyRates'
import { usePortfolioSync } from './hooks/usePortfolioSync'

import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Inject } from './components/Inject'
import { Rebalance } from './components/Rebalance'
import { Settings } from './components/Settings'
import { History } from './components/History'
import { Narratives } from './components/Narratives'
import { Onboarding } from './components/Onboarding'
import { AuthGate } from './components/AuthGate'

function PortfolioApp() {
  const {
    targets, archivedAssets, activeTab, setActiveTab, sidebarCollapsed, setSidebarCollapsed,
    mobileSidebarOpen, setMobileSidebarOpen, handleTargetsChange: updateTargets,
    handleToggleArchive, handleTabChange,
  } = usePortfolioApp()

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  // Currency & FX rates management hook
  const { currency, fxRates, handleCurrencyChange, handleRefreshRates } = useCurrencyRates()

  // Portfolio data synchronization hook
  const {
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
  } = usePortfolioSync(targets)

  const handleTargetsChange = (newTargets: TargetAllocation) => {
    updateTargets(newTargets, setAssets)
  }

  // ─── Onboarding gate ───────────────────────────────────────────────────────
  if (connectionStatus === 'loading' && !isDemoMode && assets.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(10% 0.01 240)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span className="loading loading-spinner loading-lg text-warning"></span>
          <span style={{ color: 'oklch(70% 0.01 240)', fontSize: '0.9rem' }}>Menghubungkan ke Binance...</span>
        </div>
      </div>
    )
  }

  if (!credentials && !isDemoMode && connectionStatus === 'unconfigured') {
    return (
      <Onboarding
        onComplete={() => {
          const creds = loadCredentials()
          setCredentials(creds)
          setIsDemoMode(false)
          refreshData()
        }}
        onExploreDemo={() => {
          setIsDemoMode(true)
          void loadDemoData(targets)
        }}
      />
    )
  }

  const sidebarWidth = sidebarCollapsed ? 68 : 240

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'oklch(10% 0.01 240)' }}>
      {/* Mobile sidebar overlay */}
      <div
        className={`sidebar-overlay${mobileSidebarOpen ? ' mobile-open' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Fixed Left Navigation Bar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        connectionStatus={connectionStatus}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileSidebarOpen}
      />

      {/* Main Content Area - dynamically margined so it never overlaps the sidebar */}
      <main
        className="app-main"
        style={{
          flex: 1,
          minWidth: 0,
          padding: '2rem 2.5rem',
          marginLeft: sidebarWidth,
          width: `calc(100% - ${sidebarWidth}px)`,
          transition: 'opacity 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
        }}
      >
        {/* Top Header Bar */}
        <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="app-brand-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            {/* Mobile hamburger */}
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Open navigation menu"
              onClick={() => setMobileSidebarOpen(o => !o)}
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="app-title-block" style={{ minWidth: 0 }}>
              <div className="app-title-line" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
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
                {' · '}Currency: <strong>{currency}</strong>
              </p>
            </div>
          </div>

          <div className="app-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              id="refresh-button"
              type="button"
              className="btn btn-sm btn-ghost mono"
              onClick={refreshData}
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
            onRetry={refreshData}
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

        {activeTab === 'narrative' && (
          <Narratives assets={assets} />
        )}

        {activeTab === 'settings' && (
          <Settings
            credentials={credentials}
            targets={targets}
            assets={assets}
            prices={prices}
            currency={currency}
            rates={fxRates.rates}
            ratesLastUpdated={fxRates.lastUpdated}
            onCredentialsChange={handleCredentialsChange}
            onTargetsChange={handleTargetsChange}
            onCurrencyChange={handleCurrencyChange}
            onRefreshRates={handleRefreshRates}
          />
        )}
      </main>

      {/* Mobile bottom navigation bar */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <div className="mobile-nav-inner">
          {([
            { id: 'dashboard' as AppTab, label: 'Dashboard', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25V18z"/></svg> },
            { id: 'narrative' as AppTab, label: 'Narratives', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75"/></svg> },
            { id: 'inject' as AppTab, label: 'Inject', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg> },
            { id: 'rebalance' as AppTab, label: 'Rebalance', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg> },
            { id: 'history' as AppTab, label: 'History', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { id: 'settings' as AppTab, label: 'Settings', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
          ] as const).filter(item => ['dashboard', 'inject', 'rebalance', 'settings'].includes(item.id)).map(item => (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-btn${activeTab === item.id ? ' active' : ''}`}
              onClick={() => { setMobileMoreOpen(false); handleTabChange(item.id) }}
              aria-label={item.label}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className={`mobile-nav-btn${mobileMoreOpen || activeTab === 'history' || activeTab === 'narrative' ? ' active' : ''}`}
            onClick={() => setMobileMoreOpen(value => !value)}
            aria-label="More navigation"
            aria-expanded={mobileMoreOpen}
          >
            <span aria-hidden="true" style={{ fontSize: '1.15rem', lineHeight: 1 }}>•••</span>
            More
          </button>
        </div>
        {mobileMoreOpen && (
          <div className="mobile-more-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMobileMoreOpen(false); handleTabChange('history') }}>History</button>
            <button type="button" role="menuitem" onClick={() => { setMobileMoreOpen(false); handleTabChange('narrative') }}>Narratives</button>
          </div>
        )}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      <PortfolioApp />
    </AuthGate>
  )
}
