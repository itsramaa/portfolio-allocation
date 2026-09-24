package narratives

import "testing"

func TestCoinGeckoFallbackPopulatesNarrativeSignals(t *testing.T) {
	result := map[string]NarrativeSignals{"depin": emptySignals()}
	markets := make(map[string]freeMarket)
	for _, symbol := range SeedNarratives[2].Assets {
		markets[symbol] = freeMarket{
			Symbol: symbol, MarketCap: 1_000_000, TotalVolume: 100_000,
			PriceChange24: 2, PriceChange7: 5,
		}
	}

	applyMarketDerivedSignals(result, markets, nil, nil)
	signals := result["depin"]
	for name, signal := range map[string]Signal{
		"social": signals.Social, "market": signals.Market, "volume": signals.Volume,
		"onchain": signals.Onchain, "capital flow": signals.CapitalFlow, "catalyst": signals.Catalyst,
	} {
		if !signal.Available {
			t.Errorf("%s signal is unavailable: %+v", name, signal)
		}
	}
	if signals.Onchain.Sources[0] != "market-data-activity-proxy" {
		t.Fatalf("on-chain fallback source = %v, want explicit market activity proxy", signals.Onchain.Sources)
	}
}

func TestCompositeScoreRenormalizesAvailableSignals(t *testing.T) {
	score := compositeScore(NarrativeSignals{
		Market:      Signal{Score: 80, Available: true},
		Volume:      Signal{Score: 40, Available: true},
		CapitalFlow: Signal{Score: 0, Available: false},
	})
	want := 60
	if score != want {
		t.Fatalf("composite score = %d, want %d", score, want)
	}
}

func TestLifecycleUsesDirection(t *testing.T) {
	base := NarrativeSignals{Market: Signal{Score: 80, Available: true}}
	if got := lifecycleFor(base, -6); got != "cooling" {
		t.Fatalf("falling high-score lifecycle = %q, want cooling", got)
	}
	if got := lifecycleFor(base, 0); got != "crowded" {
		t.Fatalf("stable high-score lifecycle = %q, want crowded", got)
	}
}

func TestProxySignalIsExplicitAndBounded(t *testing.T) {
	signal := proxySignal(2, 1, "market-data-volume-proxy")
	if !signal.Available || signal.Score <= 50 || len(signal.Sources) != 1 || signal.Sources[0] != "market-data-volume-proxy" {
		t.Fatalf("proxy signal = %+v, want explicit available source above baseline", signal)
	}
	if got := proxySignal(1, 1, "test").Score; got != 50 {
		t.Fatalf("neutral proxy score = %v, want 50", got)
	}
}

func TestNormalizeSymbol(t *testing.T) {
	for input, want := range map[string]string{"rndr": "RENDER", "MATIC": "POL", " btc ": "BTC"} {
		if got := normalizeSymbol(input); got != want {
			t.Errorf("normalizeSymbol(%q) = %q, want %q", input, got, want)
		}
	}
}
