import type { Asset, InjectionResult, TargetAllocation, AlphaAssetConfig } from './types'

// deterministic color per ticker (for chart / icon)
const ASSET_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', BNB: '#F0B90B', SOL: '#9945FF',
  USDT: '#26A17B', USDC: '#2775CA', XRP: '#00AAE4', ADA: '#0033AD',
  DOGE: '#C2A633', AVAX: '#E84142', DOT: '#E6007A', LINK: '#375BD2',
  MATIC: '#8247E5', LTC: '#BFBBBB', ATOM: '#2E3148', UNI: '#FF007A',
  NEAR: '#00C08B', APT: '#00BFA5', ARB: '#28A0F0', OP: '#FF0420',
  FDUSD: '#00B8D9',
}

// ── Binance Alpha token symbols (fetched from API, with fallback) ─────────────
// This set is populated dynamically from the Binance Alpha API.
// Falls back to hardcoded list if API fails.
let KNOWN_ALPHA_SYMBOLS = new Set<string>()

// Fallback hardcoded list for when API is unavailable
const FALLBACK_ALPHA_SYMBOLS = new Set([
  'GRASS', 'VIRTUAL', 'AIXBT', 'FARTCOIN', 'COOKIE', 'GRIFFAIN',
  'SWARMS', 'LUCE', 'ONDO', 'ACT', 'GOAT', 'MOODENG', 'PNUT',
  'NEIRO', 'TURBO', 'HMSTR', 'CATI', 'DOGS', 'MAJOR', 'BLUM',
  'BSPIN', 'MEMESAI', 'BANANA', 'KOMA', 'SUNDOG', 'SUNCAT',
  'PONS', 'MONAD', 'STORYPROTOCOL', 'STORY', 'INITIA', 'INIT',
  'MEGAETH', 'MOVEMENT', 'MOVE', 'BERACHAIN', 'BERA',
  'HYPERLIQUID', 'HYPE', 'KAITO', 'JUPITER', 'JUP',
  'DEGEN', 'HIGHER', 'MOCHI', 'TOSHI', 'BRETT',
])

// Initialize with fallback
KNOWN_ALPHA_SYMBOLS = new Set(FALLBACK_ALPHA_SYMBOLS)

// Update Alpha symbols from API
export function updateAlphaSymbols(symbols: Set<string>) {
  KNOWN_ALPHA_SYMBOLS = symbols.size > 0 ? symbols : new Set(FALLBACK_ALPHA_SYMBOLS)
}

export function getAlphaSymbols(): Set<string> {
  return KNOWN_ALPHA_SYMBOLS
}

export function assetColor(symbol: string, isAlpha = false): string {
  if (isAlpha) return '#A855F7' // Vibrant purple for Binance Alpha tokens
  return ASSET_COLORS[symbol] ?? '#848E9C'
}

// build the asset list from raw balances + prices + target config + Binance Alpha assets
export function buildAssets(
  balances: Array<{ asset: string; free: string; locked: string }>,
  prices: Record<string, number>,
  targets: TargetAllocation,
  alphaConfigs: AlphaAssetConfig[] = []
): Asset[] {
  const assets: Asset[] = []
  const alphaMap = new Map<string, AlphaAssetConfig>()
  for (const cfg of alphaConfigs) {
    alphaMap.set(cfg.symbol.toUpperCase(), cfg)
  }

  const processedSymbols = new Set<string>()

  for (const b of balances) {
    const sym = b.asset.toUpperCase()
    processedSymbols.add(sym)
    const amount = parseFloat(b.free) + parseFloat(b.locked)
    if (amount <= 0) continue

    // Auto-detect Alpha: either manually configured OR known from Binance Alpha list
    const isAlpha = alphaMap.has(sym) || getAlphaSymbols().has(sym)

    // get USDT price
    let price = 1
    const STABLES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'DAI', 'USDS', 'USDP']
    if (STABLES.includes(sym)) {
      price = 1
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
    } else if (isAlpha && alphaMap.get(sym)?.priceUSDT) {
      price = alphaMap.get(sym)!.priceUSDT
    } else {
      continue // can't price this asset, skip
    }

    const usdtValue = amount * price
    if (usdtValue < 0.05) continue // skip dust < $0.05 (5 cents)

    const targetPct = targets[sym] ?? (isAlpha ? alphaMap.get(sym)?.targetPct ?? 0 : 0)

    assets.push({
      symbol: sym,
      quoteSymbol: sym === 'USDT' ? 'USDTUSDT' : `${sym}USDT`,
      amount,
      usdtValue,
      price,
      currentPct: 0, // filled below
      targetPct,
      drift: 0,       // filled below
      logoColor: assetColor(sym, isAlpha),
      isAlpha,
    })
  }

  // Also include Binance Alpha tokens configured by user that aren't in spot balances yet
  for (const [sym, alpha] of alphaMap.entries()) {
    if (!processedSymbols.has(sym) && alpha.amount > 0 && alpha.priceUSDT > 0) {
      const usdtValue = alpha.amount * alpha.priceUSDT
      if (usdtValue >= 0.05) {
        assets.push({
          symbol: sym,
          quoteSymbol: `${sym}USDT`,
          amount: alpha.amount,
          usdtValue,
          price: alpha.priceUSDT,
          currentPct: 0,
          targetPct: targets[sym] ?? alpha.targetPct ?? 0,
          drift: 0,
          logoColor: '#A855F7',
          isAlpha: true,
        })
      }
    }
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

// full rebalance calculator (sell + buy)
// algorithm: sell overweight assets, buy underweight assets to reach target allocation
export function calculateRebalance(
  assets: Asset[],
  targets: TargetAllocation
): Array<{ symbol: string; action: 'sell' | 'buy'; amountUSDT: number; currentPct: number; targetPct: number; newPct: number }> {
  if (assets.length === 0) return []

  const totalUSDT = assets.reduce((s, a) => s + a.usdtValue, 0)
  if (totalUSDT <= 0) return []

  const results: Array<{ symbol: string; action: 'sell' | 'buy'; amountUSDT: number; currentPct: number; targetPct: number; newPct: number }> = []

  // Calculate target value for each asset
  for (const asset of assets) {
    const targetPct = targets[asset.symbol] ?? 0
    if (targetPct === 0) continue

    const currentValue = asset.usdtValue
    const targetValue = (targetPct / 100) * totalUSDT
    const diff = currentValue - targetValue

    if (Math.abs(diff) < 1) continue // Skip if difference is less than $1

    if (diff > 0) {
      // Overweight: sell
      results.push({
        symbol: asset.symbol,
        action: 'sell',
        amountUSDT: diff,
        currentPct: asset.currentPct,
        targetPct,
        newPct: targetPct,
      })
    } else {
      // Underweight: buy
      results.push({
        symbol: asset.symbol,
        action: 'buy',
        amountUSDT: Math.abs(diff),
        currentPct: asset.currentPct,
        targetPct,
        newPct: targetPct,
      })
    }
  }

  return results.sort((a, b) => b.amountUSDT - a.amountUSDT)
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
