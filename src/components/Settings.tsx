// ─── Settings Tab ─────────────────────────────────────────────────────────────
import type { ApiCredentials, Asset, TargetAllocation, CurrencyCode } from '../types'
import { CURRENCIES, formatCurrencyValue } from '../utils/currency'
import { assetColor } from '../lib/portfolio'
import { useSettings } from '../hooks/useSettings'

interface SettingsProps {
  credentials: ApiCredentials | null
  targets: TargetAllocation
  assets: Asset[]
  prices?: Record<string, number>
  currency: CurrencyCode
  rates: Record<string, number>
  ratesLastUpdated: number
  onCredentialsChange: (creds: ApiCredentials | null) => void
  onTargetsChange: (targets: TargetAllocation) => void
  onCurrencyChange: (currency: CurrencyCode) => void
  onRefreshRates: () => Promise<void>
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
  prices = {},
  currency,
  rates,
  ratesLastUpdated,
  onCredentialsChange,
  onTargetsChange,
  onCurrencyChange,
  onRefreshRates,
}: SettingsProps) {
  const {
    apiKey, setApiKey, apiSecret, setApiSecret, showSecret, setShowSecret,
    testing, savingCredentials, credentialsMessage, testResult, testError,
    refreshingRates, rateRefreshSuccess, activeRate, logout,
    currentPass, setCurrentPass, newPass, setNewPass, passLoading, passMsg,
    localTargets, searchTerm, setSearchTerm, dropdownOpen, setDropdownOpen, dropdownRef,
    targetSum, targetValid, filteredCoins,
    handleTestConnection, handleSaveCredentials, handleDisconnect, handleChangePassword,
    handleTargetChange, handleRemoveTarget, handleSelectCoin, handleSaveTargets,
    handleAutoPopulate, handleRefreshFx,
  } = useSettings({ credentials, targets, assets, prices, currency, rates, onCredentialsChange, onTargetsChange, onRefreshRates })

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

        {credentials && (
          <div role="status" className="alert alert-success mb-5" style={{ fontSize: '0.8rem' }}>
            <span>✓ API credentials sudah terkonfigurasi di server.</span>
          </div>
        )}

        <p style={{ fontSize: '0.78rem', color: 'oklch(55% 0.01 240)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Credentials disimpan terenkripsi di server. Setelah disimpan, field akan dikosongkan dan secret tidak akan pernah ditampilkan kembali.
        </p>
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

        {credentialsMessage && (
          <div role="alert" className={`alert ${credentialsMessage.type === 'ok' ? 'alert-success' : 'alert-error'} mb-4`} style={{ fontSize: '0.82rem' }}>
            {credentialsMessage.type === 'ok' ? '✓' : '✕'} {credentialsMessage.text}
          </div>
        )}

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
            disabled={savingCredentials || testing || !apiKey || !apiSecret}
          >
            {savingCredentials ? <span className="loading loading-spinner loading-xs" /> : null}
            {savingCredentials ? 'Saving…' : 'Save Credentials'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: `${assetColor(sym, sym.startsWith('FUTURES'))}22`,
                    border: `1px solid ${assetColor(sym, sym.startsWith('FUTURES'))}44`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: assetColor(sym, sym.startsWith('FUTURES')),
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {sym.slice(0, 3)}
                </span>
                <span className="mono" style={{ fontWeight: 600, color: 'oklch(90% 0.01 240)', fontSize: '0.9rem' }}>
                  {sym}
                </span>
              </div>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
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

        {/* ── Searchable Coin Dropdown Selector ───────────────────────────────── */}
        <div style={{ marginBottom: '1.5rem', position: 'relative' }} ref={dropdownRef}>
          <label style={{ fontSize: '0.75rem', color: 'oklch(60% 0.01 240)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
            Add Coin to Target Allocation
          </label>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                id="settings-coin-search-input"
                type="text"
                className="input input-sm w-full mono"
                placeholder="🔍 Search coin (e.g. BTC, ETH, SOL, BNB...)"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setDropdownOpen(true)
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    handleSelectCoin(searchTerm)
                  }
                }}
                style={{ fontSize: '0.82rem' }}
                autoComplete="off"
              />

              {/* Searchable Dropdown Overlay */}
              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.35rem',
                    maxHeight: '230px',
                    overflowY: 'auto',
                    background: 'oklch(16% 0.015 240)',
                    border: '1px solid oklch(100% 0 0 / 0.15)',
                    borderRadius: '0.5rem',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
                    zIndex: 100,
                    padding: '0.35rem',
                  }}
                >
                  {filteredCoins.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleSelectCoin(searchTerm)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        color: '#F0B90B',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      className="table-row-hover"
                    >
                      <span className="mono">+ Add custom coin "<strong>{searchTerm.toUpperCase()}</strong>"</span>
                      <span className="badge badge-sm badge-warning">Custom</span>
                    </button>
                  ) : (
                    filteredCoins.map(coin => {
                      const isAdded = localTargets[coin.symbol] !== undefined
                      const isFutures = coin.symbol.startsWith('FUTURES')
                      const color = assetColor(coin.symbol, isFutures)

                      return (
                        <button
                          key={coin.symbol}
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleSelectCoin(coin.symbol)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            textAlign: 'left',
                            background: isAdded ? 'oklch(14% 0 0 / 0.3)' : 'none',
                            border: 'none',
                            color: isAdded ? 'oklch(50% 0.01 240)' : 'oklch(90% 0.01 240)',
                            cursor: isAdded ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'background 0.12s ease',
                          }}
                          className={isAdded ? '' : 'table-row-hover'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: `${color}22`,
                                border: `1px solid ${color}44`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                color,
                                fontFamily: 'JetBrains Mono, monospace',
                              }}
                            >
                              {coin.symbol.slice(0, 3)}
                            </span>
                            <span className="mono" style={{ fontWeight: 700 }}>
                              {coin.symbol}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {coin.price !== undefined && coin.price > 0 && (
                              <span className="mono" style={{ fontSize: '0.72rem', color: 'oklch(60% 0.01 240)' }}>
                                ${coin.price >= 1000 ? coin.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : coin.price.toFixed(4)}
                              </span>
                            )}
                            {isAdded ? (
                              <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 600 }}>In Target</span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', color: '#F0B90B', fontWeight: 600 }}>+ Select</span>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* Shortcut Buttons */}
            <button
              id="settings-add-futures"
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => handleSelectCoin('FUTURES_USDT')}
              disabled={localTargets.hasOwnProperty('FUTURES_USDT')}
              style={{ border: '1px solid oklch(100% 0 0 / 0.1)', color: '#02C076' }}
            >
              + Futures USDT
            </button>
            <button
              id="settings-add-other"
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => handleSelectCoin('OTHER')}
              disabled={localTargets.hasOwnProperty('OTHER')}
              style={{ border: '1px solid oklch(100% 0 0 / 0.1)', color: '#F0B90B' }}
            >
              + Other
            </button>
          </div>
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
          Target allocations should sum to 100%. Select coins from the searchable dropdown above or use "Other" as a catch-all for remaining assets.
        </p>
      </div>

      {/* Security & Access Section (SQLite & Password) */}
      <div className="surface-card" style={{ padding: '1.5rem' }}>
        <SectionTitle>Security & Access Control</SectionTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'oklch(18% 0.01 240)',
              border: '1px solid oklch(100% 0 0 / 0.08)',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'oklch(90% 0.01 240)' }}>
                Database Storage: <span style={{ color: '#22c55e' }}>SQLite (Go Server)</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.2rem' }}>
                Semua konfigurasi, target, history, dan API keys tersimpan aman di server database SQLite lokal.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline btn-error mono"
              onClick={logout}
              style={{ fontSize: '0.75rem' }}
            >
              Lock / Logout
            </button>
          </div>

          <form onSubmit={handleChangePassword} style={{ maxWidth: 420 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'oklch(85% 0.01 240)', marginBottom: '0.75rem' }}>
              Ubah Password Dashboard
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'oklch(60% 0.01 240)', marginBottom: '0.25rem' }}>
                  Password Saat Ini
                </label>
                <input
                  type="password"
                  className="input input-sm w-full mono"
                  value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  placeholder="Password saat ini…"
                  required
                  style={{ background: 'oklch(18% 0.01 240)', border: '1px solid oklch(100% 0 0 / 0.1)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'oklch(60% 0.01 240)', marginBottom: '0.25rem' }}>
                  Password Baru (min. 4 karakter)
                </label>
                <input
                  type="password"
                  className="input input-sm w-full mono"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Password baru…"
                  required
                  minLength={4}
                  style={{ background: 'oklch(18% 0.01 240)', border: '1px solid oklch(100% 0 0 / 0.1)' }}
                />
              </div>

              {passMsg && (
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    background: passMsg.type === 'ok' ? 'oklch(25% 0.08 140 / 0.4)' : 'oklch(25% 0.08 25 / 0.4)',
                    color: passMsg.type === 'ok' ? '#22c55e' : '#ef4444',
                    border: `1px solid ${passMsg.type === 'ok' ? 'oklch(50% 0.15 140 / 0.4)' : 'oklch(50% 0.15 25 / 0.4)'}`,
                  }}
                >
                  {passMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={passLoading || !currentPass || !newPass}
                className="btn btn-sm btn-ghost mono"
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '0.25rem',
                  border: '1px solid oklch(100% 0 0 / 0.15)',
                  fontSize: '0.75rem',
                }}
              >
                {passLoading ? 'Menyimpan…' : 'Perbarui Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
