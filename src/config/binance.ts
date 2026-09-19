// ─── Binance API Configuration ────────────────────────────────────────────────

/** Vite proxy prefix that maps to https://api.binance.com */
export const BINANCE_BASE = '/binance'

/** Maximum timestamp drift window accepted by Binance (ms). */
export const RECV_WINDOW_MS = 60_000

/** How often to re-sync with Binance server time (ms). 10 minutes. */
export const TIME_SYNC_INTERVAL_MS = 10 * 60 * 1_000

/** Maximum number of automatic retries on -1021 timestamp drift errors. */
export const MAX_TIMESTAMP_RETRIES = 2

/** Page size for Simple Earn flexible position queries. */
export const SIMPLE_EARN_PAGE_SIZE = 100
