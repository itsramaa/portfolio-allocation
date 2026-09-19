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

function getEndpointUrl(path: string): string {
  if (path.startsWith('/fapi') || path.startsWith('/dapi') || path.startsWith('/sapi') || path.startsWith('/bapi')) {
    return path
  }
  return `${BASE}${path}`
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

  const url = `${getEndpointUrl(path)}?${qs.toString()}`

  const res = await fetch(url, {
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

  const url = `${getEndpointUrl(path)}?${qs.toString()}`

  const res = await fetch(url, {
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

  // 2. Query User Asset Details (/sapi/v3/asset/getUserAsset - includes Alpha & Web3 tokens)
  try {
    const userAssets = await signedPost('/sapi/v3/asset/getUserAsset', {}, creds)
    if (Array.isArray(userAssets)) {
      for (const u of userAssets) {
        const free = parseFloat(u.free) || 0
        const locked = (parseFloat(u.locked) || 0) + (parseFloat(u.freeze) || 0) + (parseFloat(u.withdrawing) || 0)
        if (free + locked > 0) {
          const current = assetMap.get(u.asset) || { free: 0, locked: 0 }
          assetMap.set(u.asset, {
            free: Math.max(current.free, free),
            locked: Math.max(current.locked, locked),
          })
        }
      }
    }
  } catch {
    // Silently ignore if API key lacks user asset permissions
  }

  // 3. Also query Funding Wallet (where P2P crypto deposits land)
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

  // 4. Also query Simple Earn Flexible positions (where yield-earning assets live)
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

  // 5. Query USDT-M Futures Balances (/fapi/v2/balance)
  try {
    const fapiData = await signedGet('/fapi/v2/balance', {}, creds)
    if (Array.isArray(fapiData)) {
      for (const f of fapiData) {
        const bal = parseFloat(f.balance) || parseFloat(f.crossWalletBalance) || 0
        if (bal > 0) {
          const key = f.asset === 'USDT' ? 'FUTURES_USDT' : `FUTURES_${f.asset}`
          assetMap.set(key, { free: bal, locked: 0 })
        }
      }
    }
  } catch {
    // Silently ignore if API key lacks Futures permissions or futures account is uninitialized
  }

  // 6. Query COIN-M Futures Balances (/dapi/v1/balance)
  try {
    const dapiData = await signedGet('/dapi/v1/balance', {}, creds)
    if (Array.isArray(dapiData)) {
      for (const d of dapiData) {
        const bal = parseFloat(d.balance) || parseFloat(d.crossWalletBalance) || 0
        if (bal > 0) {
          const current = assetMap.get(d.asset) || { free: 0, locked: 0 }
          assetMap.set(d.asset, {
            free: current.free + bal,
            locked: current.locked,
          })
        }
      }
    }
  } catch {
    // Silently ignore if API key lacks Futures permissions or futures account is uninitialized
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

export interface BinanceAlphaToken {
  tokenId: string
  chainId: string
  chainName: string
  contractAddress: string
  name: string
  symbol: string
  iconUrl: string
  price: number
  percentChange24h: number
  alphaId: string
}

export interface BinanceAlphaTicker {
  symbol: string
  priceChangePercent: number
  lastPrice: number
  volume: number
  quoteVolume: number
}

// ─── Fetch full list of Binance Alpha tokens with live prices (public) ──────
export async function fetchAlphaTokenList(_creds?: ApiCredentials | null): Promise<BinanceAlphaToken[]> {
  try {
    const res = await fetch('/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list')

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    
    if (data && data.success && Array.isArray(data.data)) {
      const tokens: BinanceAlphaToken[] = data.data.map((item: any) => ({
        tokenId: item.tokenId || '',
        chainId: item.chainId || '',
        chainName: item.chainName || '',
        contractAddress: item.contractAddress || '',
        name: item.name || '',
        symbol: (item.symbol || item.alphaId?.replace('ALPHA_', '') || '').toUpperCase(),
        iconUrl: item.iconUrl || '',
        price: parseFloat(item.price) || 0,
        percentChange24h: parseFloat(item.percentChange24h) || 0,
        alphaId: item.alphaId || '',
      }))
      console.log(`Fetched ${tokens.length} Alpha tokens with live prices from Binance API`)
      return tokens
    }
    
    return []
  } catch (err) {
    console.error('Failed to fetch Alpha token list:', err)
    return []
  }
}

// ─── Fetch 24h ticker for specific Alpha token by alphaId / symbol ────────
export async function fetchAlphaTicker(symbolOrAlphaId: string): Promise<BinanceAlphaTicker | null> {
  try {
    let sym = symbolOrAlphaId.toUpperCase()
    if (!sym.endsWith('USDT')) {
      sym = `${sym}USDT`
    }
    const res = await fetch(`/bapi/defi/v1/public/alpha-trade/ticker?symbol=${encodeURIComponent(sym)}`)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    
    if (data && data.success && data.data) {
      const d = data.data
      return {
        symbol: d.symbol || sym,
        priceChangePercent: parseFloat(d.priceChangePercent) || 0,
        lastPrice: parseFloat(d.lastPrice) || 0,
        volume: parseFloat(d.volume) || 0,
        quoteVolume: parseFloat(d.quoteVolume) || 0,
      }
    }
    
    return null
  } catch (err) {
    console.error(`Failed to fetch Alpha ticker for ${symbolOrAlphaId}:`, err)
    return null
  }
}
