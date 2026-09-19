// ─── Demo / Simulation Configuration ─────────────────────────────────────────
import type { TargetAllocation } from '../types'

/**
 * Default target allocation used when a new user explores the app in demo mode
 * before connecting a real API key.
 */
export const DEMO_TARGETS: TargetAllocation = {
  BTC: 45,
  ETH: 25,
  SOL: 15,
  BNB: 10,
  NEAR: 5,
}
