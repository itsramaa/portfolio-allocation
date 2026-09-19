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
      currentPct: 0, // filled below
      targetPct,
      drift: 0,       // filled below
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

export interface RebalanceItem {
  symbol: string
  action: 'sell' | 'buy'
  amountUSDT: number
  currentPct: number
  targetPct: number
  newPct: number
  belowMinOrder: boolean // true if amountUSDT < MIN_ORDER_USDT
}

// full rebalance calculator (sell + buy)
// algorithm: sell overweight assets & zero-target held assets, buy underweight & unheld target assets to reach target allocation
// Items below MIN_ORDER_USDT are included but flagged as belowMinOrder = true
export function calculateRebalance(
  assets: Asset[],
  targets: TargetAllocation
): RebalanceItem[] {
  if (assets.length === 0 && Object.keys(targets).length === 0) return []

  const totalUSDT = assets.reduce((s, a) => s + a.usdtValue, 0)
  if (totalUSDT <= 0) return []

  // Gather all unique symbols from both current held assets and configured targets (excluding 'OTHER')
  const symbolSet = new Set<string>()
  for (const a of assets) {
    symbolSet.add(a.symbol)
  }
  for (const sym of Object.keys(targets)) {
    if (sym !== 'OTHER') {
      symbolSet.add(sym)
    }
  }

  const results: RebalanceItem[] = []

  for (const sym of symbolSet) {
    const asset = assets.find(a => a.symbol === sym)
    const currentValue = asset ? asset.usdtValue : 0
    const currentPct = totalUSDT > 0 ? (currentValue / totalUSDT) * 100 : 0

    // Determine target percentage:
    // 1. Explicitly configured target in targets dict
    // 2. Or fallback targetPct attached to held asset (e.g. from OTHER allocation)
    // 3. Otherwise 0 (meaning sell 100% of held asset if not targeted)
    let targetPct = 0
    if (sym in targets) {
      targetPct = targets[sym]
    } else if (asset) {
      targetPct = asset.targetPct
    }

    const targetValue = (targetPct / 100) * totalUSDT
    const diff = currentValue - targetValue

    if (Math.abs(diff) < 0.50) continue // Skip truly negligible dust (< $0.50)

    const amountUSDT = Math.abs(diff)
    const belowMinOrder = amountUSDT < MIN_ORDER_USDT

    if (diff > 0) {
      // Overweight or un-allocated asset -> Sell
      results.push({ symbol: sym, action: 'sell', amountUSDT, currentPct, targetPct, newPct: targetPct, belowMinOrder })
    } else {
      // Underweight or new target asset -> Buy
      results.push({ symbol: sym, action: 'buy', amountUSDT, currentPct, targetPct, newPct: targetPct, belowMinOrder })
    }
  }

  // Sort: actionable first (≥ min order), then skipped — within each group sort by amount desc
  return results.sort((a, b) => {
    if (a.belowMinOrder !== b.belowMinOrder) return a.belowMinOrder ? 1 : -1
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
