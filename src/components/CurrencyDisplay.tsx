// ─── Currency Display with USD Tooltip Component ─────────────────────────────
import type { CurrencyCode } from '../types'
import { convertUSDToCurrency, formatCurrencyValue } from '../currency'

interface CurrencyDisplayProps {
  usdValue: number
  currency: CurrencyCode
  rates: Record<string, number>
  className?: string
  style?: React.CSSProperties
  showUsdSub?: boolean
  asBlock?: boolean
  compact?: boolean
}

export function CurrencyDisplay({
  usdValue,
  currency,
  rates,
  className = 'mono',
  style,
  showUsdSub = false,
  asBlock = false,
}: CurrencyDisplayProps) {
  const isUSD = currency === 'USD'
  const converted = convertUSDToCurrency(usdValue, currency, rates)
  const primaryText = formatCurrencyValue(converted, currency)
  const usdText = `$${usdValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: usdValue < 1 ? 4 : 2,
  })}`

  const tooltipLabel = `= ${usdText} USD`

  if (isUSD) {
    return (
      <span className={className} style={style}>
        {primaryText}
      </span>
    )
  }

  if (asBlock || showUsdSub) {
    return (
      <div
        className={className}
        style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'inherit', ...style }}
        title={tooltipLabel}
      >
        <span>{primaryText}</span>
        <span
          style={{
            fontSize: '0.72rem',
            color: 'oklch(55% 0.01 240)',
            fontWeight: 400,
            marginTop: '0.1rem',
          }}
        >
          = {usdText}
        </span>
      </div>
    )
  }

  return (
    <span
      className={`currency-with-tooltip ${className}`}
      title={tooltipLabel}
      style={{
        cursor: 'help',
        borderBottom: '1px dotted oklch(100% 0 0 / 0.25)',
        transition: 'border-color 0.15s',
        ...style,
      }}
    >
      {primaryText}
    </span>
  )
}
