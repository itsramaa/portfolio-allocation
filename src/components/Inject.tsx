// ─── Inject Cash Tab ─────────────────────────────────────────────────────────
import { fmtUSDT, fmtPct } from "../lib/portfolio";
import type { Asset, TargetAllocation, CurrencyCode } from "../types";
import {
  CURRENCIES,
  convertUSDToCurrency,
  formatCurrencyValue,
} from "../utils/currency";
import { useInjection } from "../hooks/useInjection";

const HIDDEN = '••••••'

interface InjectProps {
  assets: Asset[];
  targets: TargetAllocation;
  currency: CurrencyCode;
  rates: Record<string, number>;
  onNavigateSettings: () => void;
  hideValues?: boolean;
}

export function Inject({
  assets,
  targets,
  currency,
  rates,
  onNavigateSettings,
  hideValues = false,
}: InjectProps) {
  const {
    inputCurrency,
    setInputVal,
    inputVal,
    submitted,
    setSubmitted,
    result,
    calculating,
    parsedNum,
    injectionUSDT,
    totalPortfolio,
    injectionPct,
    isNonUSD,
    activeRate,
    currencyMeta,
    hasTargets,
    targetSum,
    error,
    handleCalculate,
    toggleConvert: handleToggleConvert,
  } = useInjection(assets, targets, currency, rates);

  if (!hasTargets) {
    return (
      <div
        className="surface-card fade-up"
        style={{ padding: "3.5rem 2rem", textAlign: "center" }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎯</div>
        <div
          style={{
            fontWeight: 700,
            fontSize: "1.1rem",
            color: "#F0B90B",
            marginBottom: "0.5rem",
          }}
        >
          Target Allocation Required
        </div>
        <p
          style={{
            color: "oklch(55% 0.01 240)",
            fontSize: "0.85rem",
            maxWidth: 420,
            margin: "0 auto 1.5rem",
            lineHeight: 1.6,
          }}
        >
          You need to set your ideal portfolio percentages (e.g. BTC 40%, ETH
          30%, SOL 20%, USDT 10%) before using the cash injection calculator.
        </p>
        <button
          id="inject-go-to-settings"
          className="btn btn-primary btn-sm mono"
          onClick={onNavigateSettings}
        >
          Open Settings &amp; Configure Targets
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        maxWidth: 840,
      }}
      className="fade-up inject-page"
    >
      {/* Input card */}
      <div className="surface-card" style={{ padding: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "oklch(95% 0.01 240)",
                letterSpacing: "-0.02em",
              }}
            >
              Cash Injection Rebalancing Calculator
            </h2>
            <p
              style={{
                fontSize: "0.82rem",
                color: "oklch(55% 0.01 240)",
                marginTop: "0.25rem",
                lineHeight: 1.5,
              }}
            >
              Enter incoming fiat or stablecoin capital. The algorithm
              calculates the optimal buy plan to close underweight positions
              without selling existing assets.
            </p>
          </div>

          {/* Currency denomination switch */}
          {isNonUSD && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "oklch(15% 0.012 240)",
                padding: "0.25rem",
                borderRadius: "0.375rem",
                border: "1px solid oklch(100% 0 0 / 0.08)",
              }}
            >
              <button
                type="button"
                className={`btn btn-xs ${inputCurrency === currency ? "btn-primary" : "btn-ghost"}`}
                onClick={() => {
                  if (inputCurrency !== currency) handleToggleConvert();
                }}
              >
                {currency} ({CURRENCIES[currency].symbol})
              </button>
              <button
                type="button"
                className={`btn btn-xs ${inputCurrency === "USD" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => {
                  if (inputCurrency !== "USD") handleToggleConvert();
                }}
              >
                USD ($)
              </button>
            </div>
          )}
        </div>

        {/* Target warning if sum != 100 */}
        {Math.abs(targetSum - 100) > 0.5 && (
          <div
            role="alert"
            className="alert alert-warning mb-4"
            style={{ fontSize: "0.82rem" }}
          >
            <span>
              ⚠️ Target allocations sum to{" "}
              <strong>{targetSum.toFixed(1)}%</strong> (should equal 100%).
              Update in Settings for accurate results.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="alert alert-error mb-4"
            style={{ fontSize: "0.82rem" }}
          >
            {error}
          </div>
        )}

        <form
          id="injection-form"
          onSubmit={handleCalculate}
          style={{ marginTop: "1.25rem" }}
        >
          <div className="inject-form-row">
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.4rem",
                }}
              >
                <label
                  htmlFor="injection-amount"
                  style={{
                    fontSize: "0.72rem",
                    color: "oklch(55% 0.01 240)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    fontWeight: 600,
                  }}
                >
                  Deposit Amount ({inputCurrency})
                </label>
                {isNonUSD && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "oklch(50% 0.01 240)",
                    }}
                  >
                    Rate: 1 USD = {formatCurrencyValue(activeRate, currency)}
                  </span>
                )}
              </div>

              <div style={{ position: "relative" }}>
                <span
                  className="mono"
                  style={{
                    position: "absolute",
                    left: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#F0B90B",
                    fontWeight: 700,
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                >
                  {currencyMeta.symbol}
                </span>
                <input
                  id="injection-amount"
                  type="text"
                  className="input w-full mono"
                  placeholder={
                    inputCurrency === "IDR" ? "e.g. 15000000" : "0.00"
                  }
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    setSubmitted(false);
                  }}
                  style={{
                    paddingLeft: inputCurrency === "IDR" ? "2.75rem" : "2.2rem",
                    fontSize: "1.15rem",
                  }}
                  autoFocus
                />
              </div>

              {/* Conversion indicator */}
              {isNonUSD && parsedNum > 0 && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.65rem 0.9rem",
                    borderRadius: "0.375rem",
                    background: "oklch(14% 0.012 240)",
                    border: "1px solid oklch(80% 0.18 85 / 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ fontSize: "0.82rem" }}>
                    {inputCurrency !== "USD" ? (
                      <span>
                        Equivalent:{" "}
                        <strong className="mono" style={{ color: "#F0B90B" }}>
                          {hideValues ? HIDDEN : `$${injectionUSDT.toFixed(2)} USDT`}
                        </strong>
                      </span>
                    ) : (
                      <span>
                        Equivalent:{" "}
                        <strong className="mono" style={{ color: "#F0B90B" }}>
                          {hideValues ? HIDDEN : `${formatCurrencyValue(convertUSDToCurrency(parsedNum, currency, rates), currency)} ${currency}`}
                        </strong>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    id="toggle-convert-currency"
                    onClick={handleToggleConvert}
                    className="btn btn-xs btn-outline btn-warning mono"
                  >
                    ⇄ Convert to {inputCurrency === "USD" ? currency : "USD"}
                  </button>
                </div>
              )}

              {injectionUSDT > 0 && totalPortfolio > 0 && (
                <div
                  className="mono"
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.78rem",
                    color: "oklch(55% 0.01 240)",
                  }}
                >
                  {hideValues
                    ? `= ${fmtPct(injectionPct)} of existing portfolio`
                    : `= ${fmtPct(injectionPct)} of existing portfolio (${fmtUSDT(totalPortfolio)})`}
                </div>
              )}
            </div>

            <button
              id="injection-calculate-btn"
              type="submit"
              className="btn btn-primary"
              disabled={injectionUSDT <= 0 || calculating}
              style={{ minHeight: "3rem", padding: "0 1.5rem" }}
            >
              {calculating ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Calculate Buy Plan"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Table */}
      {submitted && result && result.items.length > 0 && (
        <div className="surface-card fade-up" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid oklch(100% 0 0 / 0.07)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "oklch(50% 0.01 240)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontWeight: 600,
                }}
              >
                Recommended Buy Plan
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F0B90B' }}>
                  {hideValues ? HIDDEN : `${fmtUSDT(result.depositAmount)} Total`}
                </span>
                {isNonUSD && !hideValues && (
                  <span className="mono" style={{ fontSize: '0.82rem', color: 'oklch(60% 0.01 240)' }}>
                    (≈ {formatCurrencyValue(convertUSDToCurrency(result.depositAmount, currency, rates), currency)})
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "oklch(45% 0.01 240)",
                fontStyle: "italic",
              }}
            >
              Execution note: Purchase spot orders on Binance using USDT
            </div>
          </div>

          <div className="desktop-only" style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid oklch(100% 0 0 / 0.08)",
                    color: "oklch(50% 0.01 240)",
                    textAlign: "right",
                  }}
                >
                  <th
                    style={{
                      padding: "0.75rem 1.25rem",
                      textAlign: "left",
                      fontWeight: 600,
                    }}
                  >
                    Asset
                  </th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                    Buy (USDT)
                  </th>
                  {isNonUSD && (
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                      Est. in {currency}
                    </th>
                  )}
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                    % of Cash
                  </th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                    New Weight
                  </th>
                  <th
                    style={{
                      padding: "0.75rem 1.25rem",
                      fontWeight: 600,
                      textAlign: "left",
                      minWidth: 140,
                    }}
                  >
                    Target Gap Closed
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((r, i) => {
                  const asset = assets.find((a) => a.symbol === r.symbol);
                  const color = asset?.logoColor ?? "#848E9C";
                  const localValue = convertUSDToCurrency(
                    r.allocated,
                    currency,
                    rates,
                  );
                  const buyPct =
                    result.depositAmount > 0
                      ? (r.allocated / result.depositAmount) * 100
                      : 0;
                  const gapClosed =
                    r.targetPct > 0
                      ? Math.min(
                        100,
                        ((r.newPct - r.currentPct) /
                          Math.max(0.01, r.targetPct - r.currentPct)) *
                        100,
                      )
                      : 0;

                  return (
                    <tr
                      key={r.symbol}
                      style={{
                        borderBottom:
                          i < result.items.length - 1
                            ? "1px solid oklch(100% 0 0 / 0.04)"
                            : "none",
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: `${color}22`,
                              border: `1px solid ${color}44`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color,
                              fontFamily: "JetBrains Mono, monospace",
                              flexShrink: 0,
                            }}
                          >
                            {r.symbol.slice(0, 3)}
                          </span>
                          <div>
                            <span
                              className="mono"
                              style={{
                                fontWeight: 700,
                                color: "oklch(92% 0.01 240)",
                              }}
                            >
                              {r.symbol}
                            </span>
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "oklch(50% 0.01 240)",
                              }}
                            >
                              Target: {r.targetPct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        className="mono"
                        style={{
                          padding: "0.85rem 1rem",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "oklch(95% 0.01 240)",
                        }}
                      >
                        {hideValues ? HIDDEN : fmtUSDT(r.allocated)}
                      </td>
                      {isNonUSD && (
                        <td
                          className="mono"
                          style={{
                            padding: "0.85rem 1rem",
                            textAlign: "right",
                            color: "#F0B90B",
                          }}
                        >
                          {hideValues ? HIDDEN : formatCurrencyValue(localValue, currency)}
                        </td>
                      )}
                      <td
                        className="mono"
                        style={{
                          padding: "0.85rem 1rem",
                          textAlign: "right",
                          color: "oklch(70% 0.01 240)",
                        }}
                      >
                        {buyPct.toFixed(1)}%
                      </td>
                      <td
                        className="mono"
                        style={{
                          padding: "0.85rem 1rem",
                          textAlign: "right",
                          color: "#22c55e",
                          fontWeight: 600,
                        }}
                      >
                        {r.newPct.toFixed(1)}%
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              background: "oklch(20% 0.015 240)",
                              borderRadius: 3,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, Math.max(0, gapClosed))}%`,
                                background: "#22c55e",
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.72rem",
                              color: "oklch(60% 0.01 240)",
                              width: 34,
                              textAlign: "right",
                            }}
                          >
                            {Math.round(Math.max(0, gapClosed))}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mobile-card-list mobile-only">
            {result.items.map(r => {
              const localValue = convertUSDToCurrency(r.allocated, currency, rates)
              const buyPct = result.depositAmount > 0 ? (r.allocated / result.depositAmount) * 100 : 0
              return (
                <div className="mobile-data-card" key={`mobile-${r.symbol}`}>
                  <div className="mobile-data-card-header">
                    <strong>{r.symbol}</strong>
                    <span className="mono" style={{ color: '#22c55e' }}>{hideValues ? HIDDEN : fmtUSDT(r.allocated)}</span>
                  </div>
                  <div className="mobile-data-card-meta mono">
                    <span>{buyPct.toFixed(1)}% cash</span>
                    <span>New {r.newPct.toFixed(1)}%</span>
                    <span>Target {r.targetPct.toFixed(1)}%</span>
                    {isNonUSD && <span>{hideValues ? HIDDEN : formatCurrencyValue(localValue, currency)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
