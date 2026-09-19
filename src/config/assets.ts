// ─── Asset Configuration ─────────────────────────────────────────────────────

/** Deterministic brand color per ticker (used for charts and icons). */
export const ASSET_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', BNB: '#F0B90B', SOL: '#9945FF',
  USDT: '#26A17B', USDC: '#2775CA', XRP: '#00AAE4', ADA: '#0033AD',
  DOGE: '#C2A633', AVAX: '#E84142', DOT: '#E6007A', LINK: '#375BD2',
  MATIC: '#8247E5', LTC: '#BFBBBB', ATOM: '#2E3148', UNI: '#FF007A',
  NEAR: '#00C08B', APT: '#00BFA5', ARB: '#28A0F0', OP: '#FF0420',
  FDUSD: '#00B8D9',
}

/** Color applied to all Futures assets. */
export const FUTURES_COLOR = '#02C076'

/** Default color for unknown/unlisted tickers. */
export const DEFAULT_ASSET_COLOR = '#848E9C'

/**
 * Stablecoins: always priced at $1 and excluded from rebalance triggers.
 * FUTURES_USDT is included because it is effectively a USD-pegged margin balance.
 */
export const STABLECOIN_SYMBOLS = new Set([
  'USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'DAI', 'USDS', 'USDP', 'FUTURES_USDT',
])

/**
 * Reserve assets: overweight is fine (idle cash). Only flag when underweight.
 * Never hard-trigger a rebalance for these.
 */
export const RESERVE_SYMBOLS = new Set([
  'USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'DAI',
])

/**
 * Trading/margin buckets: show transfer guidance only, never auto-trigger.
 */
export const TRADING_BUCKETS = new Set(['FUTURES_USDT'])

/** Minimum USDT amount considered non-dust. Assets below this are skipped. */
export const MIN_DUST_USDT = 0.05

/** Minimum absolute drift (in USDT) before a rebalance line is shown at all. */
export const MIN_VISIBLE_DRIFT_USDT = 0.50
