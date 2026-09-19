import type { Asset, InjectionResult, TargetAllocation } from './types'

// deterministic color per ticker (for chart / icon)
const ASSET_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', BNB: '#F0B90B', SOL: '#9945FF',
  USDT: '#26A17B', USDC: '#2775CA', XRP: '#00AAE4', ADA: '#0033AD',
  DOGE: '#C2A633', AVAX: '#E84142', DOT: '#E6007A', LINK: '#375BD2',
  MATIC: '#8247E5', LTC: '#BFBBBB', ATOM: '#2E3148', UNI: '#FF007A',
  NEAR: '#00C08B', APT: '#00BFA5', ARB: '#28A0F0', OP: '#FF0420',
  FDUSD: '#00B8D9',
}

export function assetColor(symbol: string, isFutures = false): string {
  if (isFutures || symbol.startsWith('FUTURES')) return '#02C076' // Vibrant green for Futures assets
  return ASSET_COLORS[symbol] ?? '#848E9C'
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

export const REBALANCE_RELATIVE = 0.25   // 25% of target pct
export const REBALANCE_FLOOR_PP = 3      // minimum 3 percentage-points

// Reserve assets: hold excess is fine; only flag if underweight (and never hard-trigger)
export const RESERVE_SYMBOLS = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'DAI'])

// Trading/margin buckets: show transfer guidance, never auto-trigger
export const TRADING_BUCKETS = new Set(['FUTURES_USDT'])

export function calcRebalanceBand(targetPct: number, symbol: string): number {
  if (TRADING_BUCKETS.has(symbol) || RESERVE_SYMBOLS.has(symbol) || targetPct === 0) return 0
  return Math.max(REBALANCE_RELATIVE * targetPct, REBALANCE_FLOOR_PP)
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

    const isFutures = sym === 'FUTURES_USDT' || sym.startsWith('FUTURES_')

    // get USDT price
    let price = 1
    const STABLES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'DAI', 'USDS', 'USDP', 'FUTURES_USDT']
    if (STABLES.includes(sym)) {
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
    if (usdtValue < 0.05) continue // skip dust < $0.05 (5 cents)

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

  const total = assets.reduce((s, a) => s + a.usdtValue, 0)
  const otherTargetPct = targets['OTHER'] ?? 0
  
  for (const a of assets) {
    a.currentPct = total > 0 ? (a.usdtValue / total) * 100 : 0
    
    // If asset has no specific target, use OTHER allocation
    if (a.targetPct === 0 && otherTargetPct > 0) {
      a.targetPct = otherTargetPct
    }
    
    a.drift = a.currentPct - a.targetPct
    a.rebalanceBand = calcRebalanceBand(a.targetPct, a.symbol)
  }

  return assets
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

  const totalCurrent = assets.reduce((s, a) => s + a.usdtValue, 0)
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

// Binance minimum order value (notional) — orders below this cannot be executed
export const MIN_ORDER_USDT = 5

// ─── Adaptive Dynamic Rebalance Triggers ─────────────────────────────────────
// Gate 1 (Allocation Band): |drift_pp| >= max(25% × target, 3pp)
// Gate 2 (Economic Scale):  dollar_drift >= 0.5% × total_portfolio
// Gate 3 (Transaction Cost Guard): estimated_cost <= 1% of trade_value AND trade_value >= $5 (Binance min order)
export const MIN_DRIFT_PORTFOLIO_RATIO = 0.005 // 0.5% of total portfolio value
export const MAX_REBALANCE_COST_RATIO = 0.01   // max 1% of trade value
export const ESTIMATED_FEE_RATE = 0.001        // 0.1% Binance spot baseline maker/taker fee
// Internal model for market friction (bid/ask spread allowance + micro-slippage + lot rounding floor)
// Note: This is NOT an exchange fee, but an execution safety floor model.
export const ESTIMATED_FRICTION_FLOOR_USDT = 0.05 // ~$0.05 (Rp ~750) internal friction floor
export const ESTIMATED_FIXED_FRICTION = ESTIMATED_FRICTION_FLOOR_USDT // backward-compat alias
export const MIN_DOLLAR_DRIFT = 25             // legacy alias / fallback

// Hysteresis deadband buffer to prevent border flip-flop oscillation (e.g. 37.49% vs 37.51%)
export const REBALANCE_HYSTERESIS_PP = 0.5     // 0.5pp cooldown buffer after rebalance

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

  const totalUSDT = assets.reduce((s, a) => s + a.usdtValue, 0)
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
      if (Math.abs(diff) < 0.50) continue
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
      if (amountUSDT < 0.50) continue
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
    if (Math.abs(diff) < 0.50) continue

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
