// ─── useNarratives hook ───────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import type { Asset, Narrative, NarrativeExposure, NarrativeOverviewStats } from '../types'
import { getNarrativeOverviewStats, computePortfolioExposure } from '../lib/narratives'
import { fetchNarratives } from '../services/api'
import type { BackendNarrative } from '../services/api'

type SortKey = 'score' | 'score24hChange' | 'score7dChange' | 'name'
type LifecycleFilter = 'all' | 'emerging' | 'growing' | 'mainstream' | 'crowded' | 'cooling'

interface UseNarrativesReturn {
  narratives: Narrative[]
  filteredNarratives: Narrative[]
  overviewStats: NarrativeOverviewStats
  exposure: NarrativeExposure[]
  selectedNarrative: Narrative | null
  setSelectedNarrative: (n: Narrative | null) => void
  sortKey: SortKey
  setSortKey: (k: SortKey) => void
  lifecycleFilter: LifecycleFilter
  setLifecycleFilter: (f: LifecycleFilter) => void
  loading: boolean
  error: string | null
  refetch: () => void
}

function adaptNarrative(b: BackendNarrative): Narrative {
  return {
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    description: b.description,
    lifecycle: b.lifecycle as Narrative['lifecycle'],
    score: b.score,
    score24hChange: b.score24hChange,
    score7dChange: b.score7dChange,
    signals: b.signals,
    signalChanges: b.signalChanges,
    assets: b.assets,
    drivers: b.drivers,
    updatedAt: b.updatedAt,
  }
}

export function useNarratives(assets: Asset[]): UseNarrativesReturn {
  const [selectedNarrative, setSelectedNarrative] = useState<Narrative | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all')
  const [narratives, setNarratives] = useState<Narrative[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchNarratives().then(res => {
      if (cancelled) return
      if (res) setNarratives(res.narratives.map(adaptNarrative))
      else setError('Failed to fetch narratives')
    }).catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch narratives')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [tick])

  const overviewStats = useMemo(() => getNarrativeOverviewStats(narratives), [narratives])
  const exposure = useMemo(() => computePortfolioExposure(narratives, assets), [narratives, assets])

  const filteredNarratives = useMemo(() => {
    const filtered = lifecycleFilter === 'all'
      ? narratives
      : narratives.filter(n => n.lifecycle === lifecycleFilter)

    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      return (b[sortKey] as number) - (a[sortKey] as number)
    })
  }, [narratives, lifecycleFilter, sortKey])

  return {
    narratives,
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
  }
}
