// ─── Types for the entire application ───────────────────────────────────────

export interface Asset {
  symbol: string        // e.g. "BTC"
  quoteSymbol: string   // e.g. "BTCUSDT"
  amount: number        // raw amount held
  usdtValue: number     // current USDT value
  price: number         // current price in USDT
  currentPct: number    // current % of total portfolio
  targetPct: number     // user-configured target %
  drift: number         // currentPct - targetPct
  rebalanceBand: number // threshold in pp: max(25% × target, 3). 0 = no trigger (USDT/liquidity)
  logoColor: string     // deterministic color for icon
  isFutures?: boolean   // true if asset is Binance USDT-M Futures margin/balance
}

export interface PortfolioSnapshot {
  timestamp: number     // unix ms
  totalUSDT: number     // total portfolio value at that time
  btcPrice?: number     // for benchmark
}

export interface TargetAllocation {
  [symbol: string]: number  // symbol → target pct (0–100), use "OTHER" for the catch-all bucket
}

export interface ApiCredentials {
  apiKey: string
  apiSecret: string
}

export interface InjectionResult {
  symbol: string
  buyUSDT: number
  buyPct: number        // % of injection going to this asset
  newWeight: number     // projected weight after injection
  gapClosed: number     // how much drift is eliminated
}

export interface RebalanceResult {
  symbol: string
  action: 'sell' | 'buy'
  amountUSDT: number
  currentPct: number
  targetPct: number
  newPct: number
}

export type AppTab = 'dashboard' | 'inject' | 'rebalance' | 'settings' | 'history'

export type ConnectionStatus = 'connected' | 'error' | 'loading' | 'unconfigured'

export type CurrencyCode = 'USD' | 'IDR' | 'EUR' | 'GBP' | 'SGD' | 'JPY' | 'AUD'

export interface FxRates {
  base: string
  rates: Record<string, number>
  lastUpdated: number
}
