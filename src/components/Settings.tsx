// ─── Settings Tab ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import type { ApiCredentials, Asset, TargetAllocation, CurrencyCode, AlphaAssetConfig } from '../types'
import type { BinanceAlphaToken } from '../binanceApi'
import { saveCredentials, saveTargetAllocation, clearCredentials, saveAlphaAssets } from '../storage'
import { testConnection } from '../binanceApi'
import { CURRENCIES, formatCurrencyValue } from '../currency'

interface SettingsProps {
  credentials: ApiCredentials | null
  targets: TargetAllocation
  assets: Asset[]
  currency: CurrencyCode
  rates: Record<string, number>
  ratesLastUpdated: number
  alphaAssets: AlphaAssetConfig[]
  alphaTokenList?: BinanceAlphaToken[]
  onCredentialsChange: (creds: ApiCredentials | null) => void
  onTargetsChange: (targets: TargetAllocation) => void
  onCurrencyChange: (currency: CurrencyCode) => void
  onRefreshRates: () => Promise<void>
  onAlphaAssetsChange: (assets: AlphaAssetConfig[]) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'oklch(50% 0.01 240)', fontWeight: 600, marginBottom: '1.25rem',
    }}>
      {children}
    </div>
  )
}

export function Settings({
  credentials,
  targets,
  assets,
  currency,
  rates,
  ratesLastUpdated,
  alphaAssets = [],
  alphaTokenList = [],
  onCredentialsChange,
  onTargetsChange,
  onCurrencyChange,
  onRefreshRates,
  onAlphaAssetsChange,
}: SettingsProps) {
  // API Key section
  const [apiKey, setApiKey] = useState(credentials?.apiKey ?? '')
  const [apiSecret, setApiSecret] = useState(credentials?.apiSecret ?? '')
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  // Currency section
  const [refreshingRates, setRefreshingRates] = useState(false)
  const [rateRefreshSuccess, setRateRefreshSuccess] = useState(false)

  // Target allocation section
  const [localTargets, setLocalTargets] = useState<TargetAllocation>(() => ({ ...targets }))
  const [newSymbol, setNewSymbol] = useState('')

  // Binance Alpha section
  const [alphaSymbol, setAlphaSymbol] = useState('')
  const [alphaName, setAlphaName] = useState('')
  const [alphaAmount, setAlphaAmount] = useState('')
  const [alphaPrice, setAlphaPrice] = useState('')
  const [alphaTarget, setAlphaTarget] = useState('')

  const targetSum = Object.values(localTargets).reduce((s, v) => s + v, 0)
  const targetValid = Math.abs(targetSum - 100) < 0.5

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    setTestError(null)
    try {
      const creds: ApiCredentials = { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }
      await testConnection(creds)
      setTestResult('ok')
    } catch (e) {
      setTestResult('fail')
      setTestError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSaveCredentials = () => {
    const creds: ApiCredentials = { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }
    saveCredentials(creds)
    onCredentialsChange(creds)
  }

  const handleDisconnect = () => {
    if (!confirm('Remove your API key from this browser?')) return
    clearCredentials()
    setApiKey('')
    setApiSecret('')
    onCredentialsChange(null)
  }

  const handleTargetChange = (symbol: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num) || num < 0) return
    setLocalTargets(prev => ({ ...prev, [symbol]: num }))
  }

  const handleRemoveTarget = (symbol: string) => {
    setLocalTargets(prev => {
      const next = { ...prev }
      delete next[symbol]
      return next
    })
  }

  const handleAddSymbol = () => {
    const sym = newSymbol.trim().toUpperCase()
    if (!sym) return
    if (localTargets[sym] !== undefined) return
    setLocalTargets(prev => ({ ...prev, [sym]: 0 }))
    setNewSymbol('')
  }

  const handleSaveTargets = () => {
    const cleaned: TargetAllocation = {}
    for (const [k, v] of Object.entries(localTargets)) {
      if (v > 0) cleaned[k] = v
    }
    saveTargetAllocation(cleaned)
    onTargetsChange(cleaned)
  }

  // Populate targets from holdings if not yet set
  const handleAutoPopulate = () => {
    const auto: TargetAllocation = {}
    for (const asset of assets) {
      if (!localTargets[asset.symbol]) {
        auto[asset.symbol] = parseFloat(asset.currentPct.toFixed(1))
      }
    }
    setLocalTargets(prev => ({ ...prev, ...auto }))
  }

  const handleRefreshFx = async () => {
    setRefreshingRates(true)
    setRateRefreshSuccess(false)
    try {
      await onRefreshRates()
      setRateRefreshSuccess(true)
      setTimeout(() => setRateRefreshSuccess(false), 3000)
    } catch {
      // ignore
    } finally {
      setRefreshingRates(false)
    }
  }

  const handleAddAlpha = () => {
    const sym = alphaSymbol.trim().toUpperCase()
    if (!sym) return
    const amount = parseFloat(alphaAmount) || 0
    const price = parseFloat(alphaPrice) || 0
    const target = parseFloat(alphaTarget) || 0

    const updated: AlphaAssetConfig[] = [
      ...alphaAssets.filter(a => a.symbol !== sym),
      {
        id: sym.toLowerCase(),
        symbol: sym,
        name: alphaName.trim() || sym,
        amount,
        priceUSDT: price,
        targetPct: target,
      },
    ]
    saveAlphaAssets(updated)
    onAlphaAssetsChange(updated)

    if (target > 0) {
      setLocalTargets(prev => ({ ...prev, [sym]: target }))
    }

    setAlphaSymbol('')
    setAlphaName('')
    setAlphaAmount('')
    setAlphaPrice('')
    setAlphaTarget('')
  }

  const handleRemoveAlpha = (sym: string) => {
    const updated = alphaAssets.filter(a => a.symbol !== sym)
    saveAlphaAssets(updated)
    onAlphaAssetsChange(updated)
  }

  const handlePresetAlpha = (preset: { symbol: string; name: string; priceUSDT: number; targetPct: number }) => {
    setAlphaSymbol(preset.symbol)
    setAlphaName(preset.name)
    setAlphaPrice(String(preset.priceUSDT))
    setAlphaTarget(String(preset.targetPct))
    setAlphaAmount('100')
  }

  useEffect(() => {
    setLocalTargets({ ...targets })
  }, [targets])

  const activeRate = rates[currency] ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: 640 }} className="fade-up">

      {/* ── Currency & Valuation Preferences ──────────────────────────── */}
      <div className="surface-card" style={{ padding: '1.75rem' }}>
        <SectionTitle>Currency & Conversion Preferences</SectionTitle>

        <p style={{ fontSize: '0.82rem', color: 'oklch(60% 0.01 240)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Choose your local fiat currency. The default is <strong>USD</strong>. If you select IDR or another currency, the cash injection tab will provide instant conversion from your fiat deposits into USDT.
        </p>

        {/* Currency Pill Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
            const item = CURRENCIES[code]
            const isSelected = currency === code
            return (
              <button
                key={code}
                id={`currency-select-${code}`}
                type="button"
                onClick={() => onCurrencyChange(code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.375rem',
                  border: isSelected ? '1px solid #F0B90B' : '1px solid oklch(100% 0 0 / 0.08)',
                  background: isSelected ? 'oklch(80% 0.18 85 / 0.12)' : 'oklch(14% 0.012 240)',
                  color: isSelected ? '#F0B90B' : 'oklch(80% 0.01 240)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span className="mono" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {item.symbol}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.code}</span>
                  <span style={{ fontSize: '0.68rem', color: 'oklch(50% 0.01 240)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Active Rate Info Box */}
        <div style={{
          padding: '1rem',
          borderRadius: '0.375rem',
          background: 'oklch(12% 0.012 240)',
          border: '1px solid oklch(100% 0 0 / 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Active Exchange Rate
              </div>
              <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'oklch(95% 0.01 240)', marginTop: '0.2rem' }}>
                1 USD = {formatCurrencyValue(activeRate, currency)} {currency}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {rateRefreshSuccess && (
                <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>✓ Updated</span>
              )}
              <button
                type="button"
                id="refresh-fx-rates"
                className="btn btn-xs btn-ghost mono"
                style={{ border: '1px solid oklch(100% 0 0 / 0.1)' }}
                onClick={handleRefreshFx}
                disabled={refreshingRates}
              >
                {refreshingRates ? <span className="loading loading-spinner loading-xs" /> : '↻'} Sync Rates
              </button>
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'oklch(45% 0.01 240)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Free API: Open Exchange Rates (public, no key required)</span>
            <span>Synced: {new Date(ratesLastUpdated).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* ── API Configuration ─────────────────────────────────────────── */}
      <div className="surface-card" style={{ padding: '1.75rem' }}>
        <SectionTitle>API Configuration</SectionTitle>

        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="settings-api-key" style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', display: 'block', marginBottom: '0.5rem' }}>
            API Key
          </label>
          <input
            id="settings-api-key"
            type="text"
            className="input w-full mono"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Binance read-only API key"
            style={{ fontSize: '0.8rem' }}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="settings-api-secret" style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', display: 'block', marginBottom: '0.5rem' }}>
            API Secret
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="settings-api-secret"
              type={showSecret ? 'text' : 'password'}
              className="input w-full mono"
              value={apiSecret}
              onChange={e => setApiSecret(e.target.value)}
              placeholder="Binance API secret"
              style={{ fontSize: '0.8rem', paddingRight: '2.5rem' }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(45% 0.01 240)', padding: '0.2rem',
              }}
            >
              {showSecret ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {testResult === 'ok' && (
          <div role="alert" className="alert alert-success mb-4" style={{ fontSize: '0.82rem' }}>
            ✓ Connection successful! Read-only permissions confirmed.
          </div>
        )}
        {testResult === 'fail' && (
          <div role="alert" className="alert alert-error mb-4" style={{ fontSize: '0.82rem' }}>
            ✕ {testError || 'Connection failed'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            id="settings-test-btn"
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleTestConnection}
            disabled={testing || !apiKey || !apiSecret}
            style={{ border: '1px solid oklch(100% 0 0 / 0.1)' }}
          >
            {testing ? <span className="loading loading-spinner loading-xs" /> : null}
            Test Connection
          </button>
          <button
            id="settings-save-creds"
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveCredentials}
            disabled={!apiKey || !apiSecret}
          >
            Save Credentials
          </button>
          {credentials && (
            <button
              id="settings-disconnect"
              type="button"
              className="btn btn-outline btn-error btn-sm"
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* ── Target Allocation ─────────────────────────────────────────── */}
      <div className="surface-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <SectionTitle>Target Allocation</SectionTitle>
          {assets.length > 0 && (
            <button
              id="settings-auto-populate"
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={handleAutoPopulate}
              style={{ color: '#F0B90B', border: '1px solid oklch(100% 0 0 / 0.1)' }}
            >
              Auto-populate from Holdings
            </button>
          )}
        </div>

        {/* Target inputs list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {Object.entries(localTargets).map(([sym, val]) => (
            <div key={sym} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: '0.75rem', alignItems: 'center' }}>
              <span className="mono" style={{ fontWeight: 600, color: 'oklch(90% 0.01 240)', fontSize: '0.9rem' }}>
                {sym}
              </span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id={`target-weight-${sym}`}
                  type="number"
                  className="input input-sm w-full mono"
                  value={val}
                  onChange={e => handleTargetChange(sym, e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  style={{ paddingRight: '1.5rem', textAlign: 'right' }}
                />
                <span className="mono" style={{ position: 'absolute', right: '0.5rem', color: 'oklch(50% 0.01 240)', fontSize: '0.8rem', pointerEvents: 'none' }}>
                  %
                </span>
              </div>
              <button
                id={`remove-target-${sym}`}
                type="button"
                onClick={() => handleRemoveTarget(sym)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(45% 0.01 240)', padding: '0.25rem', display: 'flex', justifyContent: 'center' }}
                aria-label={`Remove ${sym}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Sum indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, height: 6, background: 'oklch(20% 0.015 240)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, targetSum)}%`,
              background: targetValid ? '#22c55e' : targetSum > 100 ? '#ef4444' : '#F0B90B',
              transition: 'width 0.2s, background 0.2s',
            }} />
          </div>
          <span className="mono" style={{ fontSize: '0.82rem', color: targetValid ? '#22c55e' : '#ef4444', minWidth: '3.5rem', textAlign: 'right', fontWeight: 600 }}>
            {targetSum.toFixed(1)}%
          </span>
        </div>

        {/* Add new symbol */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <input
            id="settings-add-symbol"
            type="text"
            className="input input-sm mono"
            placeholder="Add symbol (e.g. BTC, ETH)"
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAddSymbol()}
            style={{ flex: 1 }}
          />
          <button
            id="settings-add-symbol-btn"
            className="btn btn-sm btn-ghost"
            onClick={handleAddSymbol}
            disabled={!newSymbol.trim()}
            style={{ border: '1px solid oklch(100% 0 0 / 0.1)' }}
          >
            + Add
          </button>
          <button
            id="settings-add-futures"
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (localTargets['FUTURES_USDT'] === undefined) {
                setLocalTargets(prev => ({ ...prev, FUTURES_USDT: 0 }))
              }
            }}
            disabled={localTargets.hasOwnProperty('FUTURES_USDT')}
            style={{ border: '1px solid oklch(100% 0 0 / 0.1)', color: '#02C076' }}
          >
            + Futures USDT
          </button>
          <button
            id="settings-add-other"
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setNewSymbol('OTHER')
              handleAddSymbol()
            }}
            disabled={localTargets.hasOwnProperty('OTHER')}
            style={{ border: '1px solid oklch(100% 0 0 / 0.1)', color: '#F0B90B' }}
          >
            + Other
          </button>
        </div>

        <button
          id="settings-save-targets"
          className="btn btn-primary btn-sm"
          onClick={handleSaveTargets}
          disabled={!targetValid && Object.keys(localTargets).length > 0}
        >
          Save Target Allocation
        </button>

        <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'oklch(45% 0.01 240)' }}>
          Target allocations should sum to 100%. Use "Other" as a catch-all for assets not explicitly configured (e.g. GRASS, VIRTUAL, etc.).
        </p>
      </div>

      {/* ── Binance Alpha & Early-Stage Assets ────────────────────────── */}
      <div className="surface-card" style={{ padding: '1.75rem', border: '1px solid oklch(60% 0.25 300 / 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <SectionTitle>Binance Alpha & Pre-Listing Assets</SectionTitle>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'oklch(60% 0.01 240)', lineHeight: 1.5, marginTop: '-0.75rem' }}>
              Configure pre-market, early-stage, or on-chain tokens from Binance Alpha / Binance Web3. These assets are tracked with a distinctive purple badge and participate in portfolio metrics and cash injection buy plans.
            </p>
          </div>
        </div>

        {/* Popular Presets */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Quick Presets
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { symbol: 'PONS', name: 'Ponke on Sol', priceUSDT: 0.15, targetPct: 5 },
              { symbol: 'MONAD', name: 'Monad Pre-market', priceUSDT: 4.5, targetPct: 5 },
              { symbol: 'GRASS', name: 'Grass Network', priceUSDT: 1.8, targetPct: 3 },
              { symbol: 'VIRTUAL', name: 'Virtuals Protocol', priceUSDT: 1.2, targetPct: 3 },
            ].map(preset => (
              <button
                key={preset.symbol}
                type="button"
                className="btn btn-xs btn-ghost mono"
                style={{
                  border: '1px solid oklch(60% 0.25 300 / 0.3)',
                  color: '#C084FC',
                  background: 'oklch(60% 0.25 300 / 0.1)',
                }}
                onClick={() => handlePresetAlpha(preset)}
              >
                + {preset.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Existing Alpha Assets List */}
        {alphaAssets.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Configured Alpha Tokens ({alphaAssets.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alphaAssets.map(alpha => {
                const totalVal = alpha.amount * alpha.priceUSDT
                return (
                  <div
                    key={alpha.symbol}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '0.375rem',
                      background: 'oklch(14% 0.012 240)',
                      border: '1px solid oklch(60% 0.25 300 / 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'oklch(60% 0.25 300 / 0.2)',
                          color: '#C084FC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          fontFamily: 'JetBrains Mono',
                        }}
                      >
                        ⚡
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="mono" style={{ fontWeight: 700, color: '#C084FC', fontSize: '0.85rem' }}>
                            {alpha.symbol}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'oklch(60% 0.01 240)' }}>
                            {alpha.name}
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)' }}>
                          {alpha.amount.toLocaleString()} @ ${alpha.priceUSDT} USDT · Total: ${totalVal.toFixed(2)}
                          {alpha.targetPct > 0 && ` · Target: ${alpha.targetPct}%`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAlpha(alpha.symbol)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'oklch(50% 0.01 240)',
                        padding: '0.25rem',
                      }}
                      title="Remove token"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add/Edit Alpha Token Form */}
        <div style={{
          padding: '1rem',
          borderRadius: '0.375rem',
          background: 'oklch(12% 0.012 240)',
          border: '1px solid oklch(100% 0 0 / 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C084FC' }}>
              Add / Update Binance Alpha Token
            </div>
            {alphaTokenList && alphaTokenList.length > 0 && (
              <div style={{ fontSize: '0.68rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                Binance Alpha API Live ({alphaTokenList.length} tokens)
              </div>
            )}
          </div>

          {/* Quick Dropdown Select from Binance Alpha API */}
          {alphaTokenList && alphaTokenList.length > 0 && (
            <div>
              <label style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', display: 'block', marginBottom: '0.25rem' }}>
                Select Token from Binance Alpha List (Auto-populates Live Price)
              </label>
              <select
                className="select select-sm w-full mono"
                onChange={e => {
                  const selected = alphaTokenList.find(t => t.symbol === e.target.value)
                  if (selected) {
                    setAlphaSymbol(selected.symbol)
                    setAlphaName(selected.name || selected.symbol)
                    if (selected.price > 0) setAlphaPrice(String(selected.price))
                  }
                }}
                defaultValue=""
                style={{ fontSize: '0.8rem' }}
              >
                <option value="" disabled>-- Select Alpha Token from Binance API --</option>
                {alphaTokenList.map(t => (
                  <option key={t.tokenId || t.alphaId || t.symbol} value={t.symbol}>
                    {t.symbol} ({t.name}) — ${t.price > 0 ? t.price : 'Auto'} [{t.alphaId || 'ALPHA'}]
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', display: 'block', marginBottom: '0.25rem' }}>
                Symbol (e.g. FARTCOIN, KOMA)
              </label>
              <input
                type="text"
                className="input input-sm w-full mono"
                placeholder="FARTCOIN"
                value={alphaSymbol}
                onChange={e => {
                  const sym = e.target.value.toUpperCase()
                  setAlphaSymbol(sym)
                  const match = alphaTokenList?.find(t => t.symbol === sym)
                  if (match) {
                    if (match.name) setAlphaName(match.name)
                    if (match.price > 0) setAlphaPrice(String(match.price))
                  }
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', display: 'block', marginBottom: '0.25rem' }}>
                Token Name
              </label>
              <input
                type="text"
                className="input input-sm w-full"
                placeholder="Fartcoin"
                value={alphaName}
                onChange={e => setAlphaName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', display: 'block', marginBottom: '0.25rem' }}>
                Amount Held
              </label>
              <input
                type="number"
                className="input input-sm w-full mono"
                placeholder="1000"
                value={alphaAmount}
                onChange={e => setAlphaAmount(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', display: 'block', marginBottom: '0.25rem' }}>
                Price (USDT)
              </label>
              <input
                type="number"
                className="input input-sm w-full mono"
                placeholder="Live from API"
                value={alphaPrice}
                onChange={e => setAlphaPrice(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', display: 'block', marginBottom: '0.25rem' }}>
                Target Weight (%)
              </label>
              <input
                type="number"
                className="input input-sm w-full mono"
                placeholder="5"
                value={alphaTarget}
                onChange={e => setAlphaTarget(e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm mono"
            style={{
              background: '#9333ea',
              color: '#ffffff',
              border: 'none',
              marginTop: '0.25rem',
            }}
            onClick={handleAddAlpha}
            disabled={!alphaSymbol.trim()}
          >
            + Save Binance Alpha Asset
          </button>
        </div>
      </div>
    </div>
  )
}
