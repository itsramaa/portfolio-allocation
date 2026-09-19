// ─── Inject Cash Tab ─────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react'
import type { Asset, InjectionResult, TargetAllocation, CurrencyCode } from '../types'
import { calculateInjection, fmtUSDT, fmtPct } from '../portfolio'
import { CURRENCIES, convertCurrencyToUSD, convertUSDToCurrency, formatCurrencyValue } from '../currency'

interface InjectProps {
  assets: Asset[]
  targets: TargetAllocation
  currency: CurrencyCode
  rates: Record<string, number>
  onNavigateSettings: () => void
}

export function Inject({ assets, targets, currency, rates, onNavigateSettings }: InjectProps) {
  // Input currency denomination: either the app's selected currency or directly USD
  const [inputCurrency, setInputCurrency] = useState<CurrencyCode>(currency)
  const [inputVal, setInputVal] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Keep inputCurrency in sync if settings currency changes
  useEffect(() => {
    setInputCurrency(currency)
  }, [currency])

  const isNonUSD = currency !== 'USD'
  const activeRate = rates[currency] ?? 1
  const currencyMeta = CURRENCIES[inputCurrency] || CURRENCIES.USD

  const parsedNum = parseFloat(inputVal.replace(/,/g, '')) || 0

  // Calculate actual USDT value deployed
  const injectionUSDT = useMemo(() => {
    if (parsedNum <= 0) return 0
    if (inputCurrency === 'USD') {
      return parsedNum
    }
    return convertCurrencyToUSD(parsedNum, inputCurrency, rates)
  }, [parsedNum, inputCurrency, rates])

  const totalPortfolio = useMemo(() => assets.reduce((s, a) => s + a.usdtValue, 0), [assets])
  const injectionPct = totalPortfolio > 0 && injectionUSDT > 0
    ? (injectionUSDT / totalPortfolio) * 100
    : 0

  const results: InjectionResult[] = useMemo(() => {
    if (injectionUSDT <= 0 || assets.length === 0) return []
    return calculateInjection(assets, injectionUSDT, targets)
  }, [assets, injectionUSDT, targets])

  const hasTargets = Object.values(targets).some(v => v > 0)
  const targetSum = Object.values(targets).reduce((s, v) => s + v, 0)

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  // Convert input value between Local Currency and USD
  const handleToggleConvert = () => {
    if (inputCurrency === 'USD') {
      // Convert USD -> Local Currency
      const converted = convertUSDToCurrency(parsedNum, currency, rates)
      setInputCurrency(currency)
      setInputVal(currency === 'IDR' || currency === 'JPY' ? String(Math.round(converted)) : converted.toFixed(2))
    } else {
      // Convert Local Currency -> USD
      const converted = convertCurrencyToUSD(parsedNum, inputCurrency, rates)
      setInputCurrency('USD')
      setInputVal(converted.toFixed(2))
    }
    setSubmitted(false)
  }

  if (!hasTargets) {
    return (
      <div className="surface-card fade-up" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎯</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#F0B90B', marginBottom: '0.5rem' }}>
          Target Allocation Required
        </div>
        <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.85rem', maxWidth: 420, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
          You need to set your ideal portfolio percentages (e.g. BTC 40%, ETH 30%, SOL 20%, USDT 10%) before using the cash injection calculator.
        </p>
        <button id="inject-go-to-settings" className="btn btn-primary btn-sm mono" onClick={onNavigateSettings}>
          Open Settings & Configure Targets
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 840 }} className="fade-up">

      {/* Input card */}
      <div className="surface-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'oklch(95% 0.01 240)', letterSpacing: '-0.02em' }}>
              Cash Injection Rebalancing Calculator
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'oklch(55% 0.01 240)', marginTop: '0.25rem', lineHeight: 1.5 }}>
              Enter incoming fiat or stablecoin capital. The algorithm calculates the optimal buy plan to close underweight positions without selling existing assets.
            </p>
          </div>

          {/* Currency denomination switch */}
          {isNonUSD && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'oklch(15% 0.012 240)', padding: '0.25rem', borderRadius: '0.375rem', border: '1px solid oklch(100% 0 0 / 0.08)' }}>
              <button
                type="button"
                className={`btn btn-xs ${inputCurrency === currency ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  if (inputCurrency !== currency) handleToggleConvert()
                }}
              >
                {currency} ({CURRENCIES[currency].symbol})
              </button>
              <button
                type="button"
                className={`btn btn-xs ${inputCurrency === 'USD' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  if (inputCurrency !== 'USD') handleToggleConvert()
                }}
              >
                USD ($)
              </button>
            </div>
          )}
        </div>

        {/* Target warning if sum != 100 */}
        {Math.abs(targetSum - 100) > 0.5 && (
          <div role="alert" className="alert alert-warning mb-4" style={{ fontSize: '0.82rem' }}>
            <span>⚠️ Target allocations sum to <strong>{targetSum.toFixed(1)}%</strong> (should equal 100%). Update in Settings for accurate results.</span>
          </div>
        )}

        <form id="injection-form" onSubmit={handleCalculate} style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label htmlFor="injection-amount" style={{ fontSize: '0.72rem', color: 'oklch(55% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                  Deposit Amount ({inputCurrency})
                </label>
                {isNonUSD && (
                  <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)' }}>
                    Rate: 1 USD = {formatCurrencyValue(activeRate, currency)}
                  </span>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <span className="mono" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#F0B90B', fontWeight: 700, pointerEvents: 'none', zIndex: 1 }}>
                  {currencyMeta.symbol}
                </span>
                <input
                  id="injection-amount"
                  type="text"
                  className="input w-full mono"
                  placeholder={inputCurrency === 'IDR' ? 'e.g. 15000000' : '0.00'}
                  value={inputVal}
                  onChange={e => {
                    setInputVal(e.target.value)
                    setSubmitted(false)
                  }}
                  style={{ paddingLeft: inputCurrency === 'IDR' ? '2.75rem' : '2.2rem', fontSize: '1.15rem' }}
                  autoFocus
                />
              </div>

              {/* Conversion indicator & action button */}
              {isNonUSD && parsedNum > 0 && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '0.375rem',
                  background: 'oklch(14% 0.012 240)',
                  border: '1px solid oklch(80% 0.18 85 / 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}>
                  <div style={{ fontSize: '0.82rem' }}>
                    {inputCurrency !== 'USD' ? (
                      <span>
                        Equivalent:{' '}
                        <strong className="mono" style={{ color: '#F0B90B' }}>
                          ${injectionUSDT.toFixed(2)} USDT
                        </strong>
                      </span>
                    ) : (
                      <span>
                        Equivalent:{' '}
                        <strong className="mono" style={{ color: '#F0B90B' }}>
                          {formatCurrencyValue(convertUSDToCurrency(parsedNum, currency, rates), currency)} {currency}
                        </strong>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    id="toggle-convert-currency"
                    onClick={handleToggleConvert}
                    className="btn btn-xs btn-outline btn-warning mono"
                  >
                    ⇄ Convert to {inputCurrency === 'USD' ? currency : 'USD'}
                  </button>
                </div>
              )}

              {injectionUSDT > 0 && totalPortfolio > 0 && (
                <div className="mono" style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'oklch(55% 0.01 240)' }}>
                  = {fmtPct(injectionPct)} of existing portfolio ({fmtUSDT(totalPortfolio)})
                </div>
              )}
            </div>

            <button
              id="injection-calculate-btn"
              type="submit"
              className="btn btn-primary"
              disabled={injectionUSDT <= 0}
              style={{ minHeight: '3rem', padding: '0 1.5rem' }}
            >
              Calculate Buy Plan
            </button>
          </div>
        </form>
      </div>

      {/* Results Table */}
      {(submitted || injectionUSDT > 0) && results.length > 0 && (
        <div className="surface-card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid oklch(100% 0 0 / 0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                Recommended Buy Plan
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F0B90B' }}>
                  {fmtUSDT(injectionUSDT)} Total
                </span>
                {isNonUSD && (
                  <span className="mono" style={{ fontSize: '0.82rem', color: 'oklch(60% 0.01 240)' }}>
                    (≈ {formatCurrencyValue(convertUSDToCurrency(injectionUSDT, currency, rates), currency)})
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'oklch(45% 0.01 240)', fontStyle: 'italic' }}>
              Execution note: Purchase spot orders on Binance using USDT
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.08)', color: 'oklch(50% 0.01 240)', textAlign: 'right' }}>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontWeight: 600 }}>Asset</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Buy (USDT)</th>
                  {isNonUSD && (
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Est. in {currency}</th>
                  )}
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>% of Cash</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>New Weight</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textAlign: 'left', minWidth: 140 }}>Target Gap Closed</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const asset = assets.find(a => a.symbol === r.symbol)
                  const color = asset?.logoColor ?? '#848E9C'
                  const targetPct = targets[r.symbol] ?? 0
                  const localValue = convertUSDToCurrency(r.buyUSDT, currency, rates)

                  return (
                    <tr
                      key={r.symbol}
                      style={{ borderBottom: i < results.length - 1 ? '1px solid oklch(100% 0 0 / 0.04)' : 'none' }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: `${color}22`, border: `1px solid ${color}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.68rem', fontWeight: 700, color,
                            fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
                          }}>
                            {r.symbol.slice(0, 3)}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span className="mono" style={{ fontWeight: 700, color: 'oklch(92% 0.01 240)' }}>
                                {r.symbol}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)' }}>
                              Target: {targetPct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: 'oklch(95% 0.01 240)' }}>
                        {fmtUSDT(r.buyUSDT)}
                      </td>

                      {isNonUSD && (
                        <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#F0B90B' }}>
                          {formatCurrencyValue(localValue, currency)}
                        </td>
                      )}

                      <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'oklch(70% 0.01 240)' }}>
                        {r.buyPct.toFixed(1)}%
                      </td>

                      <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>
                        {r.newWeight.toFixed(1)}%
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ flex: 1, height: 6, background: 'oklch(20% 0.015 240)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(100, r.gapClosed)}%`,
                              background: '#22c55e',
                              borderRadius: 3,
                            }} />
                          </div>
                          <span className="mono" style={{ fontSize: '0.72rem', color: 'oklch(60% 0.01 240)', width: 34, textAlign: 'right' }}>
                            {Math.round(r.gapClosed)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
