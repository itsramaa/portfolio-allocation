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

export function loadHistory(): PortfolioSnapshot[] {
  try {
    const raw = localStorage.getItem(KEYS.history)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  const history = loadHistory()
  // deduplicate — only save if last snapshot is > 1 hour old or first
  const last = history[history.length - 1]
  if (!last || snapshot.timestamp - last.timestamp > 60 * 60 * 1000) {
    history.push(snapshot)
    // keep only last 365 snapshots
    if (history.length > 365) history.splice(0, history.length - 365)
    localStorage.setItem(KEYS.history, JSON.stringify(history))
  }
}
