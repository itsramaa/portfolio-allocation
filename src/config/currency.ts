// ─── Currency Configuration ───────────────────────────────────────────────────
import type { CurrencyCode, CurrencyMeta } from '../types'

/** Supported display currencies with their symbol, name, and decimal precision. */
export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: 'USD', symbol: '$',  name: 'US Dollar',          decimals: 2 },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah',  decimals: 0 },
  EUR: { code: 'EUR', symbol: '€',  name: 'Euro',               decimals: 2 },
  GBP: { code: 'GBP', symbol: '£',  name: 'British Pound',      decimals: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar',   decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥',  name: 'Japanese Yen',       decimals: 0 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar',  decimals: 2 },
}

/**
 * Offline/fallback FX rates relative to USD.
 * Used when live API calls fail or the cache is empty.
 */
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  IDR: 15850,
  EUR: 0.92,
  GBP: 0.78,
  SGD: 1.34,
  JPY: 152.5,
  AUD: 1.52,
}

/** Default currency shown before the user changes the preference. */
export const DEFAULT_CURRENCY: CurrencyCode = 'USD'

/** localStorage keys for persisting currency selection and cached rates. */
export const CURRENCY_STORAGE_KEYS = {
  selected: 'binance_selected_currency',
  rates: 'binance_fx_rates',
} as const

/**
 * Ordered list of public FX rate API endpoints (tried in order, no API key required).
 * The first successful response is used; the rest serve as fallbacks.
 */
export const FX_RATE_ENDPOINTS: readonly string[] = [
  'https://open.er-api.com/v6/latest/USD',
  'https://api.exchangerate-api.com/v4/latest/USD',
]
