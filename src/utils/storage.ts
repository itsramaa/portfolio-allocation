// ─── SQLite-Backed Storage Manager ───────────────────────────────────────────
import type { ApiCredentials, PortfolioSnapshot, TargetAllocation } from '../types'
import {
  getSetting,
  setSetting,
  fetchCredentialsStatus,
  saveCredentialsToBackend,
  deleteCredentialsFromBackend,
  fetchHistoryFromDB,
  postSnapshotToDB,
  clearHistoryInDB,
} from '../services/api'

// In-memory runtime cache populated from SQLite upon login/init
interface StorageCache {
  initialized: boolean
  credentials: ApiCredentials | null
  targets: TargetAllocation
  archived: Set<string>
  history: PortfolioSnapshot[]
}

const cache: StorageCache = {
  initialized: false,
  credentials: null,
  targets: {},
  archived: new Set<string>(),
  history: [],
}

/**
 * Initializes all user configurations and history from the Go Fiber SQLite backend.
 * Also performs a one-time migration of any legacy localStorage data if SQLite has no records yet.
 */
export async function initStorageFromBackend(): Promise<void> {
  try {
    const [credentialStatus, dbTargets, dbArchived, dbHistory] = await Promise.all([
      fetchCredentialsStatus(),
      getSetting<TargetAllocation>('targets'),
      getSetting<string[]>('archived'),
      fetchHistoryFromDB(),
    ])

    // Keep only the configured state in the browser. Secrets stay on the server.
    if (credentialStatus.configured) {
      cache.credentials = { apiKey: '', apiSecret: '' }
    } else {
      const legacyRaw = localStorage.getItem('binance_creds')
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as ApiCredentials
          const saved = await saveCredentialsToBackend(parsed.apiKey, parsed.apiSecret)
          if (saved.ok) {
            cache.credentials = { apiKey: '', apiSecret: '' }
            localStorage.removeItem('binance_creds')
          }
        } catch {
          /* ignore */
        }
      }
    }

    // Targets: check DB first, then legacy localStorage
    if (dbTargets && Object.keys(dbTargets).length > 0) {
      cache.targets = dbTargets
    } else {
      const legacyRaw = localStorage.getItem('binance_target_alloc')
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as TargetAllocation
          cache.targets = parsed
          await setSetting('targets', parsed)
          localStorage.removeItem('binance_target_alloc')
        } catch {
          /* ignore */
        }
      }
    }

    // Archived: check DB first, then legacy localStorage
    if (dbArchived && Array.isArray(dbArchived)) {
      cache.archived = new Set(dbArchived)
    } else {
      const legacyRaw = localStorage.getItem('archived_assets')
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as string[]
          cache.archived = new Set(parsed)
          await setSetting('archived', parsed)
          localStorage.removeItem('archived_assets')
        } catch {
          /* ignore */
        }
      }
    }

    // History: check DB first, then legacy localStorage
    if (dbHistory && dbHistory.length > 0) {
      cache.history = consolidateDailySnapshots(dbHistory)
    } else {
      const legacyRaw = localStorage.getItem('portfolio_history')
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as PortfolioSnapshot[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            const consolidated = consolidateDailySnapshots(parsed)
            cache.history = consolidated
            for (const s of consolidated) {
              await postSnapshotToDB(s)
            }
            localStorage.removeItem('portfolio_history')
          }
        } catch {
          /* ignore */
        }
      }
    }

    cache.initialized = true
  } catch (err) {
    console.error('Failed to initialize storage from SQLite backend:', err)
  }
}

export function isStorageInitialized(): boolean {
  return cache.initialized
}

// ─── Archived Assets ─────────────────────────────────────────────────────────

export function loadArchivedAssets(): Set<string> {
  return new Set(cache.archived)
}

export function saveArchivedAssets(archived: Set<string>): void {
  cache.archived = new Set(archived)
  void setSetting('archived', Array.from(archived))
}

// ─── Credentials ─────────────────────────────────────────────────────────────

export function loadCredentials(): ApiCredentials | null {
  return cache.credentials
}

export async function saveCredentials(creds: ApiCredentials): Promise<{ ok: boolean; error?: string }> {
  const result = await saveCredentialsToBackend(creds.apiKey, creds.apiSecret)
  if (result.ok) {
    cache.credentials = { apiKey: '', apiSecret: '' }
  }
  return result
}

export async function clearCredentials(): Promise<boolean> {
  const result = await deleteCredentialsFromBackend()
  if (!result.ok) return false
  cache.credentials = null
  return true
}

// ─── Target Allocation ───────────────────────────────────────────────────────

export function loadTargetAllocation(): TargetAllocation {
  return { ...cache.targets }
}

export function saveTargetAllocation(alloc: TargetAllocation): void {
  cache.targets = { ...alloc }
  void setSetting('targets', alloc)
}

// ─── WIB Cycle & Daily Snapshot Utilities ────────────────────────────────────

/**
 * Returns the daily cycle key (YYYY-MM-DD) based on 07:00 WIB (00:00 UTC).
 * 07:00 WIB marks the daily candle close and opening of the crypto trading day in Indonesia.
 */
export function getWibDailyCycleKey(timestamp: number): string {
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

// ─── Portfolio History ───────────────────────────────────────────────────────

export function loadHistory(): PortfolioSnapshot[] {
  return [...cache.history]
}

export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  const snapDay = getWibDailyCycleKey(snapshot.timestamp)
  const existingIdx = cache.history.findIndex(s => getWibDailyCycleKey(s.timestamp) === snapDay)

  if (existingIdx >= 0) {
    cache.history[existingIdx] = {
      ...snapshot,
      timestamp: snapshot.timestamp,
    }
  } else {
    cache.history.push(snapshot)
  }

  cache.history.sort((a, b) => a.timestamp - b.timestamp)
  void postSnapshotToDB(snapshot)
}

export function clearHistory(): void {
  cache.history = []
  void clearHistoryInDB()
}

export function formatWibDateTime(timestamp: number): string {
  try {
    return (
      new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(timestamp)) + ' WIB'
    )
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}
