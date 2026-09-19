package portfolio

import (
	"math"
	"sort"
	"strings"

	"portfolio-server/internal/config"
)

type Asset struct {
	Symbol      string  `json:"symbol"`
	Name        string  `json:"name"`
	Amount      float64 `json:"amount"`
	Price       float64 `json:"price"`
	Value       float64 `json:"value"`
	CurrentPct  float64 `json:"currentPct"`
	TargetPct   float64 `json:"targetPct"`
	TargetValue float64 `json:"targetValue"`
	Diff        float64 `json:"diff"`
	DiffPct     float64 `json:"diffPct"`
	Action      string  `json:"action"` // "BUY", "SELL", "HOLD"
	Drift       float64 `json:"drift"`
}

type RebalanceOrder struct {
	Symbol        string  `json:"symbol"`
	Action        string  `json:"action"` // "BUY" or "SELL"
	AmountUSDT    float64 `json:"amountUSDT"`
	EstimatedQty  float64 `json:"estimatedQty"`
	CurrentPct    float64 `json:"currentPct"`
	TargetPct     float64 `json:"targetPct"`
	DiffPct       float64 `json:"diffPct"`
	DriftPct      float64 `json:"driftPct"`
	Price         float64 `json:"price"`
	BelowMinOrder bool    `json:"belowMinOrder"`
	IsTriggered   bool    `json:"isTriggered"`
}

type RebalanceResult struct {
	TotalPortfolioUSDT float64          `json:"totalPortfolioUSDT"`
	TotalBuyUSDT       float64          `json:"totalBuyUSDT"`
	TotalSellUSDT      float64          `json:"totalSellUSDT"`
	NetTurnoverUSDT    float64          `json:"netTurnoverUSDT"`
	EstimatedFeesUSDT  float64          `json:"estimatedFeesUSDT"`
	MaxDriftPct        float64          `json:"maxDriftPct"`
	Orders             []RebalanceOrder `json:"orders"`
}

type InjectionItem struct {
	Symbol       string  `json:"symbol"`
	Price        float64 `json:"price"`
	CurrentValue float64 `json:"currentValue"`
	CurrentPct   float64 `json:"currentPct"`
	TargetPct    float64 `json:"targetPct"`
	Allocated    float64 `json:"allocated"`
	EstimatedQty float64 `json:"estimatedQty"`
	NewValue     float64 `json:"newValue"`
	NewPct       float64 `json:"newPct"`
}

type InjectionResult struct {
	DepositAmount float64         `json:"depositAmount"`
	NewTotalUSDT  float64         `json:"newTotalUSDT"`
	Items         []InjectionItem `json:"items"`
}

var reserveSymbols = map[string]bool{"USDT": true, "USDC": true, "FDUSD": true}
var tradingBucketSymbols = map[string]bool{"FUTURES_USDT": true}

func rebalanceBand(targetPct float64, symbol string) float64 {
	if targetPct <= 0 || reserveSymbols[symbol] || tradingBucketSymbols[symbol] {
		return 0
	}
	return math.Max(0.25*targetPct, 3)
}

var CoinNames = map[string]string{
	"BTC":          "Bitcoin",
	"ETH":          "Ethereum",
	"SOL":          "Solana",
	"BNB":          "BNB",
	"NEAR":         "NEAR Protocol",
	"USDT":         "Tether USD",
	"USDC":         "USD Coin",
	"FDUSD":        "First Digital USD",
	"FUTURES_USDT": "Futures Wallet (USDT)",
	"OTHER":        "Other Assets",
}

func GetCoinName(symbol string) string {
	if name, ok := CoinNames[symbol]; ok {
		return name
	}
	return symbol
}

func ResolvePrice(symbol string, prices map[string]float64) float64 {
	upper := strings.ToUpper(symbol)
	if upper == "USDT" || upper == "USDC" || upper == "FDUSD" || upper == "FUTURES_USDT" {
		return 1.0
	}
	if p, ok := prices[upper]; ok {
		return p
	}
	if p, ok := prices[upper+"USDT"]; ok {
		return p
	}
	return 0.0
}

// BuildAssets creates full asset valuation records from raw balances, prices, and targets.
func BuildAssets(
	balances map[string]float64,
	prices map[string]float64,
	targets map[string]float64,
) []Asset {
	if targets == nil {
		targets = make(map[string]float64)
	}

	assetMap := make(map[string]*Asset)

	// Populate from targets first
	for sym, targetPct := range targets {
		price := ResolvePrice(sym, prices)
		assetMap[sym] = &Asset{
			Symbol:    sym,
			Name:      GetCoinName(sym),
			Amount:    0,
			Price:     price,
			TargetPct: targetPct,
		}
	}

	// Add balances
	for sym, amount := range balances {
		if amount <= 0 {
			continue
		}
		price := ResolvePrice(sym, prices)
		val := amount * price

		// Merge into "OTHER" if target allocation has "OTHER" and coin is not explicitly targeted
		if _, targeted := targets[sym]; !targeted && targets["OTHER"] > 0 {
			other, exists := assetMap["OTHER"]
			if !exists {
				other = &Asset{
					Symbol:    "OTHER",
					Name:      "Other Assets",
					Price:     1.0,
					TargetPct: targets["OTHER"],
				}
				assetMap["OTHER"] = other
			}
			other.Value += val
			other.Amount = other.Value
			continue
		}

		if existing, ok := assetMap[sym]; ok {
			existing.Amount = amount
			existing.Price = price
			existing.Value = val
		} else {
			// Non-targeted asset: filter dust using configurable threshold
			if val >= config.Get().DustThresholdUSDT {
				assetMap[sym] = &Asset{
					Symbol: sym,
					Name:   GetCoinName(sym),
					Amount: amount,
					Price:  price,
					Value:  val,
				}
			}
		}
	}

	// Calculate total portfolio value
	var totalUSDT float64
	for _, a := range assetMap {
		totalUSDT += a.Value
	}

	// Compute percentages, targets, diff, action, drift
	result := make([]Asset, 0, len(assetMap))
	for _, a := range assetMap {
		if totalUSDT > 0 {
			a.CurrentPct = (a.Value / totalUSDT) * 100.0
		}
		a.TargetValue = totalUSDT * (a.TargetPct / 100.0)
		a.Diff = a.TargetValue - a.Value
		a.DiffPct = a.TargetPct - a.CurrentPct

		if a.TargetPct > 0 {
			a.Drift = a.CurrentPct - a.TargetPct
		}

		actionThreshold := config.Get().ActionThresholdPct
		if a.TargetPct > 0 {
			if a.DiffPct > actionThreshold {
				a.Action = "BUY"
			} else if a.DiffPct < -actionThreshold {
				a.Action = "SELL"
			}
		} else if a.Value > 0 {
			a.Action = "SELL"
		} else {
			a.Action = "HOLD"
		}

		result = append(result, *a)
	}

	// Sort: targeted first by target % descending, then untargeted by value descending
	sort.Slice(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.TargetPct > 0 && b.TargetPct == 0 {
			return true
		}
		if a.TargetPct == 0 && b.TargetPct > 0 {
			return false
		}
		if a.TargetPct > 0 && b.TargetPct > 0 {
			return a.TargetPct > b.TargetPct
		}
		return a.Value > b.Value
	})

	return result
}

// CalculateCashInjection determines optimal cash distribution across under-allocated assets.
func CalculateCashInjection(
	assets []Asset,
	targets map[string]float64,
	depositAmount float64,
) InjectionResult {
	var currentTotal float64
	for _, a := range assets {
		currentTotal += a.Value
	}
	newTotal := currentTotal + depositAmount

	// Determine ideal new target values
	type defItem struct {
		symbol      string
		price       float64
		currentVal  float64
		targetPct   float64
		idealNewVal float64
		deficit     float64
	}

	assetBySymbol := make(map[string]Asset, len(assets))
	for _, a := range assets {
		symbol := a.Symbol
		if _, targeted := targets[symbol]; !targeted && targets["OTHER"] > 0 {
			other := assetBySymbol["OTHER"]
			other.Symbol = "OTHER"
			other.Price = 1
			other.Value += a.Value
			other.Amount = other.Value
			assetBySymbol["OTHER"] = other
			continue
		}
		assetBySymbol[symbol] = a
	}

	var deficits []defItem
	var totalDeficit float64
	for symbol, targetPct := range targets {
		if targetPct <= 0 {
			continue
		}
		a := assetBySymbol[symbol]
		idealNewVal := newTotal * (targetPct / 100.0)
		deficit := math.Max(0, idealNewVal-a.Value)
		deficits = append(deficits, defItem{
			symbol: symbol, price: a.Price, currentVal: a.Value,
			targetPct: targetPct, idealNewVal: idealNewVal, deficit: deficit,
		})
		totalDeficit += deficit
	}

	items := make([]InjectionItem, 0, len(deficits))
	for _, d := range deficits {
		var allocated float64
		if totalDeficit > 0 {
			allocated = (d.deficit / totalDeficit) * depositAmount
		} else if d.targetPct > 0 {
			allocated = depositAmount * (d.targetPct / 100.0)
		}

		newVal := d.currentVal + allocated
		var newPct float64
		if newTotal > 0 {
			newPct = (newVal / newTotal) * 100.0
		}

		var estQty float64
		if d.price > 0 {
			estQty = allocated / d.price
		}

		var curPct float64
		if currentTotal > 0 {
			curPct = (d.currentVal / currentTotal) * 100.0
		}

		items = append(items, InjectionItem{
			Symbol:       d.symbol,
			Price:        d.price,
			CurrentValue: d.currentVal,
			CurrentPct:   curPct,
			TargetPct:    d.targetPct,
			Allocated:    allocated,
			EstimatedQty: estQty,
			NewValue:     newVal,
			NewPct:       newPct,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].Allocated > items[j].Allocated
	})

	return InjectionResult{
		DepositAmount: depositAmount,
		NewTotalUSDT:  newTotal,
		Items:         items,
	}
}

// CalculateRebalance determines recommended trade orders to bring portfolio to target allocations.
func CalculateRebalance(
	assets []Asset,
	minTradeUSDT float64,
	thresholdPct float64,
) RebalanceResult {
	cfg := config.Get()
	if minTradeUSDT <= 0 {
		minTradeUSDT = cfg.RebalanceMinTradeUSDT
	}
	if thresholdPct <= 0 {
		thresholdPct = cfg.RebalanceThresholdPct
	}

	var totalPortfolio float64
	var maxDrift float64
	for _, a := range assets {
		totalPortfolio += a.Value
	}

	var orders = make([]RebalanceOrder, 0)
	var totalBuy, totalSell float64

	for _, a := range assets {
		currentPct := a.CurrentPct
		if totalPortfolio > 0 {
			currentPct = a.Value / totalPortfolio * 100
		}
		targetValue := totalPortfolio * a.TargetPct / 100
		diff := targetValue - a.Value
		diffPct := a.TargetPct - currentPct
		drift := currentPct - a.TargetPct
		if math.Abs(drift) > maxDrift {
			maxDrift = math.Abs(drift)
		}
		absDiff := math.Abs(diff)
		if absDiff < 0.01 || (reserveSymbols[a.Symbol] && diff < 0) {
			continue
		}

		action := "BUY"
		if diff < 0 {
			action = "SELL"
			totalSell += absDiff
		} else {
			totalBuy += absDiff
		}

		band := rebalanceBand(a.TargetPct, a.Symbol)
		if thresholdPct > band && !reserveSymbols[a.Symbol] && !tradingBucketSymbols[a.Symbol] && a.TargetPct > 0 {
			band = thresholdPct
		}
		belowMin := absDiff < minTradeUSDT
		minEconomic := totalPortfolio * 0.005
		gateBand := (a.TargetPct == 0 && absDiff > 0) || math.Abs(drift) >= band
		isTriggered := gateBand && absDiff >= minEconomic && !belowMin && !reserveSymbols[a.Symbol] && !tradingBucketSymbols[a.Symbol]

		var qty float64
		if a.Price > 0 {
			qty = absDiff / a.Price
		}
		orders = append(orders, RebalanceOrder{
			Symbol: a.Symbol, Action: action, AmountUSDT: absDiff, EstimatedQty: qty,
			CurrentPct: currentPct, TargetPct: a.TargetPct, DiffPct: diffPct, DriftPct: drift,
			Price: a.Price, BelowMinOrder: belowMin, IsTriggered: isTriggered,
		})
	}

	// Sort orders: largest value trades first
	sort.Slice(orders, func(i, j int) bool {
		if orders[i].AmountUSDT != orders[j].AmountUSDT {
			return orders[i].AmountUSDT > orders[j].AmountUSDT
		}
		return orders[i].Symbol < orders[j].Symbol
	})

	turnover := math.Min(totalBuy, totalSell)
	executedNotional := totalBuy + totalSell
	estimatedFees := executedNotional * cfg.RebalanceFeeRate

	return RebalanceResult{
		TotalPortfolioUSDT: totalPortfolio,
		TotalBuyUSDT:       totalBuy,
		TotalSellUSDT:      totalSell,
		NetTurnoverUSDT:    turnover,
		EstimatedFeesUSDT:  estimatedFees,
		MaxDriftPct:        maxDrift,
		Orders:             orders,
	}
}

// DemoBalances returns simulated account balances for simulation mode.
func DemoBalances() map[string]float64 {
	return map[string]float64{
		"BTC":  0.245,
		"ETH":  2.10,
		"SOL":  18.5,
		"BNB":  4.2,
		"NEAR": 150.0,
		"USDT": 480.0,
	}
}

// DemoPrices returns fallback prices for simulation mode.
func DemoPrices() map[string]float64 {
	return map[string]float64{
		"BTCUSDT":  68500,
		"ETHUSDT":  3600,
		"SOLUSDT":  175,
		"BNBUSDT":  590,
		"NEARUSDT": 5.4,
		"USDTUSDT": 1.0,
	}
}
