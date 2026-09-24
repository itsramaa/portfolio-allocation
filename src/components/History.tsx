// ─── History Tab ─────────────────────────────────────────────────────────────
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import type { CurrencyCode } from '../types'
import { getWibDailyCycleKey, formatWibDateTime } from '../utils/storage'
import { convertUSDToCurrency, formatCurrencyValue } from '../utils/currency'
import { useHistory } from '../hooks/useHistory'
import { CurrencyDisplay } from './CurrencyDisplay'

interface HistoryProps {
  currentTotal: number
  btcPrice?: number
  currency?: CurrencyCode
  rates?: Record<string, number>
  hideValues?: boolean
}

const HIDDEN = '••••••'

export function History({
  currentTotal,
  btcPrice,
  currency = 'USD',
  rates = {},
  hideValues = false,
}: HistoryProps) {
  const {
    snapshots, captureSnapshot: handleCaptureSnapshot, seedDemo: handleSeedDemo,
    clearSnapshots: handleClear, chartData, minVal, maxVal, isUSD, currentTotalFormatted,
  } = useHistory(currentTotal, btcPrice, currency, rates)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="fade-up">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'oklch(95% 0.01 240)', letterSpacing: '-0.02em' }}>
              Daily Portfolio Snapshot History ({currency})
            </h2>
            <span style={{
              background: 'oklch(40% 0.15 240 / 0.2)',
              color: '#60a5fa',
              border: '1px solid oklch(60% 0.2 240 / 0.3)',
              borderRadius: '0.25rem',
              fontSize: '0.68rem', fontWeight: 700,
              padding: '0.15rem 0.5rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              07:00 WIB CYCLE (00:00 UTC)
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'oklch(55% 0.01 240)', marginTop: '0.2rem' }}>
            Riwayat valuasi harian (siklus harian 07:00 WIB / 00:00 UTC Binance). 1 snapshot per hari.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {snapshots.length === 0 && (
            <button
              type="button"
              className="btn btn-sm btn-ghost mono"
              onClick={handleSeedDemo}
              style={{ border: '1px solid oklch(100% 0 0 / 0.12)', fontSize: '0.75rem' }}
            >
              Load Demo Trend
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary mono"
            onClick={handleCaptureSnapshot}
            disabled={currentTotal <= 0}
            style={{ fontSize: '0.75rem' }}
          >
            Capture Today ({hideValues ? HIDDEN : currentTotalFormatted})
          </button>
          {snapshots.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline btn-error mono"
              onClick={handleClear}
              style={{ fontSize: '0.75rem' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="surface-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📈</div>
          <div style={{ fontWeight: 600, color: 'oklch(90% 0.01 240)', marginBottom: '0.4rem' }}>
            No snapshots captured yet
          </div>
          <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.82rem', maxWidth: 460, margin: '0 auto 1.5rem' }}>
            Snapshot dicatat otomatis 1x per hari (siklus 07:00 WIB / 00:00 UTC) saat Anda membuka dashboard, atau Anda dapat memperbarui snapshot hari ini secara manual.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleCaptureSnapshot} disabled={currentTotal <= 0}>
              Capture Today's Snapshot
            </button>
            <button type="button" className="btn btn-sm btn-ghost" style={{ border: '1px solid oklch(100% 0 0 / 0.15)' }} onClick={handleSeedDemo}>
              Preview with Demo Data
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Chart card */}
          <div className="surface-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(50% 0.01 240)', fontWeight: 600, marginBottom: '1.25rem' }}>
              Valuation Over Time ({currency})
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F0B90B" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#F0B90B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(100% 0 0 / 0.05)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: 'oklch(45% 0.01 240)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={{ stroke: 'oklch(100% 0 0 / 0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[minVal, maxVal]}
                    tickFormatter={v => formatCurrencyValue(v, currency)}
                    tick={{ fill: 'oklch(45% 0.01 240)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="chart-tooltip" style={{ padding: '0.6rem 0.9rem' }}>
                          <div style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', marginBottom: '0.2rem' }}>{d.fullDate}</div>
                          <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#F0B90B' }}>
                            {hideValues ? HIDDEN : formatCurrencyValue(d.convertedVal, currency)}
                          </div>
                          {!isUSD && !hideValues && (
                            <div className="mono" style={{ fontSize: '0.75rem', color: 'oklch(60% 0.01 240)', marginTop: '0.15rem' }}>
                              = ${d.totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="convertedVal"
                    stroke="#F0B90B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#valGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Snapshots Table */}
          <div className="surface-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(50% 0.01 240)', fontWeight: 600 }}>
                Daily Snapshots ({snapshots.length} Hari)
              </div>
              <span style={{ fontSize: '0.72rem', color: 'oklch(45% 0.01 240)', fontFamily: 'JetBrains Mono, monospace' }}>
                Reset harian setiap 07:00 WIB / 00:00 UTC
              </span>
            </div>
            <div className="desktop-only" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.08)', color: 'oklch(50% 0.01 240)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>Tanggal Siklus (07:00 WIB)</th>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: 500, textAlign: 'right' }}>Portfolio Value ({currency})</th>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: 500, textAlign: 'right' }}>Change</th>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: 500, textAlign: 'right' }}>BTC Price ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshots].reverse().map((snap, idx, arr) => {
                    const prev = arr[idx + 1]
                    const diff = prev ? snap.totalUSDT - prev.totalUSDT : 0
                    const diffPct = prev && prev.totalUSDT > 0 ? (diff / prev.totalUSDT) * 100 : 0
                    const convertedDiff = convertUSDToCurrency(Math.abs(diff), currency, rates)

                    return (
                      <tr
                        key={snap.timestamp}
                        style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.04)', transition: 'background 0.15s' }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '0.75rem', color: 'oklch(75% 0.01 240)' }}>
                          <div style={{ fontWeight: 600, color: 'oklch(90% 0.01 240)' }}>
                            {new Date(snap.timestamp).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'oklch(45% 0.01 240)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {formatWibDateTime(snap.timestamp)} · Siklus {getWibDailyCycleKey(snap.timestamp)}
                          </div>
                        </td>

                        {/* Converted Portfolio Value with USD tooltip */}
                        <td className="mono" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: 'oklch(95% 0.01 240)' }}>
                          {hideValues ? HIDDEN : (
                            <CurrencyDisplay
                              usdValue={snap.totalUSDT}
                              currency={currency}
                              rates={rates}
                              showUsdSub={!isUSD}
                            />
                          )}
                        </td>

                        <td className="mono" style={{
                          padding: '0.75rem',
                          textAlign: 'right',
                          color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'oklch(50% 0.01 240)',
                        }}>
                          {prev
                            ? hideValues
                              ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%`
                              : `${diff >= 0 ? '+' : '-'}${formatCurrencyValue(convertedDiff, currency)} (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%)`
                            : '—'}
                        </td>

                        <td className="mono" style={{ padding: '0.75rem', textAlign: 'right', color: 'oklch(60% 0.01 240)' }}>
                          {snap.btcPrice ? (
                            hideValues ? HIDDEN : (
                              <CurrencyDisplay
                                usdValue={snap.btcPrice}
                                currency={currency}
                                rates={rates}
                              />
                            )
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-card-list mobile-only">
              {[...snapshots].reverse().map((snap, idx, arr) => {
                const prev = arr[idx + 1]
                const diff = prev ? snap.totalUSDT - prev.totalUSDT : 0
                const diffPct = prev && prev.totalUSDT > 0 ? (diff / prev.totalUSDT) * 100 : 0
                return (
                  <div className="mobile-data-card" key={`mobile-${snap.timestamp}`}>
                    <div className="mobile-data-card-header">
                      <strong>{new Date(snap.timestamp).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' })}</strong>
                      <span className="mono">{hideValues ? HIDDEN : formatCurrencyValue(convertUSDToCurrency(snap.totalUSDT, currency, rates), currency)}</span>
                    </div>
                    <div className="mobile-data-card-meta mono">
                      <span>{formatWibDateTime(snap.timestamp)}</span>
                      <span style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'oklch(60% 0.01 240)' }}>{prev ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%` : '—'}</span>
                      <span>BTC {snap.btcPrice ? (hideValues ? HIDDEN : formatCurrencyValue(convertUSDToCurrency(snap.btcPrice, currency, rates), currency)) : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
