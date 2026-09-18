// ─── History Tab ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import type { PortfolioSnapshot, CurrencyCode } from '../types'
import { loadHistory, saveSnapshot } from '../storage'
import { convertUSDToCurrency, formatCurrencyValue } from '../currency'
import { CurrencyDisplay } from './CurrencyDisplay'

interface HistoryProps {
  currentTotal: number
  btcPrice?: number
  currency?: CurrencyCode
  rates?: Record<string, number>
}

export function History({
  currentTotal,
  btcPrice,
  currency = 'USD',
  rates = {},
}: HistoryProps) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>(() => loadHistory())
  const isUSD = currency === 'USD'

  const handleCaptureSnapshot = () => {
    const snap: PortfolioSnapshot = {
      timestamp: Date.now(),
      totalUSDT: currentTotal,
      btcPrice,
    }
    saveSnapshot(snap)
    setSnapshots(loadHistory())
  }

  const handleSeedDemo = () => {
    const now = Date.now()
    const dayMs = 24 * 3600 * 1000
    const demo: PortfolioSnapshot[] = []
    const base = currentTotal > 0 ? currentTotal * 0.75 : 10000
    for (let i = 14; i >= 0; i--) {
      const variance = 1 + (Math.sin(i * 0.8) * 0.08) + ((14 - i) * 0.018)
      demo.push({
        timestamp: now - i * dayMs,
        totalUSDT: Math.round(base * variance * 100) / 100,
        btcPrice: 65000 + (14 - i) * 800 + Math.sin(i) * 1500,
      })
    }
    localStorage.setItem('portfolio_history', JSON.stringify(demo))
    setSnapshots(demo)
  }

  const handleClear = () => {
    if (window.confirm('Clear all recorded portfolio snapshots?')) {
      localStorage.removeItem('portfolio_history')
      setSnapshots([])
    }
  }

  const chartData = snapshots.map(s => {
    const converted = convertUSDToCurrency(s.totalUSDT, currency, rates)
    return {
      time: new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      fullDate: new Date(s.timestamp).toLocaleString(),
      convertedVal: converted,
      totalUSDT: s.totalUSDT,
      btcPrice: s.btcPrice,
    }
  })

  const minVal = chartData.length ? Math.min(...chartData.map(s => s.convertedVal)) * 0.95 : 0
  const maxVal = chartData.length ? Math.max(...chartData.map(s => s.convertedVal)) * 1.05 : 100

  const currentTotalFormatted = formatCurrencyValue(convertUSDToCurrency(currentTotal, currency, rates), currency)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="fade-up">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'oklch(95% 0.01 240)', letterSpacing: '-0.02em' }}>
            Portfolio Snapshot History ({currency})
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'oklch(55% 0.01 240)', marginTop: '0.2rem' }}>
            Valuation shift timeline across rebalancing sessions. Hover values to see USD equivalence.
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
            Capture Now ({currentTotalFormatted})
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
          <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.82rem', maxWidth: 420, margin: '0 auto 1.5rem' }}>
            Snapshots are automatically recorded hourly when you visit the dashboard, or you can record one right now.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleCaptureSnapshot} disabled={currentTotal <= 0}>
              Capture First Snapshot
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
                            {formatCurrencyValue(d.convertedVal, currency)}
                          </div>
                          {!isUSD && (
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
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'oklch(50% 0.01 240)', fontWeight: 600, marginBottom: '1rem' }}>
              Recorded Records ({snapshots.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.08)', color: 'oklch(50% 0.01 240)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>Date & Time</th>
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
                          {new Date(snap.timestamp).toLocaleString()}
                        </td>

                        {/* Converted Portfolio Value with USD tooltip */}
                        <td className="mono" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: 'oklch(95% 0.01 240)' }}>
                          <CurrencyDisplay
                            usdValue={snap.totalUSDT}
                            currency={currency}
                            rates={rates}
                            showUsdSub={!isUSD}
                          />
                        </td>

                        <td className="mono" style={{
                          padding: '0.75rem',
                          textAlign: 'right',
                          color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'oklch(50% 0.01 240)',
                        }}>
                          {prev ? `${diff >= 0 ? '+' : '-'}${formatCurrencyValue(convertedDiff, currency)} (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%)` : '—'}
                        </td>

                        <td className="mono" style={{ padding: '0.75rem', textAlign: 'right', color: 'oklch(60% 0.01 240)' }}>
                          {snap.btcPrice ? (
                            <CurrencyDisplay
                              usdValue={snap.btcPrice}
                              currency={currency}
                              rates={rates}
                            />
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
