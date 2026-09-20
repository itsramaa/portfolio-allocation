// ─── Narrative scoring & exposure engine ─────────────────────────────────────
import type { Asset, Narrative, NarrativeExposure, NarrativeOverviewStats, NarrativeSignals } from '../types'
import { HOT_SCORE_THRESHOLD, NARRATIVE_SCORE_WEIGHTS } from '../config/narratives'

/** Compute weighted composite score from individual signal scores. */
export function computeNarrativeScore(signals: NarrativeSignals): number {
  const w = NARRATIVE_SCORE_WEIGHTS
  return Math.round(
    signals.social      * w.social +
    signals.market      * w.market +
    signals.volume      * w.volume +
    signals.capitalFlow * w.capitalFlow +
    signals.onchain     * w.onchain +
    signals.catalyst    * w.catalyst
  )
}

/** Aggregate lifecycle counts and find the top-trending narrative. */
export function getNarrativeOverviewStats(narratives: Narrative[]): NarrativeOverviewStats {
  let emerging = 0, growing = 0, hot = 0, cooling = 0
  let topTrending: Narrative | null = null

  for (const n of narratives) {
    if (n.lifecycle === 'emerging') emerging++
    if (n.lifecycle === 'growing') growing++
    if (n.lifecycle === 'cooling') cooling++
    if (n.score >= HOT_SCORE_THRESHOLD) hot++

    if (!topTrending || n.score7dChange > topTrending.score7dChange) {
      topTrending = n
    }
  }

  return { emerging, growing, hot, cooling, topTrending }
}

function normalizeAssetSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim()
  return upper === 'RNDR' ? 'RENDER' : upper === 'MATIC' ? 'POL' : upper
}

/**
 * Computes each narrative's portfolio exposure: the sum of currentPct of all
 * held assets that belong to a given narrative.
 * Only returns narratives where the user has at least some exposure.
 */
export function computePortfolioExposure(
  narratives: Narrative[],
  assets: Asset[]
): NarrativeExposure[] {
  const held = new Map(assets.map(a => [normalizeAssetSymbol(a.symbol), a.currentPct]))
  const exposures: NarrativeExposure[] = []

  for (const n of narratives) {
    const matched: NarrativeExposure['assets'] = []
    let total = 0

    for (const sym of n.assets) {
      const pct = held.get(normalizeAssetSymbol(sym)) ?? 0
      if (pct > 0) {
        matched.push({ symbol: sym, currentPct: pct })
        total += pct
      }
    }

    if (total > 0) {
      exposures.push({
        narrativeId: n.id,
        name: n.name,
        emoji: n.emoji,
        exposurePct: Math.round(total * 10) / 10,
        assets: matched.sort((a, b) => b.currentPct - a.currentPct),
      })
    }
  }

  return exposures.sort((a, b) => b.exposurePct - a.exposurePct)
}

/** Signal display name map for UI rendering. */
export const SIGNAL_LABELS: Record<keyof NarrativeSignals, string> = {
  social:      'Social Attention',
  market:      'Market Momentum',
  volume:      'Trading Volume',
  onchain:     'On-chain Activity',
  capitalFlow: 'Capital Flow',
  catalyst:    'Catalyst',
}

/** Signal key order for consistent rendering. */
export const SIGNAL_KEYS: Array<keyof NarrativeSignals> = [
  'social', 'market', 'volume', 'capitalFlow', 'onchain', 'catalyst',
]

/** Lifecycle display config. */
export const LIFECYCLE_META: Record<string, { label: string; color: string; description: string }> = {
  emerging:    { label: 'Emerging',    color: '#22c55e', description: 'Early acceleration — attention and activity just starting to pick up.' },
  growing:     { label: 'Growing',     color: '#3b82f6', description: 'Sustained momentum — attention and market activity are both increasing.' },
  mainstream:  { label: 'Mainstream',  color: '#F0B90B', description: 'Broadly known — most alpha captured, narrative stable but not accelerating.' },
  crowded:     { label: 'Crowded',     color: '#f97316', description: 'Historically elevated attention — late-cycle positioning risk increasing.' },
  'insufficient-data': { label: 'Insufficient Data', color: '#6b7280', description: 'Free data sources are not available yet for this narrative.' },
  cooling:     { label: 'Cooling',     color: '#6b7280', description: 'Declining attention and activity — narrative rotating out of focus.' },
}
