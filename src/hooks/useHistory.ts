import { useMemo, useState } from 'react'
import type { PortfolioSnapshot, CurrencyCode } from '../types'
import { loadHistory, saveSnapshot, clearHistory, getWibDailyCycleKey, formatWibDateTime } from '../utils/storage'
import { convertUSDToCurrency, formatCurrencyValue } from '../utils/currency'

export function useHistory(currentTotal: number, btcPrice: number | undefined, currency: CurrencyCode, rates: Record<string, number>) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>(() => loadHistory())
  const captureSnapshot = () => { saveSnapshot({ timestamp: Date.now(), totalUSDT: currentTotal, btcPrice }); setSnapshots(loadHistory()) }
  const seedDemo = () => {
    const now = Date.now(); const dayMs = 24 * 3600 * 1000; const base = currentTotal > 0 ? currentTotal * 0.75 : 10000
    for (let i = 14; i >= 0; i--) saveSnapshot({ timestamp: now - i * dayMs, totalUSDT: Math.round(base * (1 + Math.sin(i * 0.8) * 0.08 + (14 - i) * 0.018) * 100) / 100, btcPrice: 65000 + (14 - i) * 800 + Math.sin(i) * 1500 })
    setSnapshots(loadHistory())
  }
  const clearSnapshots = () => { if (window.confirm('Clear all recorded portfolio snapshots?')) { clearHistory(); setSnapshots([]) } }
  const chartData = useMemo(() => snapshots.map(s => {
    let time = ''
    try { time = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric' }).format(new Date(s.timestamp)) }
    catch { time = new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
    return { time, cycleDate: getWibDailyCycleKey(s.timestamp), fullDate: formatWibDateTime(s.timestamp), convertedVal: convertUSDToCurrency(s.totalUSDT, currency, rates), totalUSDT: s.totalUSDT, btcPrice: s.btcPrice }
  }), [snapshots, currency, rates])
  const minVal = chartData.length ? Math.min(...chartData.map(s => s.convertedVal)) * 0.95 : 0
  const maxVal = chartData.length ? Math.max(...chartData.map(s => s.convertedVal)) * 1.05 : 100
  return { snapshots, captureSnapshot, seedDemo, clearSnapshots, chartData, minVal, maxVal, isUSD: currency === 'USD', currentTotalFormatted: formatCurrencyValue(convertUSDToCurrency(currentTotal, currency, rates), currency) }
}
