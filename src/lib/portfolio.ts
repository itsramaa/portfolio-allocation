// ─── Asset domain logic ──────────────────────────────────────────────────────
import type { Asset, InjectionResult, TargetAllocation } from '../types'
import {
  ASSET_COLORS,
  FUTURES_COLOR,
  DEFAULT_ASSET_COLOR,
  STABLECOIN_SYMBOLS,
  RESERVE_SYMBOLS,
  TRADING_BUCKETS,
  MIN_DUST_USDT,
  MIN_VISIBLE_DRIFT_USDT,
} from '../config/assets'
import {
  REBALANCE_RELATIVE,
  REBALANCE_FLOOR_PP,
  MIN_ORDER_USDT,
  MIN_DRIFT_PORTFOLIO_RATIO,
  MAX_REBALANCE_COST_RATIO,
  ESTIMATED_FEE_RATE,
  ESTIMATED_FRICTION_FLOOR_USDT,
  ESTIMATED_FIXED_FRICTION,
  MIN_DOLLAR_DRIFT,
  REBALANCE_HYSTERESIS_PP,
} from '../config/rebalance'

// Re-export config constants consumed by external modules (avoids deep config imports in UI)
export {
  STABLECOIN_SYMBOLS,
  RESERVE_SYMBOLS,
  TRADING_BUCKETS,
  REBALANCE_RELATIVE,
  REBALANCE_FLOOR_PP,
  MIN_ORDER_USDT,
  MIN_DRIFT_PORTFOLIO_RATIO,
  MAX_REBALANCE_COST_RATIO,
  ESTIMATED_FEE_RATE,
  ESTIMATED_FIXED_FRICTION,
  MIN_DOLLAR_DRIFT,
  REBALANCE_HYSTERESIS_PP,
}

export function isFuturesAsset(symbol: string): boolean {
  return symbol === 'FUTURES_USDT' || symbol.startsWith('FUTURES_')
}

export function isStablecoin(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol)
}

export function calcTotalUSDT(assets: Asset[]): number {
  return assets.reduce((sum, asset) => sum + asset.usdtValue, 0)
}

export function resolveTargetPct(symbol: string, targets: TargetAllocation): number {
  const explicit = targets[symbol] ?? 0
  if (explicit > 0) return explicit
  return targets['OTHER'] ?? 0
}

export function assetColor(symbol: string, isFutures = false): string {
  if (isFutures || isFuturesAsset(symbol)) return FUTURES_COLOR
  return ASSET_COLORS[symbol] ?? DEFAULT_ASSET_COLOR
}

// ─── Rebalance Band ─────────────────────────────────────────────────────────
// Three asset categories with different trigger rules:
//
// 1. CORE (BTC, ETH, SOL, PAXG …)
//    Trigger = max(25% × target, 3pp) AND dollar_drift ≥ $25
//
// 2. RESERVE (USDT, USDC …)
//    Soft target: overweight = OK (it's idle cash). Underweight = soft note only, never hard-trigger.
//
// 3. TRADING_BUCKET (FUTURES_USDT)
//    No auto-trigger. Show transfer guidance only.

export function calcRebalanceBand(targetPct: number, symbol: string): number {
  if (TRADING_BUCKETS.has(symbol) || RESERVE_SYMBOLS.has(symbol) || targetPct === 0) return 0
  return Math.max(REBALANCE_RELATIVE * targetPct, REBALANCE_FLOOR_PP)
}

export function recalculateAssetTargets(assets: Asset[], targets: TargetAllocation): Asset[] {
  const total = calcTotalUSDT(assets)
  return assets.map(a => {
    const currentPct = total > 0 ? (a.usdtValue / total) * 100 : 0
    const targetPct = resolveTargetPct(a.symbol, targets)
    return {
      ...a,
      currentPct,
      targetPct,
      drift: currentPct - targetPct,
      rebalanceBand: calcRebalanceBand(targetPct, a.symbol),
    }
  })
}

// build the asset list from raw balances + prices + target config
export function buildAssets(
  balances: Array<{ asset: string; free: string; locked: string }>,
  prices: Record<string, number>,
  targets: TargetAllocation
): Asset[] {
  const assets: Asset[] = []

  for (const b of balances) {
    const sym = b.asset.toUpperCase()
    const amount = parseFloat(b.free) + parseFloat(b.locked)
    if (amount <= 0) continue

    const isFutures = isFuturesAsset(sym)

    // get USDT price
    let price = 1
    if (isStablecoin(sym)) {
      price = 1
    } else if (prices[sym]) {
      price = prices[sym]
    } else if (prices[`${sym}USDT`]) {
      price = prices[`${sym}USDT`]
    } else if (prices[`${sym}FDUSD`]) {
      price = prices[`${sym}FDUSD`]
    } else if (prices[`${sym}USDC`]) {
      price = prices[`${sym}USDC`]
    } else if (prices[`${sym}BTC`] && prices['BTCUSDT']) {
      price = prices[`${sym}BTC`] * prices['BTCUSDT']
    } else if (prices[`${sym}ETH`] && prices['ETHUSDT']) {
      price = prices[`${sym}ETH`] * prices['ETHUSDT']
    } else if (prices[`${sym}BUSD`]) {
      price = prices[`${sym}BUSD`]
    } else {
      continue // can't price this asset, skip
    }

    const usdtValue = amount * price
    if (usdtValue < MIN_DUST_USDT) continue

    const targetPct = targets[sym] ?? 0

    assets.push({
      symbol: sym,
      quoteSymbol: sym === 'USDT' || sym === 'FUTURES_USDT' ? 'USDTUSDT' : `${sym}USDT`,
      amount,
      usdtValue,
      price,
      currentPct: 0,      // filled below
      targetPct,
      drift: 0,           // filled below
      rebalanceBand: 0,   // filled below
      logoColor: assetColor(sym, isFutures),
      isFutures,
    })
  }

  // sort by value desc
  assets.sort((a, b) => b.usdtValue - a.usdtValue)

  return recalculateAssetTargets(assets, targets)
}

// cash injection calculator
// algorithm: for each asset with a shortfall (currentPct < targetPct),
// calculate how much of the injection to allocate proportionally to close gaps
export function calculateInjection(
  assets: Asset[],
  injectionUSDT: number,
  targets: TargetAllocation
): InjectionResult[] {
  if (injectionUSDT <= 0 || assets.length === 0) return []

  const totalCurrent = calcTotalUSDT(assets)
  const totalAfter = totalCurrent + injectionUSDT

  // compute shortfall per asset (in USDT terms after injection)
  const shortfalls: Array<{ symbol: string; shortfall: number }> = []
  let totalShortfall = 0

  for (const [sym, targetPct] of Object.entries(targets)) {
    if (targetPct <= 0) continue
    const asset = assets.find(a => a.symbol === sym)
    const currentValue = asset?.usdtValue ?? 0
    const targetValue = (targetPct / 100) * totalAfter
    const shortfall = Math.max(0, targetValue - currentValue)
    if (shortfall > 0) {
      shortfalls.push({ symbol: sym, shortfall })
      totalShortfall += shortfall
    }
  }

  if (totalShortfall === 0) return []

  // distribute injection proportionally to shortfalls, capped by injection total
  const results: InjectionResult[] = []
  const scale = Math.min(1, injectionUSDT / totalShortfall)

  for (const { symbol, shortfall } of shortfalls) {
    const buyUSDT = shortfall * scale
    if (buyUSDT < 0.01) continue
    const asset = assets.find(a => a.symbol === symbol)
    const currentValue = asset?.usdtValue ?? 0
    const newValue = currentValue + buyUSDT
    const newWeight = (newValue / totalAfter) * 100
    const gapClosed = Math.min(100, ((buyUSDT / Math.max(0.01, shortfall)) * 100))

    results.push({
      symbol,
      buyUSDT,
      buyPct: injectionUSDT > 0 ? (buyUSDT / injectionUSDT) * 100 : 0,
      newWeight,
      gapClosed,
    })
  }

  return results.sort((a, b) => b.buyUSDT - a.buyUSDT)
}

// ─── Adaptive Dynamic Rebalance Triggers ─────────────────────────────────────
// Gate 1 (Allocation Band): |drift_pp| >= max(25% × target, 3pp)
// Gate 2 (Economic Scale):  dollar_drift >= 0.5% × total_portfolio
// Gate 3 (Transaction Cost Guard): estimated_cost <= 1% of trade_value AND trade_value >= $5 (Binance min order)

export function calcEstimatedTradeCost(tradeValue: number, feeRate = ESTIMATED_FEE_RATE): number {
  if (tradeValue <= 0) return 0
  return Math.max(tradeValue * feeRate, ESTIMATED_FRICTION_FLOOR_USDT)
}

export type AssetCategory = 'core' | 'reserve' | 'trading'

export interface RebalanceGateStatus {
  gate1Band: boolean          // |drift_pp| >= allocation_band
  gate2Economic: boolean      // drift_value >= 0.5% * total_portfolio
  gate3Executable: boolean    // trade_value >= MIN_ORDER_USDT ($5 Binance min order)
  gate3Cost: boolean          // estimated_cost <= 1% of trade_value
  isTriggered: boolean        // all gates passed (core only)
  band: number
  driftValueUSDT: number      // |current_value - target_value|
  tradeValueUSDT: number      // amount actually needed to execute toward target
  minDriftUSDT: number        // 0.5% of total portfolio
  minOrderUSDT: number        // $5
  estimatedCostUSDT: number
  costRatio: number
}

export function evaluateRebalanceGates(
  driftPp: number,
  band: number,
  driftValueUSDT: number,
  tradeValueUSDT: number,
  totalPortfolioUSDT: number,
  category: AssetCategory = 'core',
  feeRate = ESTIMATED_FEE_RATE
): RebalanceGateStatus {
  const minDriftUSDT = totalPortfolioUSDT * MIN_DRIFT_PORTFOLIO_RATIO
  const estimatedCostUSDT = calcEstimatedTradeCost(tradeValueUSDT, feeRate)
  const costRatio = tradeValueUSDT > 0 ? (estimatedCostUSDT / tradeValueUSDT) : 1

  // Gate 1: Allocation band breached
  const gate1Band = band > 0 && driftPp >= band

  // Gate 2: Economic significance (drift value vs portfolio size)
  const gate2Economic = totalPortfolioUSDT > 0 && driftValueUSDT >= minDriftUSDT

  // Gate 3: Executable on exchange & economically viable
  const gate3Executable = tradeValueUSDT >= MIN_ORDER_USDT
  const gate3Cost = costRatio <= MAX_REBALANCE_COST_RATIO

  const isTriggered = category === 'core' && gate1Band && gate2Economic && gate3Executable && gate3Cost

  return {
    gate1Band,
    gate2Economic,
    gate3Executable,
    gate3Cost,
    isTriggered,
    band,
    driftValueUSDT,
    tradeValueUSDT,
    minDriftUSDT,
    minOrderUSDT: MIN_ORDER_USDT,
    estimatedCostUSDT,
    costRatio,
  }
}

export interface RebalanceItem {
  symbol: string
  action: 'sell' | 'buy'
  amountUSDT: number
  currentPct: number
  targetPct: number
  newPct: number
  category: AssetCategory
  belowMinOrder: boolean  // true if amountUSDT < MIN_ORDER_USDT
  isTriggered: boolean    // true only for core assets that pass all 3 gates
  gateStatus?: RebalanceGateStatus
}

// full rebalance calculator (sell + buy)
// Three-category logic:
//   Core  → two-gate trigger (band% AND dollar_drift >= MIN_DOLLAR_DRIFT)
//   Reserve (USDT …) → show only if underweight; overweight = skip (it's idle cash, not a problem)
//   Trading (FUTURES) → show transfer guidance, never triggered
export function calculateRebalance(
  assets: Asset[],
  targets: TargetAllocation
): RebalanceItem[] {
  if (assets.length === 0 && Object.keys(targets).length === 0) return []

  const totalUSDT = calcTotalUSDT(assets)
  if (totalUSDT <= 0) return []

  // Gather all unique symbols from held assets + configured targets (excluding 'OTHER')
  const symbolSet = new Set<string>()
  for (const a of assets) symbolSet.add(a.symbol)
  for (const sym of Object.keys(targets)) {
    if (sym !== 'OTHER') symbolSet.add(sym)
  }

  const results: RebalanceItem[] = []

  for (const sym of symbolSet) {
    const asset = assets.find(a => a.symbol === sym)
    const currentValue = asset ? asset.usdtValue : 0
    const currentPct = totalUSDT > 0 ? (currentValue / totalUSDT) * 100 : 0

    let targetPct = 0
    if (sym in targets) {
      targetPct = targets[sym]
    } else if (asset) {
      targetPct = asset.targetPct
    }

    const targetValue = (targetPct / 100) * totalUSDT
    const diff = currentValue - targetValue

    // ─── Category: Trading bucket (Futures) ────────────────────────────────
    if (TRADING_BUCKETS.has(sym)) {
      if (Math.abs(diff) < MIN_VISIBLE_DRIFT_USDT) continue
      const amountUSDT = Math.abs(diff)
      results.push({
        symbol: sym, category: 'trading',
        action: diff > 0 ? 'sell' : 'buy',
        amountUSDT, currentPct, targetPct, newPct: targetPct,
        belowMinOrder: amountUSDT < MIN_ORDER_USDT,
        isTriggered: false, // trading bucket: manual decision only
      })
      continue
    }

    // ─── Category: Reserve (USDT, USDC …) ────────────────────────────────
    if (RESERVE_SYMBOLS.has(sym)) {
      // Overweight reserve = fine, it's idle cash waiting to be deployed. Skip.
      if (diff >= 0) continue
      // Underweight reserve = soft note (not hard-triggered, just informational)
      const amountUSDT = Math.abs(diff)
      if (amountUSDT < MIN_VISIBLE_DRIFT_USDT) continue
      results.push({
        symbol: sym, category: 'reserve',
        action: 'buy', // replenish reserve
        amountUSDT, currentPct, targetPct, newPct: targetPct,
        belowMinOrder: amountUSDT < MIN_ORDER_USDT,
        isTriggered: false, // reserve: never hard-triggered
      })
      continue
    }

    // ─── Category: Core asset ───────────────────────────────────────────
    if (Math.abs(diff) < MIN_VISIBLE_DRIFT_USDT) continue

    const driftValueUSDT = Math.abs(currentValue - targetValue)
    const tradeValueUSDT = Math.abs(diff) // amount actually needed to execute toward target
    const belowMinOrder = tradeValueUSDT < MIN_ORDER_USDT
    const driftPp = Math.abs(currentPct - targetPct)
    const band = calcRebalanceBand(targetPct, sym)

    // Three-gate trigger:
    //   Gate 1: |drift_pp| ≥ band  (max(25% × target, 3pp))
    //   Gate 2: drift_value ≥ 0.5% × portfolio value (economic significance)
    //   Gate 3: trade_value ≥ $5 (executable) AND estimated_cost ≤ 1% of trade_value
    const gateStatus = evaluateRebalanceGates(driftPp, band, driftValueUSDT, tradeValueUSDT, totalUSDT, 'core')

    results.push({
      symbol: sym, category: 'core',
      action: diff > 0 ? 'sell' : 'buy',
      amountUSDT: tradeValueUSDT,
      currentPct, targetPct, newPct: targetPct,
      belowMinOrder,
      isTriggered: gateStatus.isTriggered,
      gateStatus,
    })
  }

  // Sort: triggered core first → other core → trading → reserve → below-min
  return results.sort((a, b) => {
    const tier = (r: RebalanceItem) => {
      if (r.belowMinOrder)  return 4
      if (r.isTriggered)    return 0
      if (r.category === 'core')    return 1
      if (r.category === 'trading') return 2
      return 3 // reserve
    }
    const ta = tier(a), tb = tier(b)
    if (ta !== tb) return ta - tb
    return b.amountUSDT - a.amountUSDT
  })
}

// format USDT value
export function fmtUSDT(value: number, decimals = 2): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(decimals)}`
}

// format percentage with sign
export function fmtPct(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

// format crypto amount (smart decimals)
export function fmtAmount(amount: number): string {
  if (amount >= 1000) return amount.toFixed(2)
  if (amount >= 1) return amount.toFixed(4)
  return amount.toFixed(6)
}
