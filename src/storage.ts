// ─── localStorage helpers ────────────────────────────────────────────────────
import type { ApiCredentials, PortfolioSnapshot, TargetAllocation } from './types'

const KEYS = {
  creds: 'binance_creds',
  target: 'binance_target_alloc',
  history: 'portfolio_history',
  archived: 'archived_assets',
} as const

export function loadArchivedAssets(): Set<string> {
  try {
    const raw = localStorage.getItem(KEYS.archived)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

export function saveArchivedAssets(archived: Set<string>): void {
  localStorage.setItem(KEYS.archived, JSON.stringify([...archived]))
}

export function loadCredentials(): ApiCredentials | null {
  try {
    const raw = localStorage.getItem(KEYS.creds)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }

  const envApiKey = import.meta.env.VITE_BINANCE_API_KEY
  const envApiSecret = import.meta.env.VITE_BINANCE_API_SECRET
  if (envApiKey && envApiSecret) {
    return { apiKey: envApiKey, apiSecret: envApiSecret }
  }

  return null
}

export function saveCredentials(creds: ApiCredentials): void {
  localStorage.setItem(KEYS.creds, JSON.stringify(creds))
}

export function clearCredentials(): void {
  localStorage.removeItem(KEYS.creds)
}

export function loadTargetAllocation(): TargetAllocation {
  try {
    const raw = localStorage.getItem(KEYS.target)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveTargetAllocation(alloc: TargetAllocation): void {
  localStorage.setItem(KEYS.target, JSON.stringify(alloc))
}

/**
 * Returns the daily cycle key (YYYY-MM-DD) based on 07:00 WIB (00:00 UTC).
 * 07:00 WIB marks the daily candle close and opening of the crypto trading day in Indonesia.
 * 
 * Timeline:
 * 07:00 WIB (00:00 UTC) Date D ... 06:59:59 WIB (23:59:59 UTC) Date D
 */
export function getWibDailyCycleKey(timestamp: number): string {
  // 07:00 WIB === 00:00 UTC. The UTC date string directly defines the 07:00 WIB day cycle!
  return new Date(timestamp).toISOString().slice(0, 10)
}

/**
 * Consolidates snapshot records so that each 07:00 WIB day has at most 1 snapshot
 * (retains the latest valuation recorded during that day's cycle).
 */
export function consolidateDailySnapshots(snapshots: PortfolioSnapshot[]): PortfolioSnapshot[] {
  const map = new Map<string, PortfolioSnapshot>()
  for (const s of snapshots) {
    const key = getWibDailyCycleKey(s.timestamp)
    const existing = map.get(key)
    if (!existing || s.timestamp >= existing.timestamp) {
      map.set(key, s)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp)
}

export function loadHistory(): PortfolioSnapshot[] {
  try {
    const raw = localStorage.getItem(KEYS.history)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Automatically consolidate any legacy hourly snapshots into 1 snapshot per 07:00 WIB day
    return consolidateDailySnapshots(parsed)
  } catch {
    return []
  }
}

export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  const history = loadHistory()
  const snapDay = getWibDailyCycleKey(snapshot.timestamp)

  const existingIdx = history.findIndex(s => getWibDailyCycleKey(s.timestamp) === snapDay)

  if (existingIdx >= 0) {
    // Already recorded for today's 07:00 WIB cycle:
    // Update it with the latest valuation of the day
    history[existingIdx] = {
      ...snapshot,
      timestamp: snapshot.timestamp,
    }
  } else {
    // New day (clock crossed 07:00 WIB): record new daily snapshot
    history.push(snapshot)
  }

  // Sort chronologically and keep last 365 daily snapshots (1 full year)
  history.sort((a, b) => a.timestamp - b.timestamp)
  if (history.length > 365) history.splice(0, history.length - 365)

  localStorage.setItem(KEYS.history, JSON.stringify(history))
}
