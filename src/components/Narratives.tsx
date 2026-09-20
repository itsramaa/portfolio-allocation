// ─── Narratives Page ─────────────────────────────────────────────────────────
import type { Asset, Narrative, NarrativeLifecycle } from '../types'
import { useNarratives } from '../hooks/useNarratives'
import { SIGNAL_KEYS, SIGNAL_LABELS, LIFECYCLE_META } from '../lib/narratives'
import { assetColor } from '../lib/portfolio'

interface NarrativesProps {
  assets: Asset[]
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function OverviewCard({
  emoji, label, value, sub, accent,
}: {
  emoji: string
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div style={{
      background: 'oklch(13% 0.012 240)',
      border: '1px solid oklch(100% 0 0 / 0.07)',
      borderRadius: '0.75rem',
      padding: '1.1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
      minWidth: 0,
    }}>
      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{emoji}</span>
      <span style={{
        fontSize: '1.65rem',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: accent ?? 'oklch(92% 0.01 240)',
        lineHeight: 1,
      }}>{value}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'oklch(65% 0.01 240)' }}>{label}</span>
      {sub && <span style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)' }}>{sub}</span>}
    </div>
  )
}

function ScoreBar({ score, available = true, color = '#3b82f6' }: { score: number; available?: boolean; color?: string }) {
  if (!available) {
    return <span style={{ fontSize: '0.68rem', color: 'oklch(55% 0.01 240)' }}>Unavailable</span>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
      <div style={{
        flex: 1,
        height: 6,
        background: 'oklch(100% 0 0 / 0.07)',
        borderRadius: 999,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`,
          height: '100%',
          background: color,
          borderRadius: 999,
          transition: 'opacity 0.2s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'oklch(85% 0.01 240)', minWidth: 24, textAlign: 'right' }}>
        {score}
      </span>
    </div>
  )
}

function ChangeChip({ value }: { value: number }) {
  const up = value > 0
  const neutral = value === 0
  const color = neutral ? 'oklch(55% 0.01 240)' : up ? '#22c55e' : '#ef4444'
  const sign = up ? '+' : ''
  return (
    <span style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      color,
      background: neutral ? 'transparent' : `${color}18`,
      padding: '0.15rem 0.4rem',
      borderRadius: '0.25rem',
      whiteSpace: 'nowrap',
    }}>
      {neutral ? '→' : up ? '↑' : '↓'} {sign}{value.toFixed(1)}%
    </span>
  )
}

function LifecycleBadge({ lifecycle }: { lifecycle: NarrativeLifecycle }) {
  const meta = LIFECYCLE_META[lifecycle]
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: meta.color,
      background: `${meta.color}18`,
      border: `1px solid ${meta.color}40`,
      padding: '0.2rem 0.5rem',
      borderRadius: '0.25rem',
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

function LifecycleTrack({ lifecycle }: { lifecycle: NarrativeLifecycle }) {
  const stages: NarrativeLifecycle[] = ['emerging', 'growing', 'mainstream', 'crowded', 'cooling']
  const currentIdx = stages.indexOf(lifecycle)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      {stages.map((stage, i) => {
        const active = i === currentIdx
        const past = i < currentIdx
        const meta = LIFECYCLE_META[stage]
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', flex: 1 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: active ? meta.color : past ? 'oklch(40% 0.01 240)' : 'oklch(20% 0.01 240)',
                border: active ? `2px solid ${meta.color}` : '2px solid transparent',
                boxShadow: active ? `0 0 8px ${meta.color}` : 'none',
                transition: 'all 0.3s',
              }} />
              <span style={{
                fontSize: '0.6rem',
                color: active ? meta.color : 'oklch(40% 0.01 240)',
                fontWeight: active ? 700 : 400,
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }}>{meta.label}</span>
            </div>
            {i < stages.length - 1 && (
              <div style={{
                height: 1,
                flex: 1,
                background: i < currentIdx ? 'oklch(40% 0.01 240)' : 'oklch(20% 0.01 240)',
                marginBottom: '1.1rem',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function NarrativeDetailPanel({
  narrative,
  onClose,
}: {
  narrative: Narrative
  onClose: () => void
}) {
  const meta = LIFECYCLE_META[narrative.lifecycle]

  return (
    <div
      className="fade-up"
      style={{
        background: 'oklch(13% 0.012 240)',
        border: '1px solid oklch(100% 0 0 / 0.1)',
        borderRadius: '1rem',
        padding: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{narrative.emoji}</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{narrative.name}</span>
            <LifecycleBadge lifecycle={narrative.lifecycle} />
          </div>
          <p style={{ fontSize: '0.78rem', color: 'oklch(55% 0.01 240)', maxWidth: 520, lineHeight: 1.5 }}>
            {narrative.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'oklch(50% 0.01 240)',
            cursor: 'pointer',
            padding: '0.25rem',
            fontSize: '1.1rem',
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Close narrative detail"
        >✕</button>
      </div>

      {/* Score + changes */}
      <div className="narrative-score-row" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{
          background: 'oklch(16% 0.015 240)',
          border: '1px solid oklch(100% 0 0 / 0.07)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          minWidth: 120,
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: meta.color, lineHeight: 1 }}>
            {narrative.score}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'oklch(55% 0.01 240)', marginTop: '0.25rem' }}>Narrative Score</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', minWidth: 32 }}>24H</span>
            <ChangeChip value={narrative.score24hChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', minWidth: 32 }}>7D</span>
            <ChangeChip value={narrative.score7dChange} />
          </div>
        </div>
      </div>

      {/* Lifecycle track */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'oklch(55% 0.01 240)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Narrative Lifecycle
        </div>
        <LifecycleTrack lifecycle={narrative.lifecycle} />
        <p style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', marginTop: '0.75rem', lineHeight: 1.5 }}>
          {meta.description}
        </p>
      </div>

      {/* Signal Breakdown */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'oklch(55% 0.01 240)', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Signal Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {SIGNAL_KEYS.map(key => (
            <div key={key} className="signal-breakdown-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'oklch(60% 0.01 240)', minWidth: 130 }}>
                {SIGNAL_LABELS[key]}
              </span>
              <div style={{ flex: 1 }}>
                <ScoreBar score={narrative.signals[key]} available={narrative.signalAvailability?.[key] !== false} color={meta.color} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Changes */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'oklch(55% 0.01 240)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Signal Changes
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Social 24H', value: narrative.signalChanges.social24h },
            { label: 'Volume 24H', value: narrative.signalChanges.volume24h },
            { label: 'Capital Flow 7D', value: narrative.signalChanges.capitalFlow7d },
            { label: 'On-chain 7D', value: narrative.signalChanges.onchain7d },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'oklch(16% 0.015 240)',
              border: '1px solid oklch(100% 0 0 / 0.07)',
              borderRadius: '0.5rem',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
            }}>
              <span style={{ fontSize: '0.65rem', color: 'oklch(50% 0.01 240)' }}>{label}</span>
              <ChangeChip value={value} />
            </div>
          ))}
        </div>
      </div>

      {/* Narrative Drivers */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'oklch(55% 0.01 240)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Why is this narrative moving?
        </div>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {narrative.drivers.map((driver, i) => (
            <li key={i} style={{ fontSize: '0.78rem', color: 'oklch(70% 0.01 240)', lineHeight: 1.55 }}>
              {driver}
            </li>
          ))}
        </ol>
      </div>

      {/* Related Assets */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'oklch(55% 0.01 240)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Related Assets
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {narrative.assets.map(sym => (
            <div key={sym} style={{
              background: 'oklch(16% 0.015 240)',
              border: `1px solid ${assetColor(sym)}40`,
              borderRadius: '0.375rem',
              padding: '0.3rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: assetColor(sym),
                flexShrink: 0,
                display: 'block',
              }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'oklch(80% 0.01 240)' }}>{sym}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Narratives({ assets }: NarrativesProps) {
  const {
    filteredNarratives,
    overviewStats,
    exposure,
    selectedNarrative,
    setSelectedNarrative,
    sortKey,
    setSortKey,
    lifecycleFilter,
    setLifecycleFilter,
    loading,
    error,
    refetch,
  } = useNarratives(assets)


  const lifecycleOptions: Array<{ value: typeof lifecycleFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'emerging', label: '🔥 Emerging' },
    { value: 'growing', label: '📈 Growing' },
    { value: 'mainstream', label: '⚡ Mainstream' },
    { value: 'crowded', label: '🔴 Crowded' },
    { value: 'cooling', label: '🧊 Cooling' },
  ]

  const sortOptions: Array<{ value: typeof sortKey; label: string }> = [
    { value: 'score', label: 'Score' },
    { value: 'score7dChange', label: '7D Change' },
    { value: 'score24hChange', label: '24H Change' },
    { value: 'name', label: 'Name' },
  ]

  const emergingNarratives = filteredNarratives.filter(n => n.lifecycle === 'emerging' || (n.score7dChange > 15 && n.lifecycle === 'growing'))

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
            Crypto Narratives
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'oklch(50% 0.01 240)', marginTop: '0.35rem' }}>
            Detecting emerging market themes via social, volume, on-chain, and capital flow signals
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          className="btn btn-ghost btn-sm mono"
          style={{ border: '1px solid oklch(100% 0 0 / 0.1)', fontSize: '0.75rem', flexShrink: 0 }}
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : '↻'} Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="alert alert-error" style={{ fontSize: '0.82rem' }}>
          <span>⚠ Failed to load narratives from server: {error}</span>
          <button type="button" className="btn btn-xs btn-ghost" onClick={refetch}>Retry</button>
        </div>
      )}

      {loading && filteredNarratives.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'oklch(55% 0.01 240)' }}>
          <span className="loading loading-spinner loading-md" />
          <p style={{ marginTop: '1rem', fontSize: '0.85rem' }}>Loading narratives from backend…</p>
        </div>
      )}
      {/* ── 1. Overview Cards ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '0.85rem',
      }}>
        <OverviewCard emoji="🔥" label="Emerging" value={overviewStats.emerging}
          sub="Accelerating activity" accent="#22c55e" />
        <OverviewCard emoji="📈" label="Growing" value={overviewStats.growing}
          sub="Sustained momentum" accent="#3b82f6" />
        <OverviewCard emoji="⚡" label="Hot (≥70)" value={overviewStats.hot}
          sub="High attention + activity" accent="#F0B90B" />
        <OverviewCard emoji="🧊" label="Cooling" value={overviewStats.cooling}
          sub="Declining attention" accent="#6b7280" />
        {overviewStats.topTrending && (
          <OverviewCard
            emoji="👀"
            label="Top 7D"
            value={overviewStats.topTrending.emoji + ' ' + overviewStats.topTrending.name}
            sub={`+${overviewStats.topTrending.score7dChange.toFixed(1)}% score`}
            accent="#a78bfa"
          />
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="narrative-filters" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {lifecycleOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLifecycleFilter(opt.value)}
              style={{
                background: lifecycleFilter === opt.value ? 'oklch(100% 0 0 / 0.1)' : 'transparent',
                border: `1px solid ${lifecycleFilter === opt.value ? 'oklch(100% 0 0 / 0.2)' : 'oklch(100% 0 0 / 0.08)'}`,
                borderRadius: '0.375rem',
                color: lifecycleFilter === opt.value ? 'oklch(90% 0.01 240)' : 'oklch(55% 0.01 240)',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.3rem 0.7rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="narrative-sort" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'oklch(50% 0.01 240)' }}>Sort:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as typeof sortKey)}
            style={{
              background: 'oklch(16% 0.012 240)',
              border: '1px solid oklch(100% 0 0 / 0.1)',
              borderRadius: '0.375rem',
              color: 'oklch(80% 0.01 240)',
              fontSize: '0.72rem',
              padding: '0.3rem 0.6rem',
              cursor: 'pointer',
            }}
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 2. Narrative Momentum Table ──────────────────────────────────────── */}
      <section>
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.85rem',
          }}
        >
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Narrative Momentum</span>
          <span style={{ fontSize: '0.75rem', color: 'oklch(50% 0.01 240)' }}>
            {filteredNarratives.length} narratives
          </span>
        </div>

        <div className="narrative-table-card desktop-only" style={{
          background: 'oklch(13% 0.012 240)',
          border: '1px solid oklch(100% 0 0 / 0.07)',
          borderRadius: '0.875rem',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div className="narrative-table-header" style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 2fr) 100px 70px 70px minmax(140px, 1fr)',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderBottom: '1px solid oklch(100% 0 0 / 0.06)',
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'oklch(45% 0.01 240)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            <span>Narrative</span>
            <span style={{ textAlign: 'right' }}>Score</span>
            <span style={{ textAlign: 'right' }}>24H</span>
            <span style={{ textAlign: 'right' }}>7D</span>
            <span>Momentum</span>
          </div>

          {filteredNarratives.map((n, i) => {
            const meta = LIFECYCLE_META[n.lifecycle]
            const isSelected = selectedNarrative?.id === n.id
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedNarrative(isSelected ? null : n)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, 2fr) 100px 70px 70px minmax(140px, 1fr)',
                  gap: '0.5rem',
                  padding: '0.9rem 1.25rem',
                  background: isSelected ? 'oklch(100% 0 0 / 0.04)' : 'transparent',
                  border: 'none',
                  borderBottom: i < filteredNarratives.length - 1 ? '1px solid oklch(100% 0 0 / 0.04)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  alignItems: 'center',
                  transition: 'background 0.15s',
                  color: 'inherit',
                }}
                className="hover-row narrative-table-row"
              >
                {/* Name + lifecycle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{n.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'oklch(88% 0.01 240)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.name}
                    </div>
                    <LifecycleBadge lifecycle={n.lifecycle} />
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right', fontSize: '1.05rem', fontWeight: 800, color: meta.color }}>
                  {n.score}
                </div>

                {/* 24H */}
                <div style={{ textAlign: 'right' }}>
                  <ChangeChip value={n.score24hChange} />
                </div>

                {/* 7D */}
                <div style={{ textAlign: 'right' }}>
                  <ChangeChip value={n.score7dChange} />
                </div>

                {/* Score bar */}
                <ScoreBar score={n.score} color={meta.color} />
              </button>
            )
          })}
        </div>
        <div className="mobile-card-list mobile-only">
          {filteredNarratives.map(n => {
            const meta = LIFECYCLE_META[n.lifecycle]
            return (
              <button type="button" className="mobile-data-card" key={`mobile-${n.id}`} onClick={() => setSelectedNarrative(selectedNarrative?.id === n.id ? null : n)} style={{ color: 'inherit', textAlign: 'left' }}>
                <div className="mobile-data-card-header">
                  <strong>{n.emoji} {n.name}</strong>
                  <span className="mono" style={{ color: meta.color }}>{n.score}</span>
                </div>
                <div className="mobile-data-card-meta">
                  <LifecycleBadge lifecycle={n.lifecycle} />
                  <ChangeChip value={n.score7dChange} />
                  <span>24H <span className="mono">{n.score24hChange.toFixed(1)}%</span></span>
                </div>
                <ScoreBar score={n.score} color={meta.color} />
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Detail Panel (inline, below table) ───────────────────────────────── */}
      {selectedNarrative && (
        <NarrativeDetailPanel
          narrative={selectedNarrative}
          onClose={() => setSelectedNarrative(null)}
        />
      )}

      {/* ── 3. Emerging Narrative Cards ──────────────────────────────────────── */}
      {emergingNarratives.length > 0 && (
        <section>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔥 Emerging Narratives
            <span style={{ fontSize: '0.72rem', color: 'oklch(50% 0.01 240)', fontWeight: 400 }}>
              accelerating momentum
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.85rem',
          }}>
            {emergingNarratives.map(n => {
              const meta = LIFECYCLE_META[n.lifecycle]
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNarrative(selectedNarrative?.id === n.id ? null : n)}
                  style={{
                    background: 'oklch(13% 0.012 240)',
                    border: `1px solid ${meta.color}30`,
                    borderRadius: '0.875rem',
                    padding: '1.1rem 1.25rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    color: 'inherit',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{n.emoji}</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{n.name}</div>
                        <LifecycleBadge lifecycle={n.lifecycle} />
                      </div>
                    </div>
                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: meta.color }}>{n.score}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      { label: 'Social', value: n.signalChanges.social24h },
                      { label: 'Volume', value: n.signalChanges.volume24h },
                      { label: 'On-chain', value: n.signalChanges.onchain7d },
                      { label: 'Capital', value: n.signalChanges.capitalFlow7d },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', color: 'oklch(50% 0.01 240)' }}>{label}</span>
                        <ChangeChip value={value} />
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.72rem', color: 'oklch(55% 0.01 240)', margin: 0, lineHeight: 1.5 }}>
                    {n.drivers[0]}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 4. Portfolio Narrative Exposure ──────────────────────────────────── */}
      <section>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Portfolio Narrative Exposure
        </div>
        <p style={{ fontSize: '0.75rem', color: 'oklch(50% 0.01 240)', marginBottom: '0.85rem' }}>
          Your hidden narrative concentration — reveals when multiple tokens belong to the same theme.
        </p>

        {exposure.length === 0 ? (
          <div style={{
            background: 'oklch(13% 0.012 240)',
            border: '1px solid oklch(100% 0 0 / 0.07)',
            borderRadius: '0.875rem',
            padding: '2rem',
            textAlign: 'center',
            color: 'oklch(45% 0.01 240)',
            fontSize: '0.82rem',
          }}>
            No portfolio data — connect your API key or load Demo Mode to see narrative exposure.
          </div>
        ) : (
          <div style={{
            background: 'oklch(13% 0.012 240)',
            border: '1px solid oklch(100% 0 0 / 0.07)',
            borderRadius: '0.875rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            {exposure.map(e => {
              const meta = LIFECYCLE_META[
                // find lifecycle from filtered narratives
                filteredNarratives.find(n => n.id === e.narrativeId)?.lifecycle ?? 'mainstream'
              ]
              return (
                <div key={e.narrativeId}>
                  <div className="exposure-row-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem' }}>{e.emoji}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{e.name}</span>
                      <span style={{ fontSize: '0.68rem', color: 'oklch(50% 0.01 240)' }}>
                        ({e.assets.map(a => a.symbol).join(', ')})
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: meta?.color ?? 'oklch(80% 0.01 240)' }}>
                      {e.exposurePct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{
                    height: 8,
                    background: 'oklch(100% 0 0 / 0.05)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, e.exposurePct)}%`,
                      background: meta?.color ?? '#3b82f6',
                      borderRadius: 999,
                      transition: 'opacity 0.2s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
