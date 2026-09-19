// ─── Currency & Exchange Rate Utilities (SQLite-backed) ──────────────────────
import type { CurrencyCode, CurrencyMeta, FxRates } from '../types'
import {
  CURRENCIES,
  FALLBACK_RATES,
  DEFAULT_CURRENCY,
  FX_RATE_ENDPOINTS,
} from '../config/currency'
import {
  getSetting,
  setSetting,
  fetchFXCacheFromDB,
  saveFXCacheToDB,
} from '../services/api'

// Re-export type so existing imports of CurrencyMeta from this file keep working
export type { CurrencyMeta }

// Re-export so consumers that imported directly from this file continue to work
export { CURRENCIES, FALLBACK_RATES }

let cachedCurrency: CurrencyCode = DEFAULT_CURRENCY
let cachedRatesData: FxRates = {
  base: 'USD',
  rates: FALLBACK_RATES,
  lastUpdated: Date.now(),
}

/**
 * Initializes currency preferences and cached FX rates from SQLite.
 */
export async function initCurrencyFromBackend(): Promise<void> {
  try {
    const [savedCurrency, savedFx] = await Promise.all([
      getSetting<string>('currency'),
      fetchFXCacheFromDB(),
    ])

    if (savedCurrency && savedCurrency in CURRENCIES) {
      cachedCurrency = savedCurrency as CurrencyCode
    } else {
      const legacy = localStorage.getItem('portfolio_currency')
      if (legacy && legacy in CURRENCIES) {
        cachedCurrency = legacy as CurrencyCode
        void setSetting('currency', legacy)
        localStorage.removeItem('portfolio_currency')
      }
    }

    if (savedFx && savedFx.rates && Object.keys(savedFx.rates).length > 0) {
      cachedRatesData = savedFx
    } else {
      const legacyRates = localStorage.getItem('portfolio_fx_rates')
      if (legacyRates) {
        try {
          const parsed = JSON.parse(legacyRates) as FxRates
          if (parsed?.rates) {
            cachedRatesData = parsed
            void saveFXCacheToDB(parsed)
            localStorage.removeItem('portfolio_fx_rates')
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    console.warn('Failed to initialize currency from SQLite:', err)
  }
}

export function loadSelectedCurrency(): CurrencyCode {
  return cachedCurrency
}

export function saveSelectedCurrency(code: CurrencyCode): void {
  cachedCurrency = code
  void setSetting('currency', code)
}

export function loadCachedRates(): FxRates {
  return cachedRatesData
}

export async function fetchLiveFxRates(): Promise<FxRates> {
  for (const url of FX_RATE_ENDPOINTS) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const rates = { ...FALLBACK_RATES, ...(data.rates || {}) }
        const result: FxRates = {
          base: 'USD',
          rates,
          lastUpdated: Date.now(),
        }
        cachedRatesData = result
        void saveFXCacheToDB(result)
        return result
      }
    } catch {
      // try next endpoint
    }
  }

  // If endpoints fail, return current cached
  return cachedRatesData
}

export function convertUSDToCurrency(usdAmount: number, target: CurrencyCode, rates: Record<string, number>): number {
  if (target === 'USD') return usdAmount
  const rate = rates[target] ?? FALLBACK_RATES[target] ?? 1
  return usdAmount * rate
}

export function convertCurrencyToUSD(amount: number, from: CurrencyCode, rates: Record<string, number>): number {
  if (from === 'USD') return amount
  const rate = rates[from] ?? FALLBACK_RATES[from] ?? 1
  if (rate <= 0) return amount
  return amount / rate
}

export function formatCurrencyValue(
  amountInCurrency: number,
  currency: CurrencyCode
): string {
  const meta = CURRENCIES[currency] || CURRENCIES.USD
  if (currency === 'IDR') {
    return `Rp ${Math.round(amountInCurrency).toLocaleString('id-ID')}`
  }
  if (currency === 'JPY') {
    return `¥${Math.round(amountInCurrency).toLocaleString('ja-JP')}`
  }
  return `${meta.symbol}${amountInCurrency.toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  })}`
}

export function formatUSDWithConverted(
  usdAmount: number,
  currency: CurrencyCode,
  rates: Record<string, number>
): { usdFormatted: string; convertedFormatted: string | null } {
  const usdFormatted = `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (currency === 'USD') {
    return { usdFormatted, convertedFormatted: null }
  }
  const converted = convertUSDToCurrency(usdAmount, currency, rates)
  return {
    usdFormatted,
    convertedFormatted: formatCurrencyValue(converted, currency),
  }
}
