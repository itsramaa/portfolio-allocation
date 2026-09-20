package portfolio

import (
	"portfolio-server/internal/config"
	"testing"
)

func TestCalculateRebalanceUsesAdaptiveBandAndEconomicMinimum(t *testing.T) {
	result := CalculateRebalance([]Asset{{Symbol: "BTC", Value: 25, Price: 1, TargetPct: 50}, {Symbol: "ETH", Value: 75, Price: 1, TargetPct: 50}}, 5, 1)
	if len(result.Orders) != 2 {
		t.Fatalf("expected both orders despite min trade threshold, got %#v", result.Orders)
	}
	if result.Orders[0].BelowMinOrder {
		t.Fatal("expected $25 order to be executable")
	}

	small := CalculateRebalance([]Asset{{Symbol: "BTC", Value: 997, Price: 1, TargetPct: 99}, {Symbol: "ETH", Value: 3, Price: 1, TargetPct: 1}}, 5, 1)
	if len(small.Orders) != 2 || small.Orders[0].IsTriggered || small.Orders[1].IsTriggered {
		t.Fatalf("expected adaptive band to suppress triggering while retaining visible orders, got %#v", small.Orders)
	}
}

func TestCalculateRebalanceReturnsBelowMinimumOrders(t *testing.T) {
	result := CalculateRebalance([]Asset{{Symbol: "BTC", Value: 99.5, Price: 1, TargetPct: 99}, {Symbol: "ETH", Value: 0.5, Price: 1, TargetPct: 1}}, 5, 1)
	if len(result.Orders) != 2 {
		t.Fatalf("expected below-min orders to remain visible, got %#v", result.Orders)
	}
	for _, order := range result.Orders {
		if !order.BelowMinOrder {
			t.Fatalf("expected below-min indicator, got %#v", order)
		}
	}
}

func TestCalculateRebalanceHandlesReserveAndTradingBuckets(t *testing.T) {
	result := CalculateRebalance([]Asset{
		{Symbol: "USDT", Value: 200, Price: 1, TargetPct: 10},
		{Symbol: "FUTURES_USDT", Value: 100, Price: 1, TargetPct: 5},
		{Symbol: "BTC", Value: 700, Price: 1, TargetPct: 85},
	}, 5, 1)
	for _, order := range result.Orders {
		if order.Symbol == "USDT" {
			t.Fatal("overweight reserve should be omitted")
		}
		if order.Symbol == "FUTURES_USDT" && order.IsTriggered {
			t.Fatal("trading bucket must never be hard-triggered")
		}
	}
}

func TestCalculateRebalanceUsesBuySellDirectionsAndDriftPercentagePoints(t *testing.T) {
	result := CalculateRebalance([]Asset{
		{Symbol: "BTC", Value: 25, Price: 1, CurrentPct: 25, TargetPct: 50},
		{Symbol: "ETH", Value: 75, Price: 1, CurrentPct: 75, TargetPct: 50},
	}, 1, 1)

	if len(result.Orders) != 2 || result.Orders[0].Symbol != "BTC" || result.Orders[1].Action != "SELL" {
		t.Fatalf("expected deterministic order with SELL, got %#v", result.Orders)
	}
	if result.Orders[0].Action != "BUY" || result.Orders[0].DriftPct != -25 || result.Orders[1].DriftPct != 25 {
		t.Fatalf("expected drift in percentage points, got %#v", result.Orders)
	}
	if result.EstimatedFeesUSDT != (25+25)*defaultFeeRate() {
		t.Fatalf("expected fees on executed notional, got %v", result.EstimatedFeesUSDT)
	}
}

func TestCalculateRebalanceSellsHeldTargetZeroAndKeepsTargetOnly(t *testing.T) {
	result := CalculateRebalance([]Asset{{Symbol: "OLD", Value: 100, Price: 2, TargetPct: 0}, {Symbol: "NEW", Value: 0, Price: 10, TargetPct: 100}}, 1, 1)
	if len(result.Orders) != 2 || result.TotalSellUSDT != 100 || result.TotalBuyUSDT != 100 {
		t.Fatalf("expected zero-target sell and target-only buy, got %#v", result)
	}
}

func TestCalculateCashInjectionIncludesTargetOnlySymbolsAndNonNilItems(t *testing.T) {
	result := CalculateCashInjection([]Asset{{Symbol: "BTC", Value: 100, Price: 100}}, map[string]float64{"BTC": 50, "ETH": 50}, 100)
	if len(result.Items) != 2 || result.Items[0].Symbol != "ETH" {
		t.Fatalf("expected target-only ETH item first, got %#v", result.Items)
	}
}

func TestCalculateCashInjectionEmptyItemsIsNonNil(t *testing.T) {
	result := CalculateCashInjection(nil, map[string]float64{}, 100)
	if result.Items == nil {
		t.Fatal("expected non-nil items")
	}
}

func TestCalculateRebalanceFuturesUnderTargetIsInjectionOnly(t *testing.T) {
	result := CalculateRebalance([]Asset{
		{Symbol: "BTC", Value: 450, Price: 1, TargetPct: 45},
		{Symbol: "ETH", Value: 450, Price: 1, TargetPct: 45},
		{Symbol: "FUTURES_USDT", Value: 0, Price: 1, TargetPct: 10},
	}, 5, 1)
	for _, order := range result.Orders {
		if order.Symbol == "FUTURES_USDT" {
			t.Fatalf("under-target Futures must not create an order: %#v", order)
		}
	}
	if len(result.Orders) != 0 {
		t.Fatalf("a Futures loss alone must not disturb balanced spot allocation: %#v", result.Orders)
	}
}

func TestCalculateRebalanceFuturesOverweightSuggestsTransferOut(t *testing.T) {
	result := CalculateRebalance([]Asset{
		{Symbol: "BTC", Value: 450, Price: 1, TargetPct: 45},
		{Symbol: "ETH", Value: 450, Price: 1, TargetPct: 45},
		{Symbol: "FUTURES_USDT", Value: 200, Price: 1, TargetPct: 10},
	}, 5, 1)
	for _, order := range result.Orders {
		if order.Symbol == "FUTURES_USDT" {
			if order.Action != "SELL" || order.IsTriggered {
				t.Fatalf("expected non-triggered FUT to SPOT guidance, got %#v", order)
			}
			return
		}
	}
	t.Fatal("expected an overweight Futures transfer guidance")
}

func TestCalculateRebalanceNormalizesSpotTargetsWhenFuturesTargetExists(t *testing.T) {
	result := CalculateRebalance([]Asset{
		{Symbol: "BTC", Value: 90, Price: 1, TargetPct: 45},
		{Symbol: "ETH", Value: 10, Price: 1, TargetPct: 45},
		{Symbol: "FUTURES_USDT", Value: 0, Price: 1, TargetPct: 10},
	}, 1, 1)
	var btc, eth *RebalanceOrder
	for i := range result.Orders {
		if result.Orders[i].Symbol == "BTC" {
			btc = &result.Orders[i]
		}
		if result.Orders[i].Symbol == "ETH" {
			eth = &result.Orders[i]
		}
	}
	if btc == nil || eth == nil || btc.TargetPct != 50 || eth.TargetPct != 50 || btc.AmountUSDT != 40 || eth.AmountUSDT != 40 {
		t.Fatalf("expected normalized 50/50 spot targets and $40 trades, got %#v", result.Orders)
	}
	if result.RebalanceBaseUSDT != 100 || result.TotalPortfolioUSDT != 100 {
		t.Fatalf("expected separate account and spot totals, got %#v", result)
	}
}

func defaultFeeRate() float64 { return config.Get().RebalanceFeeRate }
