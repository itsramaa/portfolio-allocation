import { useMemo, useState } from 'react'
import type { Asset, TargetAllocation } from '../types'
import { calculateRebalance } from '../services/api'
import type { RebalanceResultResponse } from '../services/api'
import { MIN_ORDER_USDT, REBALANCE_FLOOR_PP, resolveTargetPct, isFuturesAsset } from '../lib/portfolio'

export function useRebalance(assets: Asset[], targets: TargetAllocation) {
  const [confirmed, setConfirmed] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rebalanceResult, setRebalanceResult] = useState<RebalanceResultResponse | null>(null)
  const totalUSDT = useMemo(() => assets.reduce((sum, asset) => sum + asset.usdtValue, 0), [assets])
  const spotRebalanceUSDT = useMemo(() => assets.filter(asset => !isFuturesAsset(asset.symbol)).reduce((sum, asset) => sum + asset.usdtValue, 0), [assets])
  const futuresUnderTarget = useMemo(() => assets.filter(asset => isFuturesAsset(asset.symbol) && asset.targetPct > 0 && asset.usdtValue < (asset.targetPct / 100) * totalUSDT), [assets, totalUSDT])
  const hasTargets = Object.values(targets).some(value => value > 0)
  const targetSum = Object.values(targets).reduce((sum, value) => sum + value, 0)
  const actionable = useMemo(() => rebalanceResult?.orders?.filter(order => order.amountUSDT >= MIN_ORDER_USDT) ?? [], [rebalanceResult])
  const skipped = useMemo(() => rebalanceResult?.orders?.filter(order => order.amountUSDT < MIN_ORDER_USDT) ?? [], [rebalanceResult])
  const triggered = useMemo(() => actionable.filter(order => order.isTriggered === true), [actionable])
  const sellTotal = useMemo(() => actionable.filter(order => order.action === 'SELL').reduce((sum, order) => sum + order.amountUSDT, 0), [actionable])
  const buyTotal = useMemo(() => actionable.filter(order => order.action === 'BUY').reduce((sum, order) => sum + order.amountUSDT, 0), [actionable])

  const calculate = async () => {
    if (Math.abs(targetSum - 100) > 0.5) {
      setError('Target allocations must total 100% before calculating.')
      setConfirmed(true)
      return
    }
    setCalculating(true)
    setError(null)
    try {
      const backendAssets = assets.map(a => {
        const targetPct = resolveTargetPct(a.symbol, targets)
        const targetValue = (targetPct / 100) * totalUSDT
        const diff = targetValue - a.usdtValue
        const diffPct = targetPct - a.currentPct
        return {
          symbol: a.symbol, name: a.symbol, amount: a.amount, price: a.price, value: a.usdtValue,
          currentPct: a.currentPct, targetPct, targetValue, diff, diffPct,
          action: (diff > 0 ? 'BUY' : diff < 0 ? 'SELL' : 'HOLD') as 'BUY' | 'SELL' | 'HOLD',
          drift: a.currentPct - targetPct,
        }
      })
      const response = await calculateRebalance(backendAssets, MIN_ORDER_USDT, REBALANCE_FLOOR_PP)
      if (!response) {
        setRebalanceResult(null)
        setError('Unable to calculate the rebalance plan. Please try again.')
        return
      }
      setRebalanceResult({
        ...response,
        // The API also exposes a relative drift field. Keep this UI field in percentage points.
        orders: response.orders.map(order => ({ ...order, driftPct: Math.abs(order.diffPct) })),
      })
    } catch (err) {
      setRebalanceResult(null)
      setError(err instanceof Error ? err.message : 'Unable to calculate the rebalance plan.')
    } finally {
      setConfirmed(true)
      setCalculating(false)
    }
  }
  return { confirmed, setConfirmed, showSkipped, setShowSkipped, calculating, error, rebalanceResult, setRebalanceResult, totalUSDT, spotRebalanceUSDT, futuresUnderTarget, hasTargets, targetSum, actionable, skipped, triggered, sellTotal, buyTotal, calculate }
}
