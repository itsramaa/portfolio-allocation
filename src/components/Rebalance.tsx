// ─── Rebalance Tab ───────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import type { Asset, TargetAllocation, CurrencyCode } from '../types'
import { calculateRebalance, fmtUSDT, fmtPct, assetColor, MIN_ORDER_USDT, type RebalanceItem } from '../portfolio'
import { convertUSDToCurrency, formatCurrencyValue } from '../currency'
import { CurrencyDisplay } from './CurrencyDisplay'

interface RebalanceProps {
  assets: Asset[]
  targets: TargetAllocation
  currency?: CurrencyCode
  rates?: Record<string, number>
}

function ActionBadge({ r }: { r: RebalanceItem }) {
  const isFutures = r.symbol === 'FUTURES_USDT' || r.symbol.startsWith('FUTURES_')
  let text = r.action.toUpperCase()
  let bg = r.action === 'sell' ? 'oklch(239% 0.082 120 / 0.15)' : 'oklch(142% 0.071 120 / 0.15)'
  let color = r.action === 'sell' ? '#ef4444' : '#22c55e'
  let border = r.action === 'sell' ? '1px solid oklch(239% 0.082 120 / 0.3)' : '1px solid oklch(142% 0.071 120 / 0.3)'

  if (isFutures) {
    if (r.action === 'buy') {
      text = 'SPOT ➔ FUT'; bg = 'oklch(160% 0.15 150 / 0.15)'; color = '#02C076'; border = '1px solid #02C07666'
    } else {
      text = 'FUT ➔ SPOT'; bg = 'oklch(200% 0.15 60 / 0.15)'; color = '#f59e0b'; border = '1px solid #f59e0b66'
    }
  }

  return (
    <span
      className="badge badge-sm mono"
      style={{ background: bg, color, border, fontWeight: 700, fontSize: '0.7rem', padding: '0.2rem 0.6rem', letterSpacing: '0.04em' }}
    >
      {text}
    </span>
  )
}

function RebalanceRow({
  r, idx, total, assets, currency, rates, isUSD, dimmed,
}: {
  r: RebalanceItem; idx: number; total: number
  assets: Asset[]; currency: CurrencyCode; rates: Record<string, number>; isUSD: boolean; dimmed?: boolean
}) {
  const isFutures = r.symbol === 'FUTURES_USDT' || r.symbol.startsWith('FUTURES_')
  const asset = assets.find(a => a.symbol === r.symbol)
  const color = asset?.logoColor ?? assetColor(r.symbol, isFutures)
  const localValue = convertUSDToCurrency(r.amountUSDT, currency, rates)
  const actionColor = r.action === 'sell' ? '#ef4444' : '#22c55e'

  return (
    <tr
      key={r.symbol}
      style={{
        borderBottom: idx < total - 1 ? '1px solid oklch(100% 0 0 / 0.04)' : 'none',
        opacity: dimmed ? 0.55 : 1,
      }}
      className="table-row-hover"
    >
      <td style={{ padding: '0.8rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%',
            background: `${color}22`, border: `1px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 700, color,
            fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
          }}>
            {r.symbol.slice(0, 3)}
          </span>
          <span className="mono" style={{ fontWeight: 700, color: dimmed ? 'oklch(60% 0.01 240)' : 'oklch(92% 0.01 240)' }}>
            {r.symbol}
          </span>
        </div>
      </td>

      <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
        <ActionBadge r={r} />
      </td>

      <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: 700, color: dimmed ? 'oklch(55% 0.01 240)' : actionColor }}>
        {fmtUSDT(r.amountUSDT)}
      </td>

      {!isUSD && (
        <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', color: dimmed ? 'oklch(45% 0.01 240)' : actionColor }}>
          {formatCurrencyValue(localValue, currency)}
        </td>
      )}

      <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', color: 'oklch(60% 0.01 240)' }}>
        {r.currentPct.toFixed(1)}%
      </td>

      <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', color: dimmed ? 'oklch(45% 0.01 240)' : '#22c55e' }}>
        {r.targetPct.toFixed(1)}%
      </td>

      <td style={{ padding: '0.8rem 1.25rem' }}>
        {r.belowMinOrder ? (
          <span style={{
            background: 'oklch(50% 0.12 85 / 0.15)',
            color: '#f59e0b',
            border: '1px solid oklch(70% 0.18 85 / 0.3)',
            borderRadius: '0.25rem',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.15rem 0.45rem',
            letterSpacing: '0.04em',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            BELOW MIN
          </span>
        ) : (
          <span className="mono" style={{ color: actionColor, fontWeight: 600, fontSize: '0.8rem' }}>
            {r.action === 'sell' ? '▼ ' : '▲ '}
            {fmtPct(r.newPct - r.currentPct)}
          </span>
        )}
      </td>
    </tr>
  )
}

export function Rebalance({ assets, targets, currency = 'USD', rates = {} }: RebalanceProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)

  const totalUSDT = useMemo(() => assets.reduce((s, a) => s + a.usdtValue, 0), [assets])
  const hasTargets = Object.values(targets).some(v => v > 0)
  const targetSum = Object.values(targets).reduce((s, v) => s + v, 0)
  const isUSD = currency === 'USD'

  const allResults = useMemo(() => {
    if (!confirmed || !hasTargets) return []
    return calculateRebalance(assets, targets)
  }, [assets, targets, confirmed, hasTargets])

  const actionable = useMemo(() => allResults.filter(r => !r.belowMinOrder), [allResults])
  const skipped    = useMemo(() => allResults.filter(r =>  r.belowMinOrder), [allResults])

  const sellTotal = useMemo(() => actionable.filter(r => r.action === 'sell').reduce((s, r) => s + r.amountUSDT, 0), [actionable])
  const buyTotal  = useMemo(() => actionable.filter(r => r.action === 'buy' ).reduce((s, r) => s + r.amountUSDT, 0), [actionable])

  if (!hasTargets) {
    return (
      <div className="surface-card fade-up" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚖️</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#F0B90B', marginBottom: '0.5rem' }}>
          Target Allocation Required
        </div>
        <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.85rem', maxWidth: 420, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
          You need to set your ideal portfolio percentages (e.g. BTC 40%, ETH 30%, SOL 20%, USDT 10%) before using the rebalance calculator.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 900 }} className="fade-up">

      {/* Header Card */}
      <div className="surface-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'oklch(95% 0.01 240)', letterSpacing: '-0.02em' }}>
              Auto Rebalance Calculator
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'oklch(55% 0.01 240)', marginTop: '0.25rem', lineHeight: 1.5 }}>
              Calculates sell and buy orders to bring your portfolio to target allocation. Sells overweight positions, buys underweight positions.
            </p>
          </div>
        </div>

        {/* Target warning if sum != 100 */}
        {Math.abs(targetSum - 100) > 0.5 && (
          <div role="alert" className="alert alert-warning mb-4" style={{ fontSize: '0.82rem' }}>
            <span>⚠️ Target allocations sum to <strong>{targetSum.toFixed(1)}%</strong> (should equal 100%). Update in Settings for accurate results.</span>
          </div>
        )}

        {/* Portfolio Summary */}
        <div style={{
          marginTop: '1.5rem', padding: '1rem',
          background: 'oklch(14% 0.012 240)', border: '1px solid oklch(100% 0 0 / 0.06)',
          borderRadius: '0.375rem', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              Total Portfolio Value
            </div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F0B90B' }}>
              <CurrencyDisplay usdValue={totalUSDT} currency={currency} rates={rates} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              Assets with Targets
            </div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'oklch(92% 0.01 240)' }}>
              {Object.keys(targets).length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              Min Order Size
            </div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'oklch(75% 0.01 240)' }}>
              ${MIN_ORDER_USDT}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              Current Drift
            </div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: assets.some(a => Math.abs(a.drift) > 5) ? '#ef4444' : '#22c55e' }}>
              {assets.some(a => Math.abs(a.drift) > 5) ? 'High' : assets.some(a => Math.abs(a.drift) > 2) ? 'Moderate' : 'Low'}
            </div>
          </div>
        </div>

        {/* Calculate Button */}
        {!confirmed ? (
          <button
            id="rebalance-calculate-btn"
            type="button"
            className="btn btn-primary"
            onClick={() => setConfirmed(true)}
            style={{ marginTop: '1.5rem', width: '100%', minHeight: '3rem' }}
          >
            Calculate Rebalance Plan
          </button>
        ) : (
          <button
            id="rebalance-reset-btn"
            type="button"
            className="btn btn-ghost"
            onClick={() => { setConfirmed(false); setShowSkipped(false) }}
            style={{ marginTop: '1.5rem', width: '100%', border: '1px solid oklch(100% 0 0 / 0.1)' }}
          >
            Reset Calculation
          </button>
        )}
      </div>

      {/* Results */}
      {confirmed && allResults.length > 0 && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="surface-card fade-up" style={{ padding: '1.5rem', border: '1px solid oklch(239% 0.082 120 / 0.3)' }}>
              <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Total to Sell
              </div>
              <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ef4444' }}>
                {fmtUSDT(sellTotal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.35rem' }}>
                {actionable.filter(r => r.action === 'sell').length} orders
              </div>
            </div>

            <div className="surface-card fade-up" style={{ padding: '1.5rem', border: '1px solid oklch(142% 0.071 120 / 0.3)' }}>
              <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Total to Buy
              </div>
              <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#22c55e' }}>
                {fmtUSDT(buyTotal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.35rem' }}>
                {actionable.filter(r => r.action === 'buy').length} orders
              </div>
            </div>

            {skipped.length > 0 && (
              <div className="surface-card fade-up" style={{ padding: '1.5rem', border: '1px solid oklch(70% 0.18 85 / 0.25)' }}>
                <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                  Skipped (Below ${MIN_ORDER_USDT})
                </div>
                <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f59e0b' }}>
                  {skipped.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.35rem' }}>
                  Will self-correct over time
                </div>
              </div>
            )}
          </div>

          {/* Rebalance Table — actionable orders */}
          {actionable.length > 0 && (
            <div className="surface-card fade-up" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '1.25rem 1.5rem', borderBottom: '1px solid oklch(100% 0 0 / 0.07)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                  Rebalance Orders
                </span>
                <div style={{ fontSize: '0.75rem', color: 'oklch(45% 0.01 240)', fontStyle: 'italic' }}>
                  Execute sells first, then buys
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.08)', color: 'oklch(50% 0.01 240)', textAlign: 'right' }}>
                      <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontWeight: 600 }}>Asset</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>Action</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Amount (USDT)</th>
                      {!isUSD && <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Est. in {currency}</th>}
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Current %</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Target %</th>
                      <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textAlign: 'left' }}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionable.map((r, i) => (
                      <RebalanceRow key={r.symbol} r={r} idx={i} total={actionable.length}
                        assets={assets} currency={currency} rates={rates} isUSD={isUSD} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Skipped orders section */}
          {skipped.length > 0 && (
            <div className="surface-card fade-up" style={{ overflow: 'hidden' }}>
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => setShowSkipped(v => !v)}
                style={{
                  width: '100%', padding: '1rem 1.5rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: showSkipped ? '1px solid oklch(100% 0 0 / 0.07)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    background: 'oklch(50% 0.12 85 / 0.15)',
                    color: '#f59e0b',
                    border: '1px solid oklch(70% 0.18 85 / 0.3)',
                    borderRadius: '0.25rem',
                    fontSize: '0.65rem', fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    letterSpacing: '0.04em',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {skipped.length} SKIPPED
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'oklch(55% 0.01 240)', fontWeight: 500 }}>
                    Orders below ${MIN_ORDER_USDT} Binance minimum — cannot be executed
                  </span>
                </div>
                <span style={{ color: 'oklch(45% 0.01 240)', fontSize: '0.75rem', transition: 'transform 0.2s', transform: showSkipped ? 'rotate(180deg)' : 'none' }}>▼</span>
              </button>

              {showSkipped && (
                <>
                  {/* Explanation banner */}
                  <div style={{
                    margin: '0.75rem 1.25rem',
                    padding: '0.75rem 1rem',
                    background: 'oklch(22% 0.05 85 / 0.2)',
                    border: '1px solid oklch(70% 0.18 85 / 0.2)',
                    borderRadius: '0.375rem',
                    fontSize: '0.8rem',
                    color: 'oklch(75% 0.05 85)',
                    lineHeight: 1.55,
                  }}>
                    💡 These orders are too small to execute on Binance (minimum ~${MIN_ORDER_USDT} per order). 
                    The drift will naturally grow with price movements and future deposits until it crosses the minimum threshold.
                    <strong style={{ color: '#f59e0b' }}> No action needed</strong> — the next rebalance will pick them up automatically.
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.06)', color: 'oklch(45% 0.01 240)', textAlign: 'right' }}>
                          <th style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontWeight: 600 }}>Asset</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'center', fontWeight: 600 }}>Action</th>
                          <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Amount (USDT)</th>
                          {!isUSD && <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Est. in {currency}</th>}
                          <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Current %</th>
                          <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Target %</th>
                          <th style={{ padding: '0.65rem 1.25rem', fontWeight: 600, textAlign: 'left' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skipped.map((r, i) => (
                          <RebalanceRow key={r.symbol} r={r} idx={i} total={skipped.length}
                            assets={assets} currency={currency} rates={rates} isUSD={isUSD} dimmed />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Execution Note */}
          <div className="surface-card fade-up" style={{
            padding: '1rem 1.5rem',
            background: 'oklch(22% 0.05 85 / 0.25)',
            border: '1px solid oklch(80% 0.18 85 / 0.25)',
            borderRadius: '0.5rem',
            fontSize: '0.82rem',
            color: 'oklch(85% 0.05 85)',
            lineHeight: 1.5,
          }}>
            <strong>Execution Note:</strong> Execute sell orders first to free up USDT, then execute buy orders. Orders below <strong>${MIN_ORDER_USDT}</strong> are skipped — Binance cannot process them. Consider trading fees and slippage before executing.
          </div>
        </>
      )}

      {confirmed && allResults.length === 0 && (
        <div className="surface-card fade-up" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#22c55e', marginBottom: '0.5rem' }}>
            Portfolio Already Balanced
          </div>
          <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.85rem' }}>
            Your current allocation matches your target allocation. No rebalancing needed.
          </p>
        </div>
      )}
    </div>
  )
}
