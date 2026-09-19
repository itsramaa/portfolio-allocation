import { useState, useEffect } from 'react'
import type { CurrencyCode, FxRates } from '../types'
import { loadSelectedCurrency, saveSelectedCurrency, loadCachedRates } from '../utils/currency'
import { fetchFXRatesFromServer } from '../services/api'

export function useCurrencyRates() {
  const [currency, setCurrency] = useState<CurrencyCode>(() => loadSelectedCurrency())
  const [fxRates, setFxRates] = useState<FxRates>(() => loadCachedRates())

  // Fetch live rates from backend on startup
  useEffect(() => {
    fetchFXRatesFromServer().then(rates => {
      if (rates) setFxRates(rates)
    }).catch(() => {})
  }, [])

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    setCurrency(newCurrency)
    saveSelectedCurrency(newCurrency)
  }

  const handleRefreshRates = async () => {
    const updated = await fetchFXRatesFromServer()
    if (updated) setFxRates(updated)
  }

  return {
    currency,
    fxRates,
    handleCurrencyChange,
    handleRefreshRates,
  }
}
