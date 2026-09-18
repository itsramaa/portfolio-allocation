// ─── Dashboard Tab ───────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { Asset, CurrencyCode } from '../types'
import { fmtPct, fmtAmount } from '../portfolio'
import { convertUSDToCurrency, formatCurrencyValue } from '../currency'
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
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ w, h }: { w: string; h: string }) {
  return <div className="skeleton-box" style={{ width: w, height: h }} />
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subColor, title }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; subColor?: string; title?: string
}) {
  return (
    <div className="surface-card fade-up" style={{ padding: '1.25rem 1.5rem' }} title={title}>
      <div style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: '1.45rem', fontWeight: 700, color: 'oklch(92% 0.01 240)', letterSpacing: '-0.03em' }}>
        {value}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: '0.78rem', marginTop: '0.35rem', color: subColor ?? 'oklch(55% 0.01 240)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Custom tooltip for recharts ──────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  currency = 'USD',
  rates = {},
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: Asset }>
  currency?: CurrencyCode
  rates?: Record<string, number>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Asset
  if (!d || d.usdtValue === undefined) return null
  const isUSD = currency === 'USD'
  const converted = convertUSDToCurrency(d.usdtValue, currency, rates)

  return (
    <div className="chart-tooltip" style={{ padding: '0.75rem 1rem' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.35rem', color: d.logoColor }}>{d.symbol}</div>
      <div className="mono" style={{ color: 'oklch(95% 0.01 240)', fontWeight: 700 }}>
        {formatCurrencyValue(converted, currency)}
      </div>
      {!isUSD && (
        <div className="mono" style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.75rem' }}>
          = ${d.usdtValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
        </div>
      )}
      <div style={{ color: 'oklch(60% 0.01 240)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
        {d.currentPct.toFixed(2)}% of portfolio
      </div>
    </div>
  )
}

// ── Drift bar tooltip ────────────────────────────────────────────────────────
function DriftTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { asset: string; current: number; target: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const drift = d.current - d.target
  return (
    <div className="chart-tooltip" style={{ padding: '0.75rem 1rem' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{d.asset}</div>
      <div>Current: <span className="mono">{d.current.toFixed(2)}%</span></div>
      <div>Target: <span className="mono">{d.target.toFixed(2)}%</span></div>
      <div style={{ color: drift > 0 ? '#F0B90B' : '#ef4444' }}>
        Drift: <span className="mono">{fmtPct(drift)}</span>
      </div>
    </div>
  )
}

export function Dashboard({
  assets,
  loading,
  error,
  onRetry,
  currency = 'USD',
  rates = {},
}: DashboardProps) {
  const [filter, setFilter] = useState<'all' | 'spot' | 'alpha'>('all')

  const totalUSDT = useMemo(() => assets.reduce((s, a) => s + a.usdtValue, 0), [assets])
  const largestAsset = useMemo(() => assets[0], [assets])
  const assetsWithTarget = useMemo(() => assets.filter(a => a.targetPct > 0), [assets])

  const alphaAssets = useMemo(() => assets.filter(a => a.isAlpha), [assets])
  const spotAssets = useMemo(() => assets.filter(a => !a.isAlpha), [assets])
  const alphaTotalUSDT = useMemo(() => alphaAssets.reduce((s, a) => s + a.usdtValue, 0), [alphaAssets])
  const alphaPct = totalUSDT > 0 ? (alphaTotalUSDT / totalUSDT) * 100 : 0

  const displayedAssets = useMemo(() => {
    if (filter === 'spot') return spotAssets
    if (filter === 'alpha') return alphaAssets
    return assets
  }, [assets, spotAssets, alphaAssets, filter])

  const driftData = useMemo(() =>
    assets
      .filter(a => a.targetPct > 0 || a.currentPct > 1)
      .slice(0, 10)
      .map(a => ({
        asset: a.symbol,
        current: a.currentPct,
        target: a.targetPct,
      })),
    [assets]
  )

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="stat-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card" style={{ padding: '1.25rem 1.5rem' }}>
              <Skeleton w="60%" h="12px" />
              <div style={{ marginTop: '0.75rem' }}><Skeleton w="80%" h="24px" /></div>
            </div>
          ))}
        </div>
        <div className="charts-grid">
          <div className="surface-card" style={{ padding: '1.5rem', height: 300 }}><Skeleton w="100%" h="100%" /></div>
          <div className="surface-card" style={{ padding: '1.5rem', height: 300 }}><Skeleton w="100%" h="100%" /></div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="surface-card fade-up" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem' }}>Connection Error</div>
        <div style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error}</div>
        <button id="dashboard-retry-btn" className="btn btn-sm btn-primary" onClick={onRetry}>Retry</button>
      </div>
    )
  }

  // Empty state
  if (assets.length === 0) {
    return (
      <div className="surface-card fade-up" style={{ padding: '3.5rem 2rem', textAlign: 'center', maxWidth: 640, margin: '2rem auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</div>
        <div style={{ color: 'oklch(90% 0.01 240)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
          No Active Balances Detected
        </div>
        <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
          API connection is verified, but no assets with value &gt; $0.05 USD were found in your Spot or Funding wallet.
        </p>

        <div style={{
          background: 'oklch(14% 0.012 240)',
          border: '1px solid oklch(100% 0 0 / 0.07)',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          textAlign: 'left',
          fontSize: '0.82rem',
          marginBottom: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}>
          <div style={{ fontWeight: 600, color: '#F0B90B' }}>Periksa Lokasi Saldo Crypto Anda di Binance:</div>
          <div style={{ color: 'oklch(75% 0.01 240)' }}>
            • <strong>Dompet Pendanaan (Funding Wallet) / P2P</strong>: Jika baru membeli USDT via P2P di Binance, saldo biasanya masuk ke Dompet Pendanaan. Silakan transfer internal ke <strong>Dompet Spot</strong> (Gratis & instan di aplikasi Binance).
          </div>
          <div style={{ color: 'oklch(75% 0.01 240)' }}>
            • <strong>Simple Earn (Flexible / Locked)</strong>: Jika aset Anda sedang dimasukkan ke program Earn (berbunga harian), aset berada di dompet Earn, bukan Spot.
          </div>
          <div style={{ color: 'oklch(75% 0.01 240)' }}>
            • <strong>Izin API Key (Permissions)</strong>: Pastikan opsi <em>Enable Reading</em> dicentang pada konfigurasi API Key Anda di web Binance.
          </div>
        </div>

        <button id="dashboard-resync-btn" className="btn btn-primary btn-sm mono" onClick={onRetry}>
          ↻ Re-sync Binance Balances
        </button>
      </div>
    )
  }

  const DONUT_COLORS = assets.slice(0, 8).map(a => a.logoColor)
  const donutData = assets.slice(0, 8).map(a => ({ name: a.symbol, value: a.usdtValue, payload: a }))

  const isUSD = currency === 'USD'
  const convertedTotal = convertUSDToCurrency(totalUSDT, currency, rates)
  const totalFormatted = formatCurrencyValue(convertedTotal, currency)
  const totalUsdFormatted = `$${totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Stat row ─────────────────────────────────────────────────── */}
      <div className={alphaAssets.length > 0 ? 'stat-grid-5' : 'stat-grid'}>
        {/* Total Value */}
        <div className="surface-card fade-up" style={{ padding: '1.25rem 1.5rem', gridColumn: 'span 1' }} title={`= ${totalUsdFormatted} USD`}>
          <div style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
            Total Value ({currency})
          </div>
          <div className="mono kpi-glow" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F0B90B', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            {totalFormatted}
          </div>
          {!isUSD && (
            <div className="mono" style={{ fontSize: '0.78rem', color: 'oklch(55% 0.01 240)', marginTop: '0.4rem' }}>
              = {totalUsdFormatted} USD
            </div>
          )}
        </div>

        <StatCard label="Active Assets" value={String(assets.length)} />

        {/* Binance Alpha Exposure (if any alpha assets configured/held) */}
        {alphaAssets.length > 0 && (
          <div className="surface-card fade-up" style={{ padding: '1.25rem 1.5rem', border: '1px solid oklch(60% 0.25 300 / 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                ⚡ Binance Alpha
              </span>
            </div>
            <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#C084FC', lineHeight: 1.1 }}>
              {alphaPct.toFixed(1)}%
            </div>
            <div className="mono" style={{ fontSize: '0.75rem', color: 'oklch(60% 0.01 240)', marginTop: '0.4rem' }}>
              <CurrencyDisplay usdValue={alphaTotalUSDT} currency={currency} rates={rates} />
            </div>
          </div>
        )}

        {/* Largest Position */}
        <StatCard
          label="Largest Position"
          value={largestAsset?.symbol ?? '—'}
          sub={
            largestAsset ? (
              <CurrencyDisplay
                usdValue={largestAsset.usdtValue}
                currency={currency}
                rates={rates}
                showUsdSub={!isUSD}
              />
            ) : undefined
          }
        />

        {/* Configured Targets */}
        <StatCard
          label="Configured Targets"
          value={`${assetsWithTarget.length} / ${assets.length}`}
          sub={assetsWithTarget.length === 0 ? 'Set targets in Settings' : undefined}
          subColor={assetsWithTarget.length === 0 ? '#F0B90B' : undefined}
        />
      </div>

      {/* ── Charts row ───────────────────────────────────────────────── */}
      <div className="charts-grid">

        {/* Donut Chart */}
        <div className="surface-card fade-up" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem', fontWeight: 600 }}>
            Allocation Breakdown
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {donutData.map((entry, index) => (
                  <Cell key={entry.name} fill={DONUT_COLORS[index] ?? '#848E9C'} opacity={0.9} />
                ))}
              </Pie>
              <ReTooltip content={<ChartTooltip currency={currency} rates={rates} />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
            {assets.slice(0, 6).map((a, i) => (
              <div key={a.symbol} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_COLORS[i] }} />
                <span style={{ color: a.isAlpha ? '#C084FC' : 'oklch(75% 0.01 240)', fontWeight: a.isAlpha ? 600 : 400 }}>
                  {a.symbol}
                </span>
                <span className="mono" style={{ color: 'oklch(50% 0.01 240)' }}>{a.currentPct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Drift Bar Chart */}
        <div className="surface-card fade-up" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Current vs Target Drift
            </span>
            <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)' }}>
              Positive = overweight · Negative = underweight
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={driftData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(100% 0 0 / 0.04)" vertical={false} />
              <XAxis dataKey="asset" tick={{ fill: 'oklch(50% 0.01 240)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'oklch(50% 0.01 240)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <ReferenceLine y={0} stroke="oklch(100% 0 0 / 0.15)" />
              <ReTooltip content={<DriftTooltip />} />
              <Bar dataKey="current" name="Current %" fill="#F0B90B" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar dataKey="target" name="Target %" fill="#848E9C" radius={[3, 3, 0, 0]} opacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Holdings Table ───────────────────────────────────────────── */}
      <div className="surface-card fade-up">
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid oklch(100% 0 0 / 0.07)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'oklch(55% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Holdings & Valuations ({currency})
            </span>

            {/* Filter Tabs */}
            <div style={{ display: 'inline-flex', background: 'oklch(14% 0.012 240)', padding: '0.2rem', borderRadius: '0.375rem', border: '1px solid oklch(100% 0 0 / 0.08)' }}>
              <button
                type="button"
                id="filter-all-assets"
                className={`btn btn-xs ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.72rem', height: '1.6rem', minHeight: '1.6rem' }}
                onClick={() => setFilter('all')}
              >
                All ({assets.length})
              </button>
              <button
                type="button"
                id="filter-spot-assets"
                className={`btn btn-xs ${filter === 'spot' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.72rem', height: '1.6rem', minHeight: '1.6rem' }}
                onClick={() => setFilter('spot')}
              >
                Spot ({spotAssets.length})
              </button>
              <button
                type="button"
                id="filter-alpha-assets"
                className={`btn btn-xs ${filter === 'alpha' ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  fontSize: '0.72rem',
                  height: '1.6rem',
                  minHeight: '1.6rem',
                  color: filter === 'alpha' ? undefined : '#C084FC',
                }}
                onClick={() => setFilter('alpha')}
              >
                ⚡ Alpha ({alphaAssets.length})
              </button>
            </div>
          </div>

          {!isUSD && (
            <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)' }}>
              Hover any price or value to see exact USD amount
            </span>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid oklch(100% 0 0 / 0.07)', color: 'oklch(45% 0.01 240)', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.7rem' }}>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Asset</th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600 }}>
                  Price ({currency})
                </th>
                <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600 }}>
                  Value ({currency})
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Current %</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Target %</th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontWeight: 600 }}>Drift</th>
              </tr>
            </thead>
            <tbody>
              {displayedAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'oklch(50% 0.01 240)' }}>
                    {filter === 'alpha' ? 'No Binance Alpha tokens found. Add them in Settings.' : 'No assets in this category.'}
                  </td>
                </tr>
              ) : (
                displayedAssets.map((asset, i) => (
                  <tr
                    key={asset.symbol}
                    style={{
                      borderBottom: i < displayedAssets.length - 1 ? '1px solid oklch(100% 0 0 / 0.04)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '0.85rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: `${asset.logoColor}22`,
                          border: `1px solid ${asset.logoColor}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700, color: asset.logoColor,
                          fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
                        }}>
                          {asset.symbol.slice(0, 3)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: 'oklch(90% 0.01 240)', fontSize: '0.9rem' }}>
                            {asset.symbol}
                          </span>
                          {asset.isAlpha && (
                            <span
                              className="badge badge-xs mono"
                              style={{
                                background: 'oklch(60% 0.25 300 / 0.15)',
                                color: '#C084FC',
                                border: '1px solid oklch(60% 0.25 300 / 0.35)',
                                fontWeight: 700,
                                fontSize: '0.6rem',
                                padding: '0.15rem 0.4rem',
                                letterSpacing: '0.04em',
                              }}
                            >
                              ⚡ ALPHA
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                  <td className="mono" style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: 'oklch(70% 0.01 240)' }}>
                    {fmtAmount(asset.amount)}
                  </td>

                  {/* Price in active currency with USD tooltip */}
                  <td className="mono" style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <CurrencyDisplay
                      usdValue={asset.price}
                      currency={currency}
                      rates={rates}
                    />
                  </td>

                  {/* Value in active currency with USD tooltip */}
                  <td className="mono" style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: 600, color: 'oklch(95% 0.01 240)' }}>
                    <CurrencyDisplay
                      usdValue={asset.usdtValue}
                      currency={currency}
                      rates={rates}
                      showUsdSub={!isUSD}
                    />
                  </td>

                  <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'oklch(75% 0.01 240)' }}>
                    {asset.currentPct.toFixed(2)}%
                  </td>

                  <td className="mono" style={{ padding: '0.85rem 1rem', textAlign: 'right', color: asset.targetPct > 0 ? '#22c55e' : 'oklch(40% 0.01 240)' }}>
                    {asset.targetPct > 0 ? `${asset.targetPct.toFixed(2)}%` : '—'}
                  </td>

                  <td className="mono" style={{ padding: '0.85rem 1.5rem', textAlign: 'right' }}>
                    {asset.targetPct > 0 ? (
                      <span style={{ color: asset.drift > 1 ? '#F0B90B' : asset.drift < -1 ? '#ef4444' : 'oklch(60% 0.01 240)', fontWeight: 600 }}>
                        {asset.drift > 0 ? '▲ +' : asset.drift < 0 ? '▼ ' : '● '}
                        {asset.drift.toFixed(2)}%
                      </span>
                    ) : (
                      <span style={{ color: 'oklch(40% 0.01 240)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
