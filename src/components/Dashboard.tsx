import { useDashboard } from '../hooks/useDashboard'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { Asset, CurrencyCode } from '../types'
import { fmtPct, fmtAmount, REBALANCE_FLOOR_PP } from '../lib/portfolio'
import { convertUSDToCurrency, formatCurrencyValue } from '../utils/currency'
import { CurrencyDisplay } from './CurrencyDisplay'

interface DashboardProps {
  assets: Asset[]
  loading: boolean
  error: string | null
  onRetry: () => void
  currency?: CurrencyCode
  rates?: Record<string, number>
  archivedAssets?: Set<string>
  onToggleArchive?: (symbol: string) => void
  hideValues?: boolean
}

const HIDDEN = '••••••'

function Skeleton({ w, h }: { w: string; h: string }) {
  return <div className="skeleton-box" style={{ width: w, height: h }} />
}

function StatCard({ label, value, sub, subColor, title }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; subColor?: string; title?: string
}) {
  return (
    <div className="surface-card fade-up" style={{ padding: '1.25rem 1.5rem' }} title={title}>
      <div style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{label}</div>
      <div className="mono" style={{ fontSize: '1.45rem', fontWeight: 700, color: 'oklch(92% 0.01 240)', letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: '0.78rem', marginTop: '0.35rem', color: subColor ?? 'oklch(55% 0.01 240)' }}>{sub}</div>}
    </div>
  )
}

function ChartTooltip({ active, payload, currency = 'USD', rates = {} }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: Asset }>; currency?: CurrencyCode; rates?: Record<string, number> }) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload as { payload?: Asset } | Asset
  const d = ('payload' in entry ? entry.payload : entry) as Asset
  if (!d || d.usdtValue === undefined) return null
  const converted = convertUSDToCurrency(d.usdtValue, currency, rates)
  return <div className="chart-tooltip" style={{ padding: '0.75rem 1rem' }}><div style={{ fontWeight: 600, marginBottom: '0.35rem', color: d.logoColor }}>{d.symbol}</div><div className="mono" style={{ color: 'oklch(95% 0.01 240)', fontWeight: 700 }}>{formatCurrencyValue(converted, currency)}</div><div style={{ color: 'oklch(60% 0.01 240)', fontSize: '0.78rem', marginTop: '0.2rem' }}>{d.currentPct.toFixed(2)}% of portfolio</div></div>
}

function DriftTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { asset: string; current: number; target: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const drift = d.current - d.target
  return <div className="chart-tooltip" style={{ padding: '0.75rem 1rem' }}><div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{d.asset}</div><div>Current: <span className="mono">{d.current.toFixed(2)}%</span></div><div>Target: <span className="mono">{d.target.toFixed(2)}%</span></div><div style={{ color: drift > 0 ? '#F0B90B' : '#ef4444' }}>Drift: <span className="mono">{fmtPct(drift)}</span></div></div>
}

export function Dashboard({ assets, loading, error, onRetry, currency = 'USD', rates = {}, hideValues = false }: DashboardProps) {
  const { totalUSDT, activeAssets, largestAsset, assetsWithTarget, driftData, allocationData, triggeredAssets } = useDashboard(assets)
  const displayedAssets = assets

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}><div className="stat-grid">{[...Array(4)].map((_, i) => <div key={i} className="surface-card" style={{ padding: '1.25rem 1.5rem' }}><Skeleton w="60%" h="12px" /><div style={{ marginTop: '0.75rem' }}><Skeleton w="80%" h="24px" /></div></div>)}</div><div className="charts-grid"><div className="surface-card" style={{ padding: '1.5rem', height: 300 }}><Skeleton w="100%" h="100%" /></div><div className="surface-card" style={{ padding: '1.5rem', height: 300 }}><Skeleton w="100%" h="100%" /></div></div></div>
  if (error) return <div className="surface-card fade-up" style={{ padding: '3rem', textAlign: 'center' }}><div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div><div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem' }}>Connection Error</div><div style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error}</div><button id="dashboard-retry-btn" className="btn btn-sm btn-primary" onClick={onRetry}>Retry</button></div>
  if (activeAssets.length === 0) return <div className="surface-card fade-up" style={{ padding: '3.5rem 2rem', textAlign: 'center', maxWidth: 640, margin: '2rem auto' }}><div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</div><div style={{ color: 'oklch(90% 0.01 240)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Active Balances Detected</div><p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>API connection is verified, but no assets with value &gt; $0.05 USD were found in your Spot or Funding wallet.</p><button id="dashboard-resync-btn" className="btn btn-primary btn-sm mono" onClick={onRetry}>↻ Re-sync Binance Balances</button></div>

  const isUSD = currency === 'USD'
  const convertedTotal = convertUSDToCurrency(totalUSDT, currency, rates)
  const totalFormatted = formatCurrencyValue(convertedTotal, currency)
  const totalUsdFormatted = `$${totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Helper: mask a displayed value when hideValues is active
  const mask = (val: React.ReactNode) => hideValues ? <span className="mono" style={{ letterSpacing: '0.05em', color: 'oklch(40% 0.01 240)' }}>{HIDDEN}</span> : val

  return (
    <div className="page-stack">
      <div className="stat-grid">
        {/* Total Value */}
        <div className="surface-card fade-up" style={{ padding: '1.25rem 1.5rem' }} title={hideValues ? undefined : `= ${totalUsdFormatted} USD`}>
          <div style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Total Value ({currency})</div>
          <div className="mono kpi-glow" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F0B90B', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{mask(totalFormatted)}</div>
          {!isUSD && <div className="mono" style={{ fontSize: '0.78rem', color: 'oklch(55% 0.01 240)', marginTop: '0.4rem' }}>{hideValues ? HIDDEN : `= ${totalUsdFormatted} USD`}</div>}
        </div>
        <StatCard label="Active Assets" value={String(activeAssets.length)} />
        <StatCard
          label="Largest Position"
          value={largestAsset?.symbol ?? '—'}
          sub={largestAsset ? mask(<CurrencyDisplay usdValue={largestAsset.usdtValue} currency={currency} rates={rates} showUsdSub={!isUSD} />) : undefined}
        />
        <StatCard
          label="Configured Targets"
          value={`${assetsWithTarget.length} / ${activeAssets.length}`}
          sub={assetsWithTarget.length === 0 ? 'Set targets in Settings' : undefined}
          subColor={assetsWithTarget.length === 0 ? '#F0B90B' : undefined}
        />
      </div>

      <div className="charts-grid">
        {/* Pie chart — hide tooltip values when masked, but keep the chart shape visible */}
        <div className="surface-card fade-up section-card">
          <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem', fontWeight: 600 }}>Allocation Breakdown</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" strokeWidth={0}>
                {allocationData.map(entry => <Cell key={entry.name} fill={entry.color} opacity={0.9} />)}
              </Pie>
              {!hideValues && <ReTooltip content={<ChartTooltip currency={currency} rates={rates} />} />}
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
            {allocationData.map(entry => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
                <span style={{ color: 'oklch(75% 0.01 240)' }}>{entry.name}</span>
                <span className="mono" style={{ color: 'oklch(50% 0.01 240)' }}>{((entry.value / totalUSDT) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Drift bar chart */}
        <div className="surface-card fade-up section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Current vs Target Drift</span>
            <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)' }}>Trigger = max(25%×target, ±{REBALANCE_FLOOR_PP}pp)</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={driftData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(100% 0 0 / 0.04)" vertical={false} />
              <XAxis dataKey="asset" tick={{ fill: 'oklch(50% 0.01 240)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'oklch(50% 0.01 240)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <ReferenceLine y={0} stroke="oklch(100% 0 0 / 0.15)" />
              {!hideValues && <ReTooltip content={<DriftTooltip />} />}
              <Bar dataKey="current" name="Current %" fill="#F0B90B" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar dataKey="target" name="Target %" fill="#848E9C" radius={[3, 3, 0, 0]} opacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="surface-card fade-up">
        {triggeredAssets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.65rem 1.25rem', background: 'oklch(35% 0.18 30 / 0.15)', borderBottom: '1px solid oklch(65% 0.22 30 / 0.35)', fontSize: '0.78rem' }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ REBALANCE ALERT</span>
            <span style={{ color: 'oklch(75% 0.05 30)' }}>{triggeredAssets.length} asset{triggeredAssets.length > 1 ? 's have' : ' has'} exceeded its rebalance band:</span>
            {triggeredAssets.map(a => <span key={a.symbol} style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 700 }}>{a.symbol} ({a.drift > 0 ? '+' : ''}{a.drift.toFixed(1)}pp)</span>)}
          </div>
        )}

        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid oklch(100% 0 0 / 0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Holdings & Valuations ({currency})</span>
          {!isUSD && !hideValues && <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)' }}>Hover values for USD amount</span>}
        </div>

        {/* Desktop table */}
        <div className="dashboard-table-scroll desktop-only" style={{ overflowX: 'auto' }}>
          <table className="holdings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.07)', color: 'oklch(45% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.7rem' }}>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>Asset</th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Value</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Current %</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Target %</th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Drift</th>
              </tr>
            </thead>
            <tbody>
              {displayedAssets.map(asset => (
                <tr key={asset.symbol} className="table-row-hover">
                  <td style={{ padding: '0.85rem 1.5rem', fontWeight: 700 }}>{asset.symbol}</td>
                  <td className="mono" style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>{mask(fmtAmount(asset.amount))}</td>
                  <td className="mono" style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>{mask(<CurrencyDisplay usdValue={asset.price} currency={currency} rates={rates} />)}</td>
                  <td className="mono" style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>{mask(<CurrencyDisplay usdValue={asset.usdtValue} currency={currency} rates={rates} showUsdSub={!isUSD} />)}</td>
                  <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>{asset.currentPct.toFixed(2)}%</td>
                  <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>{asset.targetPct > 0 ? `${asset.targetPct.toFixed(2)}%` : '—'}</td>
                  <td className="mono" style={{ padding: '0.85rem 1.5rem', textAlign: 'right', color: asset.drift > 1 ? '#F0B90B' : asset.drift < -1 ? '#ef4444' : 'oklch(60% 0.01 240)' }}>{asset.drift.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mobile-card-list mobile-only">
          {displayedAssets.map(asset => (
            <div className="mobile-data-card" key={`mobile-${asset.symbol}`}>
              <div className="mobile-data-card-header">
                <strong>{asset.symbol}</strong>
                <span className="mono">{asset.drift > 0 ? '+' : ''}{asset.drift.toFixed(2)}%</span>
              </div>
              <div className="mobile-data-card-meta mono">
                <span>Value {hideValues ? HIDDEN : formatCurrencyValue(convertUSDToCurrency(asset.usdtValue, currency, rates), currency)}</span>
                <span>Current {asset.currentPct.toFixed(1)}%</span>
                <span>Target {asset.targetPct > 0 ? `${asset.targetPct.toFixed(1)}%` : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
