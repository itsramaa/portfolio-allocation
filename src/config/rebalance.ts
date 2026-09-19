// ─── Rebalance Gate Configuration ────────────────────────────────────────────
//
// Three-gate trigger model:
//   Gate 1 (Allocation Band):    |drift_pp| >= max(RELATIVE * target, FLOOR_PP)
//   Gate 2 (Economic Scale):     drift_value >= MIN_DRIFT_PORTFOLIO_RATIO * total_portfolio
//   Gate 3 (Transaction Cost):   trade_value >= MIN_ORDER_USDT
//                                 AND estimated_cost <= MAX_COST_RATIO * trade_value

/** Relative band width: 25% of the target allocation percentage. */
export const REBALANCE_RELATIVE = 0.25

/** Minimum band floor in percentage-points (prevents hair-trigger on tiny targets). */
export const REBALANCE_FLOOR_PP = 3

/** Minimum portfolio-relative drift to constitute economic significance (0.5%). */
export const MIN_DRIFT_PORTFOLIO_RATIO = 0.005

/** Binance minimum notional order value in USDT. Orders below this are rejected. */
export const MIN_ORDER_USDT = 5

/** Maximum acceptable cost-to-trade ratio (1% of trade value). */
export const MAX_REBALANCE_COST_RATIO = 0.01

/** Binance spot baseline maker/taker fee rate (0.1%). */
export const ESTIMATED_FEE_RATE = 0.001

/**
 * Internal execution safety floor — models bid/ask spread, micro-slippage,
 * and lot-size rounding. NOT an exchange fee.
 */
export const ESTIMATED_FRICTION_FLOOR_USDT = 0.05

/** Backward-compatible alias for ESTIMATED_FRICTION_FLOOR_USDT. */
export const ESTIMATED_FIXED_FRICTION = ESTIMATED_FRICTION_FLOOR_USDT

/** Legacy fallback: minimum absolute dollar drift (used in older gate checks). */
export const MIN_DOLLAR_DRIFT = 25

/**
 * Hysteresis deadband buffer (in pp) to prevent oscillation at band boundaries
 * (e.g. 37.49% vs 37.51% flip-flopping).
 */
export const REBALANCE_HYSTERESIS_PP = 0.5
