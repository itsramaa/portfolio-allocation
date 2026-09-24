import { useRebalance } from '../hooks/useRebalance'
import type { Asset, TargetAllocation, CurrencyCode } from '../types'
import {
  fmtUSDT,
  fmtPct,
  assetColor,
  isFuturesAsset,
  MIN_ORDER_USDT,
  MIN_DRIFT_PORTFOLIO_RATIO,
  MAX_REBALANCE_COST_RATIO,
  REBALANCE_RELATIVE,
  REBALANCE_FLOOR_PP,
} from '../lib/portfolio'
import type { RebalanceOrderResponse } from '../services/api'
import { convertUSDToCurrency, formatCurrencyValue } from '../utils/currency'
import { CurrencyDisplay } from './CurrencyDisplay'

const HIDDEN = '••••••'

interface RebalanceProps {
  assets: Asset[]
  targets: TargetAllocation
  currency?: CurrencyCode
  rates?: Record<string, number>
  hideValues?: boolean
}

function ActionBadge({ order }: { order: RebalanceOrderResponse }) {
  const isFutures = isFuturesAsset(order.symbol)
  let displayText: string = order.action
  let bg = order.action === 'SELL' ? 'oklch(239% 0.082 120 / 0.15)' : 'oklch(142% 0.071 120 / 0.15)'
  let color = order.action === 'SELL' ? '#ef4444' : '#22c55e'
  let border = order.action === 'SELL' ? '1px solid oklch(239% 0.082 120 / 0.3)' : '1px solid oklch(142% 0.071 120 / 0.3)'

  if (isFutures) {
    if (order.action === 'BUY') { displayText = 'SPOT ➔ FUT'; bg = 'oklch(160% 0.15 150 / 0.15)'; color = '#02C076'; border = '1px solid #02C07666' }
    else { displayText = 'FUT ➔ SPOT'; bg = 'oklch(200% 0.15 60 / 0.15)'; color = '#f59e0b'; border = '1px solid #f59e0b66' }
  }

  return (
    <span className="badge badge-sm mono" style={{ background: bg, color, border, fontWeight: 700, fontSize: '0.7rem', padding: '0.2rem 0.6rem', letterSpacing: '0.04em' }}>
      {displayText}
    </span>
  )
}

function OrderRow({
  order, idx, total, assets, currency, rates, isUSD, dimmed, hideValues,
}: {
  order: RebalanceOrderResponse; idx: number; total: number
  assets: Asset[]; currency: CurrencyCode; rates: Record<string, number>; isUSD: boolean; dimmed?: boolean; hideValues?: boolean
}) {
  const isFutures = isFuturesAsset(order.symbol)
  const asset = assets.find(a => a.symbol === order.symbol)
  const color = asset?.logoColor ?? assetColor(order.symbol, isFutures)
  const localValue = convertUSDToCurrency(order.amountUSDT, currency, rates)
  const actionColor = order.action === 'SELL' ? '#ef4444' : '#22c55e'
  const belowMin = order.amountUSDT < MIN_ORDER_USDT
  const isTriggered = !belowMin && order.isTriggered === true

  return (
    <tr style={{ borderBottom: idx < total - 1 ? '1px solid oklch(100% 0 0 / 0.04)' : 'none', opacity: dimmed ? 0.55 : 1 }} className="table-row-hover">
      <td style={{ padding: '0.8rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%',
            background: `${color}22`, border: `1px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 700, color,
            fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
          }}>
            {order.symbol.slice(0, 3)}
          </span>
          <span className="mono" style={{ fontWeight: 700, color: dimmed ? 'oklch(60% 0.01 240)' : 'oklch(92% 0.01 240)' }}>
            {order.symbol}
          </span>
        </div>
      </td>

      <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
        <ActionBadge order={order} />
      </td>

      <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: 700, color: dimmed ? 'oklch(55% 0.01 240)' : actionColor }}>
        {hideValues ? HIDDEN : fmtUSDT(order.amountUSDT)}
      </td>

      {!isUSD && (
        <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', color: dimmed ? 'oklch(45% 0.01 240)' : actionColor }}>
          {hideValues ? HIDDEN : formatCurrencyValue(localValue, currency)}
        </td>
      )}

      <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', color: 'oklch(60% 0.01 240)' }}>
        {order.currentPct.toFixed(1)}%
      </td>

      <td className="mono" style={{ padding: '0.8rem 1rem', textAlign: 'right', color: dimmed ? 'oklch(45% 0.01 240)' : '#22c55e' }}>
        {order.targetPct.toFixed(1)}%
      </td>

      <td style={{ padding: '0.8rem 1.25rem' }}>
        {belowMin ? (
          <span style={{
            background: 'oklch(50% 0.12 85 / 0.15)', color: '#f59e0b',
            border: '1px solid oklch(70% 0.18 85 / 0.3)', borderRadius: '0.25rem',
            fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', letterSpacing: '0.04em',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            BELOW ${MIN_ORDER_USDT} MIN
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {isTriggered && (
              <span style={{
                background: 'oklch(40% 0.22 30 / 0.2)', color: '#f87171',
                border: '1px solid oklch(60% 0.22 30 / 0.4)', borderRadius: '0.2rem',
                fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', letterSpacing: '0.04em',
                fontFamily: 'JetBrains Mono, monospace',
              }}>TRIGGERED</span>
            )}
            <span className="mono" style={{ color: actionColor, fontWeight: 600, fontSize: '0.8rem' }}>
              {order.action === 'SELL' ? '▼ ' : '▲ '}
              {fmtPct(order.diffPct)}
            </span>
          </div>
        )}
      </td>
    </tr>
  )
}

export function Rebalance({ assets, targets, currency = 'USD', rates = {}, hideValues = false }: RebalanceProps) {
  const {
    confirmed, setConfirmed, showSkipped, setShowSkipped, calculating, error, rebalanceResult, setRebalanceResult,
    totalUSDT, spotRebalanceUSDT, futuresUnderTarget, hasTargets, targetSum, actionable, skipped, triggered, sellTotal, buyTotal,
    calculate: handleCalculate,
  } = useRebalance(assets, targets)
  const isUSD = currency === 'USD'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 900 }} className="fade-up rebalance-page">

      {/* Header Card */}
      <div className="surface-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'oklch(95% 0.01 240)', letterSpacing: '-0.02em' }}>
              Auto Rebalance Calculator
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'oklch(55% 0.01 240)', marginTop: '0.25rem', lineHeight: 1.6 }}>
              Calculates sell and buy orders to reach target allocation. 3-Gate Adaptive Architecture:
            </p>
            <div className="rebalance-gates-detail">
              <span className="gate-line">Gate 1 (Allocation Band): |drift| ≥ max({(REBALANCE_RELATIVE*100).toFixed(0)}% × target, ±{REBALANCE_FLOOR_PP}pp)</span>
              <span className="gate-line">Gate 2 (Economic Minimum): drift value ≥ {(MIN_DRIFT_PORTFOLIO_RATIO * 100).toFixed(1)}% × spot rebalance base ({fmtUSDT(spotRebalanceUSDT * MIN_DRIFT_PORTFOLIO_RATIO)})</span>
              <span className="gate-line">Gate 3 (Execution Guard): trade value ≥ ${MIN_ORDER_USDT} &amp; friction ≤ {(MAX_REBALANCE_COST_RATIO * 100).toFixed(0)}% trade value</span>
              <span className="gate-note">Futures tetap masuk total kekayaan, tetapi kekurangan Futures hanya bisa diisi lewat Inject dan tidak membuat order SPOT ➔ FUT otomatis.</span>
            </div>
          </div>
        </div>

        {/* Target warning */}
        {Math.abs(targetSum - 100) > 0.5 && (
          <div role="alert" className="alert alert-warning mb-4" style={{ fontSize: '0.82rem' }}>
            <span>⚠️ Target allocations sum to <strong>{targetSum.toFixed(1)}%</strong> (should equal 100%). Update in Settings for accurate results.</span>
          </div>
        )}

        {futuresUnderTarget.length > 0 && (
          <div role="status" className="alert alert-warning" style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
            Futures berada di bawah target. Saldo ini hanya dapat ditambah melalui Inject; rebalance tidak akan memindahkan dana spot ke Futures otomatis.
          </div>
        )}

        {/* Portfolio Summary */}
        <div style={{
          marginTop: '1.5rem', padding: '1rem',
          background: 'oklch(14% 0.012 240)', border: '1px solid oklch(100% 0 0 / 0.06)',
          borderRadius: '0.375rem', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Total Portfolio Value</div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F0B90B' }}>
              {hideValues ? HIDDEN : <CurrencyDisplay usdValue={totalUSDT} currency={currency} rates={rates} />}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Spot Rebalance Base</div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa' }}>{hideValues ? HIDDEN : fmtUSDT(spotRebalanceUSDT)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Min Order Size</div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'oklch(75% 0.01 240)' }}>${MIN_ORDER_USDT}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Assets with Targets</div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'oklch(92% 0.01 240)' }}>{Object.keys(targets).length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Current Drift</div>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: assets.some(a => Math.abs(a.drift) > 5) ? '#ef4444' : '#22c55e' }}>
              {assets.some(a => Math.abs(a.drift) > 5) ? 'High' : assets.some(a => Math.abs(a.drift) > 2) ? 'Moderate' : 'Low'}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {!confirmed ? (
          <button
            id="rebalance-calculate-btn"
            type="button"
            className="btn btn-primary"
            onClick={handleCalculate}
            disabled={calculating}
            style={{ marginTop: '1.5rem', width: '100%', minHeight: '3rem' }}
          >
            {calculating ? <><span className="loading loading-spinner loading-sm" /> Calculating…</> : 'Calculate Rebalance Plan'}
          </button>
        ) : (
          <button
            id="rebalance-reset-btn"
            type="button"
            className="btn btn-ghost"
            onClick={() => { setConfirmed(false); setShowSkipped(false); setRebalanceResult(null) }}
            style={{ marginTop: '1.5rem', width: '100%', border: '1px solid oklch(100% 0 0 / 0.1)' }}
          >
            Reset Calculation
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="alert alert-error" style={{ fontSize: '0.82rem' }}>{error}</div>
      )}

      {/* Results */}
      {confirmed && rebalanceResult && (rebalanceResult.orders.length > 0) && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="surface-card fade-up" style={{ padding: '1.5rem', border: '1px solid oklch(239% 0.082 120 / 0.3)' }}>
              <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Total to Sell</div>
              <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ef4444' }}>{hideValues ? HIDDEN : fmtUSDT(sellTotal)}</div>
              <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.35rem' }}>{actionable.filter(o => o.action === 'SELL').length} orders</div>
            </div>

            <div className="surface-card fade-up" style={{ padding: '1.5rem', border: '1px solid oklch(142% 0.071 120 / 0.3)' }}>
              <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Total to Buy</div>
              <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#22c55e' }}>{hideValues ? HIDDEN : fmtUSDT(buyTotal)}</div>
              <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.35rem' }}>{actionable.filter(o => o.action === 'BUY').length} orders</div>
            </div>

            {skipped.length > 0 && (
              <div className="surface-card fade-up" style={{ padding: '1.5rem', border: '1px solid oklch(70% 0.18 85 / 0.25)' }}>
                <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Skipped (&lt; ${MIN_ORDER_USDT})</div>
                <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f59e0b' }}>{skipped.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.35rem' }}>Will self-correct over time</div>
              </div>
            )}

            {rebalanceResult.estimatedFeesUSDT > 0 && (
              <div className="surface-card fade-up" style={{ padding: '1.5rem', border: '1px solid oklch(50% 0.15 240 / 0.25)' }}>
                <div style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Est. Fees</div>
                <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#60a5fa' }}>{hideValues ? HIDDEN : fmtUSDT(rebalanceResult.estimatedFeesUSDT)}</div>
                <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', marginTop: '0.35rem' }}>~0.1% per order</div>
              </div>
            )}
          </div>

          {/* Rebalance Orders Table */}
          {actionable.length > 0 && (
            <div className="surface-card fade-up" style={{ overflow: 'hidden' }}>
              {triggered.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
                  padding: '0.65rem 1.25rem', background: 'oklch(35% 0.18 30 / 0.15)',
                  borderBottom: '1px solid oklch(65% 0.22 30 / 0.35)', fontSize: '0.78rem',
                }}>
                  <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.04em', fontFamily: 'JetBrains Mono, monospace' }}>⚠ THRESHOLD EXCEEDED</span>
                  <span style={{ color: 'oklch(75% 0.05 30)' }}>{triggered.length} asset{triggered.length > 1 ? 's have' : ' has'} breached its rebalance band:</span>
                  {triggered.map(o => (
                    <span key={o.symbol} style={{
                      background: 'oklch(50% 0.22 30 / 0.2)', color: '#f87171',
                      border: '1px solid oklch(60% 0.22 30 / 0.4)', borderRadius: '0.25rem',
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>{o.symbol} {o.action === 'SELL' ? '▼' : '▲'} {hideValues ? HIDDEN : fmtUSDT(o.amountUSDT)}</span>
                  ))}
                </div>
              )}

              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid oklch(100% 0 0 / 0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Rebalance Orders</span>
                <div style={{ fontSize: '0.75rem', color: 'oklch(45% 0.01 240)', fontStyle: 'italic' }}>Execute sells first, then buys</div>
              </div>

              <div className="desktop-only" style={{ overflowX: 'auto' }}>
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
                    {actionable.map((o, i) => (
                      <OrderRow key={o.symbol} order={o} idx={i} total={actionable.length} assets={assets} currency={currency} rates={rates} isUSD={isUSD} hideValues={hideValues} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-card-list mobile-only">
                {actionable.map(order => (
                  <div className="mobile-data-card" key={`mobile-${order.symbol}`}>
                    <div className="mobile-data-card-header">
                      <strong>{order.symbol}</strong>
                      <ActionBadge order={order} />
                    </div>
                    <div className="mobile-data-card-meta mono">
                      <span>{hideValues ? HIDDEN : fmtUSDT(order.amountUSDT)}</span>
                      <span>Current {order.currentPct.toFixed(1)}%</span>
                      <span>Target {order.targetPct.toFixed(1)}%</span>
                      <span style={{ color: order.action === 'SELL' ? '#ef4444' : '#22c55e' }}>{fmtPct(order.diffPct)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped orders */}
          {skipped.length > 0 && (
            <div className="surface-card fade-up" style={{ overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setShowSkipped(v => !v)}
                style={{ width: '100%', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', borderBottom: showSkipped ? '1px solid oklch(100% 0 0 / 0.07)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ background: 'oklch(50% 0.12 85 / 0.15)', color: '#f59e0b', border: '1px solid oklch(70% 0.18 85 / 0.3)', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', letterSpacing: '0.04em', fontFamily: 'JetBrains Mono, monospace' }}>
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
                  <div style={{ margin: '0.75rem 1.25rem', padding: '0.75rem 1rem', background: 'oklch(22% 0.05 85 / 0.2)', border: '1px solid oklch(70% 0.18 85 / 0.2)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'oklch(75% 0.05 85)', lineHeight: 1.55 }}>
                    💡 These orders are too small to execute on Binance (minimum ~${MIN_ORDER_USDT} per order).
                    The drift will naturally grow until it crosses the threshold.
                    <strong style={{ color: '#f59e0b' }}> No action needed</strong> — the next rebalance will pick them up automatically.
                  </div>
                  <div className="desktop-only" style={{ overflowX: 'auto' }}>
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
                        {skipped.map((o, i) => (
                          <OrderRow key={o.symbol} order={o} idx={i} total={skipped.length} assets={assets} currency={currency} rates={rates} isUSD={isUSD} dimmed hideValues={hideValues} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Execution Note */}
          <div className="surface-card fade-up" style={{ padding: '1rem 1.5rem', background: 'oklch(22% 0.05 85 / 0.25)', border: '1px solid oklch(80% 0.18 85 / 0.25)', borderRadius: '0.5rem', fontSize: '0.82rem', color: 'oklch(85% 0.05 85)', lineHeight: 1.5 }}>
            <strong>Execution Note:</strong> Execute sell orders first to free up USDT, then execute buy orders. Orders below <strong>${MIN_ORDER_USDT}</strong> are skipped — Binance cannot process them. Consider trading fees and slippage before executing.
          </div>
        </>
      )}

      {confirmed && rebalanceResult && rebalanceResult.orders.length === 0 && (
        <div className="surface-card fade-up" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#22c55e', marginBottom: '0.5rem' }}>Portfolio Already Balanced</div>
          <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.85rem' }}>
            Your current allocation matches your target allocation. No rebalancing needed.
          </p>
        </div>
      )}
    </div>
  )
}
