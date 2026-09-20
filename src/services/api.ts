import type { FxRates, PortfolioSnapshot } from '../types'

const TOKEN_STORAGE_KEY = 'portfolio_auth_token'

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  const token = getAuthToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearAuthToken()
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`
    try {
      const errJson = await response.json()
      if (errJson?.error) {
        errorMsg = errJson.error
      }
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg)
  }

  return response.json() as Promise<T>
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export async function login(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || 'Password salah' }
    }

    const data = (await res.json()) as { token: string }
    setAuthToken(data.token)
    return { success: true, token: data.token }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menghubungi server Go',
    }
  }
}

export async function checkAuth(): Promise<boolean> {
  if (!getAuthToken()) return false
  try {
    await request<{ ok: boolean }>('/api/auth/check')
    return true
  } catch {
    clearAuthToken()
    return false
  }
}

export async function changePassword(
  current: string,
  next: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await request<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current, next }),
    })
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal mengganti password',
    }
  }
}

// ─── Settings API (SQLite) ───────────────────────────────────────────────────

export type SettingKey = 'credentials' | 'targets' | 'archived' | 'currency'

export async function getSetting<T>(key: SettingKey): Promise<T | null> {
  try {
    const res = await request<{ value: T | null }>(`/api/settings/${key}`)
    return res.value
  } catch (err) {
    console.warn(`Failed to fetch setting ${key} from SQLite:`, err)
    return null
  }
}

export async function setSetting<T>(key: SettingKey, value: T): Promise<void> {
  try {
    await request<{ ok: boolean }>(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
  } catch (err) {
    console.error(`Failed to save setting ${key} to SQLite:`, err)
  }
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  try {
    await request<{ ok: boolean }>(`/api/settings/${key}`, {
      method: 'DELETE',
    })
  } catch (err) {
    console.error(`Failed to delete setting ${key} from SQLite:`, err)
  }
}

// ─── History API (SQLite) ───────────────────────────────────────────────────

export async function fetchHistoryFromDB(): Promise<PortfolioSnapshot[]> {
  try {
    const res = await request<PortfolioSnapshot[]>('/api/history')
    return res || []
  } catch (err) {
    console.warn('Failed to fetch history from SQLite:', err)
    return []
  }
}

export async function postSnapshotToDB(snapshot: PortfolioSnapshot): Promise<void> {
  try {
    await request<{ ok: boolean }>('/api/history', {
      method: 'POST',
      body: JSON.stringify({
        dayKey: new Date(snapshot.timestamp).toISOString().slice(0, 10),
        timestamp: snapshot.timestamp,
        totalUSDT: snapshot.totalUSDT,
        btcPrice: snapshot.btcPrice,
      }),
    })
  } catch (err) {
    console.error('Failed to post snapshot to SQLite:', err)
  }
}

export async function clearHistoryInDB(): Promise<void> {
  try {
    await request<{ ok: boolean }>('/api/history', {
      method: 'DELETE',
    })
  } catch (err) {
    console.error('Failed to clear history in SQLite:', err)
  }
}

// ─── FX Cache API (SQLite) ───────────────────────────────────────────────────

export async function fetchFXCacheFromDB(): Promise<FxRates | null> {
  try {
    const res = await request<{ data: FxRates | null }>('/api/fxcache')
    return res.data
  } catch (err) {
    console.warn('Failed to fetch FX cache from SQLite:', err)
    return null
  }
}

export async function saveFXCacheToDB(fx: FxRates): Promise<void> {
  try {
    await request<{ ok: boolean }>('/api/fxcache', {
      method: 'POST',
      body: JSON.stringify(fx),
    })
  } catch (err) {
    console.error('Failed to save FX cache to SQLite:', err)
  }
}

// ─── FX Live Rates (fetched server-side) ─────────────────────────────────────

export async function fetchFXRatesFromServer(): Promise<FxRates | null> {
  try {
    return await request<FxRates>('/api/fx')
  } catch {
    return null
  }
}

// ─── Portfolio Business Logic API ────────────────────────────────────────────

export interface BackendAsset {
  symbol: string
  name: string
  amount: number
  price: number
  value: number
  currentPct: number
  targetPct: number
  targetValue: number
  diff: number
  diffPct: number
  action: 'BUY' | 'SELL' | 'HOLD'
  drift: number
}

export interface PortfolioSyncResponse {
  status: 'connected' | 'unconfigured' | 'error'
  isDemo: boolean
  assets: BackendAsset[]
  prices: Record<string, number>
  totalUSDT: number
  btcPrice: number
  lastRefreshed: number
  error?: string
}

export interface InjectionItemResponse {
  symbol: string
  price: number
  currentValue: number
  currentPct: number
  targetPct: number
  allocated: number
  estimatedQty: number
  newValue: number
  newPct: number
}

export interface InjectionResultResponse {
  depositAmount: number
  newTotalUSDT: number
  items: InjectionItemResponse[]
}

export interface RebalanceOrderResponse {
  symbol: string
  action: 'BUY' | 'SELL'
  amountUSDT: number
  estimatedQty: number
  currentPct: number
  targetPct: number
  diffPct: number
  driftPct: number
  price: number
  belowMinOrder?: boolean
  isTriggered?: boolean
}

export interface RebalanceResultResponse {
  totalPortfolioUSDT: number
  rebalanceBaseUSDT: number
  totalBuyUSDT: number
  totalSellUSDT: number
  netTurnoverUSDT: number
  estimatedFeesUSDT: number
  maxDriftPct: number
  orders: RebalanceOrderResponse[]
}

export interface BackendSignal {
  score: number
  available: boolean
  confidence: number
  change24h: number
  change7d: number
  sources: string[]
}

export interface BackendProviderStatus {
  available: boolean
  source: string
  error?: string
  updatedAt: number
}

export interface BackendNarrative {
  id: string
  name: string
  emoji: string
  description: string
  lifecycle: string
  score: number
  score24hChange: number
  score7dChange: number
  signals: {
    social: BackendSignal
    market: BackendSignal
    volume: BackendSignal
    onchain: BackendSignal
    capitalFlow: BackendSignal
    catalyst: BackendSignal
  }
  signalChanges: {
    social24h: number
    volume24h: number
    capitalFlow7d: number
    onchain7d: number
  }
  assets: string[]
  drivers: string[]
  updatedAt: number
  heldAssets: string[]
  heldAllocation: number
  heldValueUSDT: number
}

export interface NarrativesReportResponse {
  narratives: BackendNarrative[]
  topNarrative: string
  coveredCount: number
  totalNarratives: number
  diversificationScore: number
  marketSentiment?: {
    value: number
    classification: string
    available: boolean
    source: string
    updatedAt: number
  }
  providerStatuses?: Record<string, BackendProviderStatus>
}

export async function syncPortfolio(): Promise<PortfolioSyncResponse> {
  return request<PortfolioSyncResponse>('/api/portfolio/sync')
}

export async function demoPortfolio(): Promise<PortfolioSyncResponse> {
  return request<PortfolioSyncResponse>('/api/portfolio/demo')
}

export async function testBinanceConnection(
  apiKey: string,
  apiSecret: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await request<{ ok: boolean; error?: string }>('/api/portfolio/test-connection', {
      method: 'POST',
      body: JSON.stringify({ apiKey, apiSecret }),
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

export async function calculateInjection(
  assets: BackendAsset[],
  targets: Record<string, number>,
  depositAmount: number
): Promise<InjectionResultResponse | null> {
  try {
    return await request<InjectionResultResponse>('/api/portfolio/inject', {
      method: 'POST',
      body: JSON.stringify({ assets, targets, depositAmount }),
    })
  } catch (err) {
    console.error('Injection calc failed:', err)
    return null
  }
}

export async function calculateRebalance(
  assets: BackendAsset[],
  minTradeUSDT?: number,
  thresholdPct?: number
): Promise<RebalanceResultResponse | null> {
  try {
    return await request<RebalanceResultResponse>('/api/portfolio/rebalance', {
      method: 'POST',
      body: JSON.stringify({ assets, minTradeUSDT, thresholdPct }),
    })
  } catch (err) {
    console.error('Rebalance calc failed:', err)
    return null
  }
}

export async function fetchNarratives(): Promise<NarrativesReportResponse | null> {
  try {
    return await request<NarrativesReportResponse>('/api/portfolio/narratives')
  } catch (err) {
    console.error('Narratives fetch failed:', err)
    return null
  }
}

export interface PublicConfigResponse {
  hasCredentials: boolean
  popularCoins: string[]
  dustThresholdUSDT: number
  actionThresholdPct: number
  rebalanceMinTradeUSDT: number
  rebalanceThresholdPct: number
  rebalanceFeeRate: number
}

export async function fetchPublicConfig(): Promise<PublicConfigResponse | null> {
  try {
    return await request<PublicConfigResponse>('/api/config')
  } catch (err) {
    console.error('Config fetch failed:', err)
    return null
  }
}

export interface CredentialsStatus {
  configured: boolean
  source: 'database' | 'env' | 'none'
  maskedApiKey: string
}

export async function fetchCredentialsStatus(): Promise<CredentialsStatus> {
  try {
    return await request<CredentialsStatus>('/api/credentials')
  } catch (err) {
    console.error('Failed to fetch credentials status:', err)
    return { configured: false, source: 'none', maskedApiKey: '' }
  }
}

export async function saveCredentialsToBackend(
  apiKey: string,
  apiSecret: string
): Promise<{ ok: boolean; error?: string; maskedApiKey?: string; source?: string }> {
  try {
    return await request<{ ok: boolean; error?: string; maskedApiKey?: string; source?: string }>(
      '/api/credentials',
      {
        method: 'POST',
        body: JSON.stringify({ apiKey, apiSecret }),
      }
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Gagal menyimpan kredensial' }
  }
}

export async function deleteCredentialsFromBackend(): Promise<{ ok: boolean; configured: boolean; source: string }> {
  try {
    return await request<{ ok: boolean; configured: boolean; source: string }>('/api/credentials', {
      method: 'DELETE',
    })
  } catch (err) {
    console.error('Failed to delete credentials:', err)
    return { ok: false, configured: false, source: 'none' }
  }
}

