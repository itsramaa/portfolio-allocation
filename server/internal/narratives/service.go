package narratives

import (
	"math"
	"sort"
	"time"

	"portfolio-server/internal/portfolio"
)

type NarrativeSignals struct {
	Social      int `json:"social"`
	Market      int `json:"market"`
	Volume      int `json:"volume"`
	Onchain     int `json:"onchain"`
	CapitalFlow int `json:"capitalFlow"`
	Catalyst    int `json:"catalyst"`
}

type SignalChanges struct {
	Social24h      int `json:"social24h"`
	Volume24h      int `json:"volume24h"`
	CapitalFlow7d  int `json:"capitalFlow7d"`
	Onchain7d      int `json:"onchain7d"`
}

type Narrative struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	Emoji          string           `json:"emoji"`
	Description    string           `json:"description"`
	Lifecycle      string           `json:"lifecycle"` // "emerging", "growing", "crowded", "cooling"
	Score          int              `json:"score"`
	Score24hChange float64          `json:"score24hChange"`
	Score7dChange  float64          `json:"score7dChange"`
	Signals        NarrativeSignals `json:"signals"`
	SignalChanges  SignalChanges    `json:"signalChanges"`
	Assets         []string         `json:"assets"`
	Drivers        []string         `json:"drivers"`
	UpdatedAt      int64            `json:"updatedAt"`

	// Portfolio overlap enriched by backend
	HeldAssets     []string `json:"heldAssets"`
	HeldAllocation float64  `json:"heldAllocation"`
	HeldValueUSDT  float64  `json:"heldValueUSDT"`
}

type NarrativesReport struct {
	Narratives           []Narrative `json:"narratives"`
	TopNarrative         string      `json:"topNarrative"`
	CoveredCount         int         `json:"coveredCount"`
	TotalNarratives      int         `json:"totalNarratives"`
	DiversificationScore float64     `json:"diversificationScore"`
}

var SeedNarratives = []Narrative{
	{
		ID:             "ai-agents",
		Name:           "AI Agents",
		Emoji:          "🤖",
		Description:    "Autonomous AI agents operating on-chain, managing protocols, and interacting with DeFi.",
		Lifecycle:      "growing",
		Score:          87,
		Score24hChange: 8.2,
		Score7dChange:  24.3,
		Signals:        NarrativeSignals{Social: 92, Market: 84, Volume: 79, Onchain: 71, CapitalFlow: 88, Catalyst: 91},
		SignalChanges:  SignalChanges{Social24h: 18, Volume24h: 12, CapitalFlow7d: 51, Onchain7d: 31},
		Assets:         []string{"NEAR", "FET", "RNDR", "GRT", "OCEAN", "AGIX"},
		Drivers: []string{
			"Social mentions increased 82% over the past 7 days.",
			"DEX trading volume for AI-related tokens surged 64% week-over-week.",
			"On-chain activity grew 31% driven by agent deployments.",
		},
	},
	{
		ID:             "rwa",
		Name:           "Real World Assets",
		Emoji:          "🏦",
		Description:    "Tokenization of traditional financial assets including bonds, credit, and treasuries.",
		Lifecycle:      "growing",
		Score:          74,
		Score24hChange: 3.1,
		Score7dChange:  13.2,
		Signals:        NarrativeSignals{Social: 68, Market: 72, Volume: 71, Onchain: 65, CapitalFlow: 82, Catalyst: 78},
		SignalChanges:  SignalChanges{Social24h: 8, Volume24h: 11, CapitalFlow7d: 35, Onchain7d: 22},
		Assets:         []string{"ONDO", "LINK", "MKR", "PAXG"},
		Drivers: []string{
			"Total tokenized RWA on-chain crossed $12B.",
			"Capital flow into RWA protocols increased 35% over 7 days.",
		},
	},
	{
		ID:             "depin",
		Name:           "DePIN",
		Emoji:          "📡",
		Description:    "Decentralized Physical Infrastructure Networks — compute, storage, wireless, and energy.",
		Lifecycle:      "emerging",
		Score:          68,
		Score24hChange: 5.4,
		Score7dChange:  18.7,
		Signals:        NarrativeSignals{Social: 63, Market: 66, Volume: 58, Onchain: 72, CapitalFlow: 65, Catalyst: 84},
		SignalChanges:  SignalChanges{Social24h: 14, Volume24h: 9, CapitalFlow7d: 28, Onchain7d: 42},
		Assets:         []string{"RENDER", "FIL", "AR", "HNT", "THETA", "NEAR"},
		Drivers: []string{
			"Compute demand driving record node onboarding.",
			"Hardware revenue up 44% month-over-month across top networks.",
		},
	},
	{
		ID:             "btc-fi",
		Name:           "Bitcoin Ecosystem / BTC-Fi",
		Emoji:          "⚡",
		Description:    "Layer-2s, restaking, and DeFi primitives built natively or anchored on Bitcoin.",
		Lifecycle:      "growing",
		Score:          79,
		Score24hChange: 4.8,
		Score7dChange:  16.5,
		Signals:        NarrativeSignals{Social: 81, Market: 83, Volume: 77, Onchain: 74, CapitalFlow: 76, Catalyst: 82},
		SignalChanges:  SignalChanges{Social24h: 11, Volume24h: 14, CapitalFlow7d: 38, Onchain7d: 26},
		Assets:         []string{"BTC", "STX", "ORDI", "SATS"},
		Drivers: []string{
			"BTC Layer 2 TVL reached new all-time high.",
			"Institutional staking products gaining traction.",
		},
	},
	{
		ID:             "l1-chains",
		Name:           "High-Throughput L1s",
		Emoji:          "🚀",
		Description:    "Monolithic, parallelized Layer 1 blockchains competing on raw TPS and latency.",
		Lifecycle:      "crowded",
		Score:          82,
		Score24hChange: -1.2,
		Score7dChange:  2.1,
		Signals:        NarrativeSignals{Social: 86, Market: 80, Volume: 88, Onchain: 85, CapitalFlow: 72, Catalyst: 69},
		SignalChanges:  SignalChanges{Social24h: -3, Volume24h: 2, CapitalFlow7d: 8, Onchain7d: 14},
		Assets:         []string{"SOL", "BNB", "AVAX", "SUI", "APT", "NEAR"},
		Drivers: []string{
			"Daily active addresses remain near peaks.",
			"Attention starting to rotate into higher-beta sector plays.",
		},
	},
	{
		ID:             "eth-l2s",
		Name:           "Ethereum & Modular L2s",
		Emoji:          "🔷",
		Description:    "Ethereum Layer-2 rollups, data availability layers, and modular execution environments.",
		Lifecycle:      "cooling",
		Score:          58,
		Score24hChange: -2.3,
		Score7dChange:  -6.8,
		Signals:        NarrativeSignals{Social: 54, Market: 56, Volume: 60, Onchain: 68, CapitalFlow: 51, Catalyst: 55},
		SignalChanges:  SignalChanges{Social24h: -8, Volume24h: -4, CapitalFlow7d: -12, Onchain7d: 6},
		Assets:         []string{"ETH", "ARB", "OP", "MATIC"},
		Drivers: []string{
			"Blob throughput steady but fee compression lowers value capture.",
			"Awaiting major catalyst to reignite institutional inflows.",
		},
	},
}

// EvaluateNarratives matches user portfolio assets against market narratives and returns an enriched report.
func EvaluateNarratives(assets []portfolio.Asset) NarrativesReport {
	now := time.Now().UnixMilli()

	// Map of held asset symbol -> Asset
	heldMap := make(map[string]portfolio.Asset)
	var totalPortfolioUSDT float64
	for _, a := range assets {
		if a.Value > 0 {
			heldMap[a.Symbol] = a
			totalPortfolioUSDT += a.Value
		}
	}

	enriched := make([]Narrative, 0, len(SeedNarratives))
	coveredCount := 0
	var topNarrative string
	var maxAllocation float64

	for _, n := range SeedNarratives {
		item := n
		item.UpdatedAt = now

		var matchedAssets []string
		var narrativeValue float64

		for _, sym := range item.Assets {
			if a, held := heldMap[sym]; held {
				matchedAssets = append(matchedAssets, sym)
				narrativeValue += a.Value
			}
		}

		item.HeldAssets = matchedAssets
		item.HeldValueUSDT = narrativeValue
		if totalPortfolioUSDT > 0 {
			item.HeldAllocation = (narrativeValue / totalPortfolioUSDT) * 100.0
		}

		if len(matchedAssets) > 0 {
			coveredCount++
		}
		if item.HeldAllocation > maxAllocation {
			maxAllocation = item.HeldAllocation
			topNarrative = item.Name
		}

		enriched = append(enriched, item)
	}

	// Sort: higher held allocation first, then by market narrative score
	sort.Slice(enriched, func(i, j int) bool {
		if enriched[i].HeldAllocation != enriched[j].HeldAllocation {
			return enriched[i].HeldAllocation > enriched[j].HeldAllocation
		}
		return enriched[i].Score > enriched[j].Score
	})

	// Diversification score (0 to 100) based on coverage and balance
	var divScore float64
	if len(enriched) > 0 {
		coveragePct := float64(coveredCount) / float64(len(enriched))
		var herfindahl float64
		for _, e := range enriched {
			if e.HeldAllocation > 0 {
				w := e.HeldAllocation / 100.0
				herfindahl += w * w
			}
		}
		balanceFactor := 1.0 - math.Min(1.0, herfindahl)
		divScore = math.Round((coveragePct*50.0 + balanceFactor*50.0) * 10.0) / 10.0
	}

	return NarrativesReport{
		Narratives:           enriched,
		TopNarrative:         topNarrative,
		CoveredCount:         coveredCount,
		TotalNarratives:      len(enriched),
		DiversificationScore: divScore,
	}
}
