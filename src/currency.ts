// ─── Currency & Exchange Rate Utilities ────────────────────────────────────────
import type { CurrencyCode, FxRates } from './types'

export interface CurrencyMeta {
  code: CurrencyCode
  symbol: string
  name: string
  decimals: number
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', decimals: 0 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
}

export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  IDR: 15850,
  EUR: 0.92,
  GBP: 0.78,
  SGD: 1.34,
  JPY: 152.5,
  AUD: 1.52,
}

const STORAGE_KEY_CURRENCY = 'binance_selected_currency'
const STORAGE_KEY_RATES = 'binance_fx_rates'

export function loadSelectedCurrency(): CurrencyCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENCY)
    if (saved && saved in CURRENCIES) {
      return saved as CurrencyCode
    }
  } catch { /* skip */ }
  return 'USD'
}

export function saveSelectedCurrency(code: CurrencyCode): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENCY, code)
  } catch { /* skip */ }
}

export function loadCachedRates(): FxRates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATES)
    if (raw) {
      const parsed = JSON.parse(raw) as FxRates
      if (parsed && parsed.rates) return parsed
    }
  } catch { /* skip */ }

  return {
    base: 'USD',
    rates: FALLBACK_RATES,
    lastUpdated: Date.now(),
  }
}

export async function fetchLiveFxRates(): Promise<FxRates> {
  // Free public API without API keys
  const endpoints = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate-api.com/v4/latest/USD',
  ]

  for (const url of endpoints) {
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
        localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(result))
        return result
      }
    } catch {
      // try fallback endpoint
    }
  }

  // If both fail, return cached or fallback
  return loadCachedRates()
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
