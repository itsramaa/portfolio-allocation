// ─── Binance API client ──────────────────────────────────────────────────────
// Uses Vite proxy: /binance → https://api.binance.com
// Signed endpoints use HMAC-SHA256 via SubtleCrypto (runs in browser)
// Automatically syncs with Binance server time (/api/v3/time) to prevent timestamp drift (-1021)
// Supports Spot account (/api/v3/account), Funding wallet (/sapi/v1/asset/get-funding-asset), and Simple Earn positions

import type { ApiCredentials } from './types'
import { sha256 } from 'js-sha256'

const BASE = '/binance'

// ─── Server time synchronization ─────────────────────────────────────────────
let serverTimeOffset: number | null = null
let lastTimeSync = 0

// ─── Public GET request ────────────────────────────────────────────────────
async function publicGet(path: string, params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))
  const res = await fetch(`${BASE}${path}?${qs.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ─── Synchronize local clock with Binance server clock ─────────────────────
export async function syncServerTime(): Promise<number> {
  try {
    const t0 = Date.now()
    const data = await publicGet('/api/v3/time')
    const t1 = Date.now()
    const rtt = t1 - t0
    const serverTime: number = data.serverTime
    serverTimeOffset = (serverTime + Math.floor(rtt / 2)) - t1
    lastTimeSync = Date.now()
    return serverTimeOffset
  } catch (err) {
    console.warn('Could not sync Binance server time, falling back to local clock:', err)
    if (serverTimeOffset === null) serverTimeOffset = 0
    return serverTimeOffset
  }
}

async function getCalibratedTimestamp(): Promise<number> {
  if (serverTimeOffset === null || Date.now() - lastTimeSync > 10 * 60 * 1000) {
    await syncServerTime()  
  }
  return Date.now() + (serverTimeOffset ?? 0)
}

// ─── HMAC-SHA256 via WebCrypto (with js-sha256 fallback for non-secure HTTP contexts) ───
async function hmac(secret: string, message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
      return Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      // fallback to pure JS HMAC below
    }
  }
  return sha256.hmac(secret, message)
}

// ─── Signed GET request with auto-retry on timestamp drift ─────────────────
async function signedGet(
  path: string,
  params: Record<string, string | number>,
  creds: ApiCredentials,
  retryCount = 0
): Promise<any> {
  const timestamp = await getCalibratedTimestamp()
  const fullParams = {
    ...params,
    recvWindow: 60000,
    timestamp,
  }
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(fullParams).map(([k, v]) => [k, String(v)]))
  )
  const signature = await hmac(creds.apiSecret, qs.toString())
  qs.append('signature', signature)

  const res = await fetch(`${BASE}${path}?${qs.toString()}`, {
    headers: { 'X-MBX-APIKEY': creds.apiKey }
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg: string = err.msg || `HTTP ${res.status}`

    if (
      (err.code === -1021 || msg.includes('ahead of the server') || msg.includes('recvWindow')) &&
      retryCount < 2
    ) {
      console.warn('Binance timestamp drift detected. Resyncing server time and retrying...')
      await syncServerTime()
      return signedGet(path, params, creds, retryCount + 1)
    }

    throw new Error(msg)
  }

  return res.json()
}

// ─── Signed POST request ───────────────────────────────────────────────────
async function signedPost(
  path: string,
  params: Record<string, string | number>,
  creds: ApiCredentials,
  retryCount = 0
): Promise<any> {
  const timestamp = await getCalibratedTimestamp()
  const fullParams = {
    ...params,
    recvWindow: 60000,
    timestamp,
  }
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(fullParams).map(([k, v]) => [k, String(v)]))
  )
  const signature = await hmac(creds.apiSecret, qs.toString())
  qs.append('signature', signature)

  const res = await fetch(`${BASE}${path}?${qs.toString()}`, {
    method: 'POST',
    headers: { 'X-MBX-APIKEY': creds.apiKey }
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg: string = err.msg || `HTTP ${res.status}`

    if (
      (err.code === -1021 || msg.includes('ahead of the server') || msg.includes('recvWindow')) &&
      retryCount < 2
    ) {
      await syncServerTime()
      return signedPost(path, params, creds, retryCount + 1)
    }

    throw new Error(msg)
  }

  return res.json()
}

// ─── Fetch combined balances (Spot + Funding + Simple Earn) ───────────────
export async function fetchAccountBalances(creds: ApiCredentials): Promise<Array<{ asset: string; free: string; locked: string }>> {
  const assetMap = new Map<string, { free: number; locked: number }>()

  // 1. Fetch Spot Account Balances
  try {
    const spotData = await signedGet('/api/v3/account', {}, creds)
    if (spotData && Array.isArray(spotData.balances)) {
      for (const b of spotData.balances) {
        const free = parseFloat(b.free) || 0
        const locked = parseFloat(b.locked) || 0
        if (free + locked > 0) {
          assetMap.set(b.asset, { free, locked })
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch spot balances:', err)
    throw err
  }

  // 2. Also query Funding Wallet (where P2P crypto deposits land)
  try {
    const fundingData = await signedPost('/sapi/v1/asset/get-funding-asset', {}, creds)
    if (Array.isArray(fundingData)) {
      for (const f of fundingData) {
        const free = parseFloat(f.free) || 0
        const locked = (parseFloat(f.locked) || 0) + (parseFloat(f.freeze) || 0)
        if (free + locked > 0) {
          const current = assetMap.get(f.asset) || { free: 0, locked: 0 }
          assetMap.set(f.asset, {
            free: current.free + free,
            locked: current.locked + locked,
          })
        }
      }
    }
  } catch {
    // Silently ignore if API key lacks funding permissions
  }

  // 3. Also query Simple Earn Flexible positions (where yield-earning assets live)
  try {
    const earnData = await signedGet('/sapi/v1/simple-earn/flexible/position', { size: 100 }, creds)
    if (earnData && Array.isArray(earnData.rows)) {
      for (const row of earnData.rows) {
        const amt = parseFloat(row.totalAmount) || 0
        if (amt > 0) {
          const current = assetMap.get(row.asset) || { free: 0, locked: 0 }
          assetMap.set(row.asset, {
            free: current.free + amt,
            locked: current.locked,
          })
        }
      }
    }
  } catch {
    // Silently ignore if API key lacks earn permissions
  }

  return Array.from(assetMap.entries()).map(([asset, { free, locked }]) => ({
    asset,
    free: String(free),
    locked: String(locked),
  }))
}

// ─── Fetch all USDT ticker prices ──────────────────────────────────────────
export async function fetchAllPrices(): Promise<Record<string, number>> {
  const data: Array<{ symbol: string; price: string }> = await publicGet('/api/v3/ticker/price')
  return Object.fromEntries(data.map(t => [t.symbol, parseFloat(t.price)]))
}

// ─── Test connection (ping + server time sync + account check) ────────────
export async function testConnection(creds: ApiCredentials): Promise<void> {
  await publicGet('/api/v3/ping')
  await syncServerTime()
  await signedGet('/api/v3/account', {}, creds)
}

// ─── Fetch 24h price change ────────────────────────────────────────────────
export async function fetch24hChange(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  await Promise.allSettled(
    symbols.map(async sym => {
      try {
        const data = await publicGet('/api/v3/ticker/24hr', { symbol: sym })
        result[sym] = parseFloat(data.priceChangePercent)
      } catch { /* skip */ }
    })
  )
  return result
}

// ─── Fetch Alpha token list (public endpoint) ───────────────────────────────
// According to official docs, this endpoint is public and does NOT require authentication
export async function fetchAlphaTokenList(_creds: ApiCredentials): Promise<string[]> {
  try {
    const res = await fetch('/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list')

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    
    // Extract symbols from response (data.data is an array of token objects)
    if (data && data.success && Array.isArray(data.data)) {
      const symbols = data.data
        .map((item: any) => item.symbol || item.alphaId?.replace('ALPHA_', ''))
        .filter(Boolean)
      console.log(`Fetched ${symbols.length} Alpha tokens from public API`)
      return symbols
    }
    
    return []
  } catch (err) {
    console.error('Failed to fetch Alpha token list:', err)
    throw err
  }
}
