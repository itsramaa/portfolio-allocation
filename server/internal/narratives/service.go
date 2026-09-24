package narratives

import (
	"math"
	"sort"
	"strings"
	"time"

	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
	"portfolio-server/internal/portfolio"
)

// Signal is a normalized narrative input. Score is meaningful only when
// Available is true; unavailable data is excluded from composite scoring.
type Signal struct {
	Score      float64  `json:"score"`
	Available  bool     `json:"available"`
	Confidence float64  `json:"confidence"`
	Change24h  float64  `json:"change24h"`
	Change7d   float64  `json:"change7d"`
	Sources    []string `json:"sources"`
}

type NarrativeSignals struct {
	Social      Signal `json:"social"`
	Market      Signal `json:"market"`
	Volume      Signal `json:"volume"`
	Onchain     Signal `json:"onchain"`
	CapitalFlow Signal `json:"capitalFlow"`
	Catalyst    Signal `json:"catalyst"`
}

type SignalChanges struct {
	Social24h     float64 `json:"social24h"`
	Volume24h     float64 `json:"volume24h"`
	CapitalFlow7d float64 `json:"capitalFlow7d"`
	Onchain7d     float64 `json:"onchain7d"`
}

type Narrative struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	Emoji          string           `json:"emoji"`
	Description    string           `json:"description"`
	Lifecycle      string           `json:"lifecycle"`
	Score          int              `json:"score"`
	Score24hChange float64          `json:"score24hChange"`
	Score7dChange  float64          `json:"score7dChange"`
	Signals        NarrativeSignals `json:"signals"`
	SignalChanges  SignalChanges    `json:"signalChanges"`
	Assets         []string         `json:"assets"`
	Drivers        []string         `json:"drivers"`
	UpdatedAt      int64            `json:"updatedAt"`

	HeldAssets     []string `json:"heldAssets"`
	HeldAllocation float64  `json:"heldAllocation"`
	HeldValueUSDT  float64  `json:"heldValueUSDT"`
}

type NarrativesReport struct {
	Narratives             []Narrative               `json:"narratives"`
	TopNarrative           string                    `json:"topNarrative"`
	CoveredCount           int                       `json:"coveredCount"`
	TotalNarratives        int                       `json:"totalNarratives"`
	DiversificationScore   float64                   `json:"diversificationScore"`
	NarrativeCoverageScore float64                   `json:"narrativeCoverageScore"`
	MarketSentiment        MarketSentiment           `json:"marketSentiment"`
	ProviderStatuses       map[string]ProviderStatus `json:"providerStatuses"`
}

// SeedNarratives contains definitions and asset mappings only. It deliberately
// contains no market scores, lifecycle claims, or fabricated driver metrics.
var SeedNarratives = []Narrative{
	{ID: "ai-agents", Name: "AI Agents", Emoji: "🤖", Description: "Autonomous AI agents operating on-chain, managing protocols, and interacting with DeFi.", Assets: []string{"NEAR", "FET", "RNDR", "GRT", "OCEAN", "AGIX"}},
	{ID: "rwa", Name: "Real World Assets", Emoji: "🏦", Description: "Tokenization of traditional financial assets including bonds, credit, and treasuries.", Assets: []string{"ONDO", "LINK", "MKR", "PAXG"}},
	{ID: "depin", Name: "DePIN", Emoji: "📡", Description: "Decentralized Physical Infrastructure Networks — compute, storage, wireless, and energy.", Assets: []string{"RENDER", "FIL", "AR", "HNT", "THETA", "NEAR", "IO", "AKT", "AIOZ", "WMT", "GRASS"}},
	{ID: "btc-fi", Name: "Bitcoin Ecosystem / BTC-Fi", Emoji: "⚡", Description: "Layer-2s, restaking, and DeFi primitives built natively or anchored on Bitcoin.", Assets: []string{"BTC", "STX", "ORDI", "SATS"}},
	{ID: "l1-chains", Name: "High-Throughput L1s", Emoji: "🚀", Description: "Monolithic, parallelized Layer 1 blockchains competing on raw TPS and latency.", Assets: []string{"SOL", "BNB", "AVAX", "SUI", "APT", "NEAR"}},
	{ID: "eth-l2s", Name: "Ethereum & Modular L2s", Emoji: "🔷", Description: "Ethereum Layer-2 rollups, data availability layers, and modular execution environments.", Assets: []string{"ETH", "ARB", "OP", "MATIC"}},
}

func normalizeSymbol(symbol string) string {
	upper := strings.ToUpper(strings.TrimSpace(symbol))
	if alias, ok := config.Get().AssetAliases[upper]; ok {
		return alias
	}
	return upper
}
func emptySignals() NarrativeSignals {
	return NarrativeSignals{
		Social: Signal{}, Market: Signal{}, Volume: Signal{}, Onchain: Signal{},
		CapitalFlow: Signal{}, Catalyst: Signal{},
	}
}

func compositeScore(signals NarrativeSignals) int {
	cfg := config.Get()
	weights := map[string]float64{
		"market":   cfg.NarrativeMarketWeight,
		"volume":   cfg.NarrativeVolumeWeight,
		"social":   cfg.NarrativeSocialWeight,
		"onchain":  cfg.NarrativeOnchainWeight,
		"catalyst": cfg.NarrativeCatalystWeight,
	}
	values := map[string]Signal{
		"market":   signals.Market,
		"volume":   signals.Volume,
		"social":   signals.Social,
		"onchain":  signals.Onchain,
		"catalyst": signals.Catalyst,
	}
	var total, weight float64
	for name, signal := range values {
		if !signal.Available {
			continue
		}
		total += signal.Score * weights[name]
		weight += weights[name]
	}
	if weight == 0 {
		return 0
	}
	return int(math.Round(total / weight))
}

func lifecycleFor(signals NarrativeSignals, score7dChange float64) string {
	available := 0
	for _, signal := range []Signal{signals.Social, signals.Market, signals.Volume, signals.Onchain, signals.Catalyst} {
		if signal.Available {
			available++
		}
	}
	if available == 0 {
		return "insufficient-data"
	}
	cfg := config.Get()
	directionThreshold := cfg.NarrativeDirectionThreshold
	score := compositeScore(signals)
	if score >= int(cfg.NarrativeCrowdedThreshold) && score7dChange < -directionThreshold {
		return "cooling"
	}
	if score >= int(cfg.NarrativeCrowdedThreshold) {
		return "crowded"
	}
	if score >= int(cfg.NarrativeGrowingThreshold) && score7dChange >= directionThreshold {
		return "growing"
	}
	if score >= int(cfg.NarrativeGrowingThreshold) {
		return "mainstream"
	}
	if score7dChange >= directionThreshold {
		return "emerging"
	}
	return "cooling"
}

func driversFor(signals NarrativeSignals) []string {
	available := []string{}
	for name, signal := range map[string]Signal{
		"market": signals.Market, "volume": signals.Volume, "social attention": signals.Social,
		"on-chain activity": signals.Onchain, "catalyst": signals.Catalyst,
	} {
		if signal.Available {
			available = append(available, name+" signal is based on "+joinSources(signal.Sources)+".")
		}
	}
	if len(available) == 0 {
		return []string{"No free data source is available for this narrative yet."}
	}
	sort.Strings(available)
	return available
}

func signalChangesFromHistory(id string, signals NarrativeSignals, now time.Time) SignalChanges {
	change := func(metric string, current Signal) float64 {
		if !current.Available {
			return 0
		}
		history, err := db.GetNarrativeMetricHistory(id, metric, now)
		if err != nil || !history.Previous24Available {
			return 0
		}
		return current.Score - history.Previous24
	}
	return SignalChanges{
		Social24h:     change("social", signals.Social),
		Volume24h:     change("volume", signals.Volume),
		CapitalFlow7d: 0,
		Onchain7d:     change("onchain", signals.Onchain),
	}
}

func recordSignalScores(id string, signals NarrativeSignals, now time.Time) {
	for metric, signal := range map[string]Signal{
		"social": signals.Social, "market": signals.Market, "volume": signals.Volume,
		"onchain": signals.Onchain, "catalyst": signals.Catalyst,
	} {
		if signal.Available {
			_ = db.RecordNarrativeMetric(id, metric, "signal-engine", signal.Score, now)
		}
	}
}
func joinSources(sources []string) string {
	if len(sources) == 0 {
		return "an unspecified source"
	}
	result := sources[0]
	for _, source := range sources[1:] {
		result += ", " + source
	}
	return result
}

// EvaluateNarratives matches portfolio assets against narrative definitions and
// returns an enriched report. Signal providers can populate the returned
// definitions later; missing signals are never treated as zero-valued evidence.
func EvaluateNarratives(assets []portfolio.Asset) NarrativesReport {
	now := time.Now().UnixMilli()
	heldMap := make(map[string]portfolio.Asset)
	var totalPortfolioUSDT float64
	for _, asset := range assets {
		if asset.Value > 0 {
			heldMap[normalizeSymbol(asset.Symbol)] = asset
			totalPortfolioUSDT += asset.Value
		}
	}

	signalsByNarrative, marketSentiment, providerStatuses := collectFreeSignals()
	enriched := make([]Narrative, 0, len(SeedNarratives))
	coveredCount := 0
	var topNarrative string
	var maxAllocation float64
	for _, seed := range SeedNarratives {
		item := seed
		item.UpdatedAt = now
		item.Signals = signalsByNarrative[item.ID]
		item.Score = compositeScore(item.Signals)
		item.Drivers = driversFor(item.Signals)
		item.SignalChanges = SignalChanges{}

		// Read history before writing the current sample so changes do not compare
		// a value with itself.
		scoreHistory, _ := db.GetNarrativeMetricHistory(item.ID, "score", time.Now())
		if scoreHistory.Previous24Available {
			item.Score24hChange = float64(item.Score) - scoreHistory.Previous24
		}
		if scoreHistory.Previous7dAvailable {
			item.Score7dChange = float64(item.Score) - scoreHistory.Previous7d
		}
		item.Lifecycle = lifecycleFor(item.Signals, item.Score7dChange)
		_ = db.RecordNarrativeMetric(item.ID, "score", "signal-engine", float64(item.Score), time.Now())
		item.SignalChanges = signalChangesFromHistory(item.ID, item.Signals, time.Now())
		recordSignalScores(item.ID, item.Signals, time.Now())

		for _, symbol := range item.Assets {
			if asset, held := heldMap[normalizeSymbol(symbol)]; held {
				item.HeldAssets = append(item.HeldAssets, symbol)
				item.HeldValueUSDT += asset.Value
			}
		}
		if totalPortfolioUSDT > 0 {
			item.HeldAllocation = item.HeldValueUSDT / totalPortfolioUSDT * 100
		}
		if len(item.HeldAssets) > 0 {
			coveredCount++
		}
		if item.HeldAllocation > maxAllocation {
			maxAllocation, topNarrative = item.HeldAllocation, item.Name
		}
		enriched = append(enriched, item)
	}

	sort.Slice(enriched, func(i, j int) bool {
		if enriched[i].HeldAllocation != enriched[j].HeldAllocation {
			return enriched[i].HeldAllocation > enriched[j].HeldAllocation
		}
		return enriched[i].Score > enriched[j].Score
	})

	var divScore float64
	if totalPortfolioUSDT > 0 {
		var assetHHI float64
		for _, asset := range assets {
			if asset.Value > 0 {
				weight := asset.Value / totalPortfolioUSDT
				assetHHI += weight * weight
			}
		}
		divScore = math.Round((1-math.Min(1, assetHHI))*1000) / 10
	}
	coverageScore := math.Round(float64(coveredCount)/float64(len(enriched))*1000) / 10
	if len(enriched) == 0 {
		coverageScore = 0
	}
	return NarrativesReport{Narratives: enriched, TopNarrative: topNarrative, CoveredCount: coveredCount, TotalNarratives: len(enriched), DiversificationScore: divScore, NarrativeCoverageScore: coverageScore, MarketSentiment: marketSentiment, ProviderStatuses: providerStatuses}
}
