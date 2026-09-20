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

export type AppTab = 'dashboard' | 'inject' | 'rebalance' | 'settings' | 'history' | 'narrative'

// ─── Narrative types ─────────────────────────────────────────────────────────

export type NarrativeLifecycle = 'emerging' | 'growing' | 'mainstream' | 'crowded' | 'cooling' | 'insufficient-data'

export interface NarrativeSignals {
  social: number        // 0–100: social mentions & engagement velocity
  market: number        // 0–100: price momentum of core assets
  volume: number        // 0–100: DEX/CEX trading volume growth
  onchain: number       // 0–100: on-chain activity (txns, TVL, unique addresses)
  capitalFlow: number   // 0–100: net capital flow into narrative assets
  catalyst: number      // 0–100: recent protocol launches, integrations, news
}

export interface NarrativeSignalChanges {
  social24h: number     // % change in social score vs 24h ago
  volume24h: number     // % change in volume score vs 24h ago
  capitalFlow7d: number // % change in capital flow vs 7d ago
  onchain7d: number     // % change in on-chain vs 7d ago
}

export interface Narrative {
  id: string
  name: string
  emoji: string
  description: string
  lifecycle: NarrativeLifecycle
  score: number             // weighted composite 0–100
  score24hChange: number    // pp change vs 24h ago
  score7dChange: number     // pp change vs 7d ago
  signals: NarrativeSignals
  signalAvailability?: Partial<Record<keyof NarrativeSignals, boolean>>
  signalConfidence?: Partial<Record<keyof NarrativeSignals, number>>
  signalSources?: Partial<Record<keyof NarrativeSignals, string[]>>
  signalChanges: NarrativeSignalChanges
  assets: string[]          // token symbols belonging to this narrative
  drivers: string[]         // human-readable explanation sentences (3–5)
  updatedAt: number         // unix ms
}

export interface NarrativeExposure {
  narrativeId: string
  name: string
  emoji: string
  exposurePct: number       // sum of currentPct of portfolio assets in this narrative
  assets: Array<{ symbol: string; currentPct: number }>
}

export interface NarrativeOverviewStats {
  emerging: number
  growing: number
  hot: number               // score >= 75
  cooling: number
  topTrending: Narrative | null  // largest 7D score increase
}


export type ConnectionStatus = 'connected' | 'error' | 'loading' | 'unconfigured'

export type CurrencyCode = 'USD' | 'IDR' | 'EUR' | 'GBP' | 'SGD' | 'JPY' | 'AUD'

export interface CurrencyMeta {
  code: CurrencyCode
  symbol: string
  name: string
  decimals: number
}

export interface FxRates {
  base: string
  rates: Record<string, number>
  lastUpdated: number
}
