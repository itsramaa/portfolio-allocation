package narratives

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
)

type ProviderStatus struct {
	Available bool   `json:"available"`
	Source    string `json:"source"`
	Error     string `json:"error,omitempty"`
	UpdatedAt int64  `json:"updatedAt"`
}

type freeProviderCache struct {
	mu        sync.Mutex
	expiresAt time.Time
	signals   map[string]NarrativeSignals
	sentiment MarketSentiment
	statuses  map[string]ProviderStatus
}

var providerCache freeProviderCache

var onchainState = struct {
	mu       sync.Mutex
	current  map[string]float64
	previous map[string]float64
}{current: make(map[string]float64), previous: make(map[string]float64)}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
}

type MarketSentiment struct {
	Value          int    `json:"value"`
	Classification string `json:"classification"`
	Available      bool   `json:"available"`
	Source         string `json:"source"`
	UpdatedAt      int64  `json:"updatedAt"`
}

type freeMarket struct {
	Symbol        string  `json:"symbol"`
	CurrentPrice  float64 `json:"current_price"`
	MarketCap     float64 `json:"market_cap"`
	TotalVolume   float64 `json:"total_volume"`
	PriceChange24 float64 `json:"price_change_percentage_24h_in_currency"`
	PriceChange7  float64 `json:"price_change_percentage_7d_in_currency"`
}

type fearGreedResponse struct {
	Data []struct {
		Value               string `json:"value"`
		ValueClassification string `json:"value_classification"`
	} `json:"data"`
}

type rssFeed struct {
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
	Entries []rssItem `xml:"entry"`
}
type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	Published   string `xml:"published"`
}

func marketForSymbol(markets map[string]freeMarket, symbol string) (freeMarket, bool) {
	cfg := config.Get()
	if alias, ok := cfg.AssetAliases[strings.ToUpper(symbol)]; ok {
		symbol = alias
	}
	market, ok := markets[strings.ToUpper(symbol)]
	return market, ok
}

func httpJSON(ctx context.Context, client *http.Client, endpoint string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "portfolio-allocation/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("provider returned HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(target)
}

func collectFreeSignals() (map[string]NarrativeSignals, MarketSentiment, map[string]ProviderStatus) {
	providerCache.mu.Lock()
	defer providerCache.mu.Unlock()
	cfg := config.Get()
	if time.Now().Before(providerCache.expiresAt) && providerCache.signals != nil {
		return providerCache.signals, providerCache.sentiment, providerCache.statuses
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.NarrativeHTTPTimeoutSec)*time.Second)
	defer cancel()
	client := &http.Client{Timeout: 10 * time.Second}
	result := make(map[string]NarrativeSignals, len(SeedNarratives))
	for _, narrative := range SeedNarratives {
		result[narrative.ID] = emptySignals()
	}

	markets := fetchCoinGeckoMarkets(ctx, client)
	coingeckoAvailable := len(markets) > 0
	binanceMarkets := fetchBinanceMarkets(ctx, client)
	binanceVolumes := make(map[string]float64, len(binanceMarkets))
	for symbol, market := range binanceMarkets {
		binanceVolumes[symbol] = market.TotalVolume
		if _, exists := markets[symbol]; !exists {
			markets[symbol] = market
		}
	}
	volumeHistory := recordAndLoadVolumeHistory(markets, binanceVolumes, time.Now())
	statuses := map[string]ProviderStatus{}
	updatedAt := time.Now().UnixMilli()
	statuses["coingecko"] = ProviderStatus{Available: coingeckoAvailable, Source: "CoinGecko Demo API", UpdatedAt: updatedAt}
	statuses["binance"] = ProviderStatus{Available: len(binanceVolumes) > 0, Source: "Binance public API", UpdatedAt: updatedAt}
	applyMarketDerivedSignals(result, markets, binanceVolumes, volumeHistory)
	applyAttentionSignals(ctx, client, result)
	rssAvailable := false
	for _, signals := range result {
		if signals.Social.Available || signals.Catalyst.Available {
			rssAvailable = true
			break
		}
	}
	statuses["rss"] = ProviderStatus{Available: rssAvailable, Source: "public RSS and Reddit RSS", UpdatedAt: updatedAt}
	applyOnchainSignals(ctx, client, result)
	onchainAvailable := false
	for _, signals := range result {
		if signals.Onchain.Available {
			onchainAvailable = true
			break
		}
	}
	statuses["public-rpc"] = ProviderStatus{Available: onchainAvailable, Source: "Ethereum, Base, Arbitrum, Solana and Bitcoin public endpoints", UpdatedAt: updatedAt}
	sentiment := fetchFearGreed(ctx, client)
	statuses["alternative-me"] = ProviderStatus{Available: sentiment.Available, Source: "Alternative.me", UpdatedAt: updatedAt}
	applyOptionalProviders(ctx, client, result, statuses, updatedAt)
	// Fear & Greed stays market-wide context and is intentionally not copied
	// into any narrative signal.
	providerCache.signals, providerCache.sentiment, providerCache.statuses = result, sentiment, statuses
	providerCache.expiresAt = time.Now().Add(time.Duration(cfg.NarrativeCacheMinutes) * time.Minute)
	return result, sentiment, statuses
}

func fetchCoinGeckoMarkets(ctx context.Context, client *http.Client) map[string]freeMarket {
	cfg := config.Get()
	ids := cfg.CoinGeckoMarketIDs
	endpoint := cfg.CoinGeckoBaseURL + "/coins/markets?vs_currency=usd&price_change_percentage=24h%2C7d&per_page=250&ids=" + url.QueryEscape(strings.Join(ids, ","))
	if key := strings.TrimSpace(cfg.CoinGeckoAPIKey); key != "" {
		endpoint += "&x_cg_demo_api_key=" + url.QueryEscape(key)
	}
	var rows []freeMarket
	if err := httpJSON(ctx, client, endpoint, &rows); err != nil {
		return map[string]freeMarket{}
	}
	markets := make(map[string]freeMarket, len(rows))
	for _, row := range rows {
		markets[strings.ToUpper(row.Symbol)] = row
	}
	return markets
}

type binanceTicker struct {
	Symbol             string  `json:"symbol"`
	QuoteVolume        float64 `json:"quoteVolume,string"`
	PriceChangePercent float64 `json:"priceChangePercent,string"`
}

func fetchBinanceMarkets(ctx context.Context, client *http.Client) map[string]freeMarket {
	cfg := config.Get()
	symbols := make([]string, 0)
	seen := make(map[string]bool)
	for _, narrative := range SeedNarratives {
		for _, asset := range narrative.Assets {
			symbol := strings.ToUpper(asset) + "USDT"
			if alias, ok := cfg.AssetAliases[strings.ToUpper(asset)]; ok {
				symbol = alias + "USDT"
			}
			if !seen[symbol] {
				seen[symbol] = true
				symbols = append(symbols, symbol)
			}
		}
	}
	wanted := make(map[string]bool)
	for _, symbol := range symbols {
		wanted[strings.TrimSuffix(symbol, "USDT")] = true
	}
	// Fetch all public 24h tickers and filter locally so an unsupported asset
	// does not invalidate the entire Binance response.
	endpoint := cfg.NarrativeBinanceBaseURL + "/api/v3/ticker/24hr"
	var rows []binanceTicker
	if err := httpJSON(ctx, client, endpoint, &rows); err != nil {
		return map[string]freeMarket{}
	}
	markets := make(map[string]freeMarket, len(rows))
	for _, row := range rows {
		symbol := strings.TrimSuffix(strings.ToUpper(row.Symbol), "USDT")
		if !wanted[symbol] {
			continue
		}
		markets[symbol] = freeMarket{
			Symbol:        symbol,
			TotalVolume:   row.QuoteVolume,
			PriceChange24: row.PriceChangePercent,
			PriceChange7:  row.PriceChangePercent,
		}
	}
	return markets
}

func quotedSymbols(symbols []string) []string {
	quoted := make([]string, len(symbols))
	for i, symbol := range symbols {
		quoted[i] = `"` + symbol + `"`
	}
	return quoted
}
func marketSignal(n Narrative, markets map[string]freeMarket) Signal {
	var changes []float64
	for _, symbol := range n.Assets {
		if market, ok := marketForSymbol(markets, symbol); ok {
			changes = append(changes, market.PriceChange24*.4+market.PriceChange7*.6)
		}
	}
	if len(changes) == 0 {
		return Signal{}
	}
	cfg := config.Get()
	average := mean(changes)
	return Signal{Score: clampScore(cfg.NarrativeScoreBase + average*cfg.NarrativeScoreScale), Available: true, Confidence: confidence(len(changes), len(n.Assets)), Change24h: average, Change7d: average, Sources: []string{"coingecko"}}
}

type narrativeMarketMetrics struct {
	volume, attention, flow, catalyst float64
	observed                          bool
}

func applyMarketDerivedSignals(result map[string]NarrativeSignals, markets map[string]freeMarket, binanceVolumes map[string]float64, volumeHistory map[string]db.NarrativeMetricHistory) {
	// These are transparent public-market proxies, not claims about social activity,
	// capital flows, or news events. They keep the detail panel useful on the
	// first run, before RSS and historical samples are available.
	values := make(map[string]narrativeMarketMetrics, len(SeedNarratives))
	for _, narrative := range SeedNarratives {
		var m narrativeMarketMetrics
		var count float64
		var marketCap float64
		for _, symbol := range narrative.Assets {
			market, ok := marketForSymbol(markets, symbol)
			if !ok {
				if volume, found := binanceVolumes[normalizeSymbol(symbol)]; found {
					m.volume += volume
				}
				continue
			}
			count++
			m.volume += market.TotalVolume
			marketCap += market.MarketCap
			turnover := 0.0
			if market.MarketCap > 0 {
				turnover = market.TotalVolume / market.MarketCap
			}
			m.attention += turnover + math.Abs(market.PriceChange24)/100
			m.flow += market.MarketCap * (market.PriceChange24 / 100)
			m.catalyst += market.PriceChange24*.4 + market.PriceChange7*.6
		}
		if count > 0 {
			m.observed = true
			m.attention /= count
			m.catalyst /= count
		}
		if marketCap > 0 {
			m.flow /= marketCap
		}
		values[narrative.ID] = m
	}

	volumeBaseline := positiveMedian(values, func(m narrativeMarketMetrics) float64 { return m.volume })
	attentionBaseline := positiveMedian(values, func(m narrativeMarketMetrics) float64 { return m.attention })
	for _, narrative := range SeedNarratives {
		signals := result[narrative.ID]
		m := values[narrative.ID]
		if !signals.Market.Available {
			signals.Market = marketSignal(narrative, markets)
		}
		if !signals.Volume.Available {
			signals.Volume = volumeSignal(narrative, markets, binanceVolumes, volumeHistory[narrative.ID])
		}
		if !signals.Volume.Available && m.volume > 0 && volumeBaseline > 0 {
			signals.Volume = proxySignal(m.volume, volumeBaseline, "market-data-volume-proxy")
		}
		if !signals.Social.Available && m.attention > 0 && attentionBaseline > 0 {
			signals.Social = proxySignal(m.attention, attentionBaseline, "market-data-attention-proxy")
		}
		if !signals.Onchain.Available && m.volume > 0 && volumeBaseline > 0 {
			signals.Onchain = proxySignal(m.volume, volumeBaseline, "market-data-activity-proxy")
		}
		if !signals.CapitalFlow.Available && m.observed {
			signals.CapitalFlow = Signal{Score: clampScore(config.Get().NarrativeScoreBase + m.flow*100), Available: true, Confidence: .35, Change24h: m.flow * 100, Sources: []string{"market-data-capital-flow-proxy"}}
		}
		if !signals.Catalyst.Available && m.observed {
			signals.Catalyst = Signal{Score: clampScore(config.Get().NarrativeScoreBase + m.catalyst*config.Get().NarrativeScoreScale), Available: true, Confidence: .3, Change24h: m.catalyst, Change7d: m.catalyst, Sources: []string{"market-data-momentum-proxy"}}
		}
		result[narrative.ID] = signals
	}
}

func positiveMedian(values map[string]narrativeMarketMetrics, pick func(narrativeMarketMetrics) float64) float64 {
	items := make([]float64, 0, len(values))
	for _, value := range values {
		if selected := pick(value); selected > 0 {
			items = append(items, selected)
		}
	}
	if len(items) == 0 {
		return 0
	}
	sort.Float64s(items)
	middle := len(items) / 2
	if len(items)%2 == 0 {
		return (items[middle-1] + items[middle]) / 2
	}
	return items[middle]
}

func proxySignal(value, baseline float64, source string) Signal {
	if value <= 0 || baseline <= 0 {
		return Signal{}
	}
	return Signal{Score: clampScore(config.Get().NarrativeScoreBase + math.Log(value/baseline)*20), Available: true, Confidence: .3, Sources: []string{source}}
}
func recordAndLoadVolumeHistory(markets map[string]freeMarket, binanceVolumes map[string]float64, now time.Time) map[string]db.NarrativeMetricHistory {
	history := make(map[string]db.NarrativeMetricHistory, len(SeedNarratives))
	for _, narrative := range SeedNarratives {
		var total float64
		for _, symbol := range narrative.Assets {
			if market, ok := marketForSymbol(markets, symbol); ok {
				total += market.TotalVolume
			} else if volume, ok := binanceVolumes[strings.ToUpper(symbol)]; ok {
				total += volume
			}
		}
		if metric, err := db.GetNarrativeMetricHistory(narrative.ID, "volume_usd", now); err == nil {
			history[narrative.ID] = metric
		}
		if total > 0 {
			_ = db.RecordNarrativeMetric(narrative.ID, "volume_usd", "coingecko+binance", total, now)
		}
	}
	return history
}
func volumeSignal(n Narrative, markets map[string]freeMarket, binanceVolumes map[string]float64, history db.NarrativeMetricHistory) Signal {
	var current float64
	for _, symbol := range n.Assets {
		if market, ok := marketForSymbol(markets, symbol); ok {
			current += market.TotalVolume
		} else if volume, ok := binanceVolumes[strings.ToUpper(symbol)]; ok {
			current += volume
		}
	}
	if current <= 0 || history.Average7d <= 0 || history.Samples7d < 2 || history.Oldest7d == 0 || time.Since(time.UnixMilli(history.Oldest7d)) < 7*24*time.Hour {
		return Signal{}
	}
	cfg := config.Get()
	acceleration := (current/history.Average7d - 1) * 100
	return Signal{Score: clampScore(cfg.NarrativeScoreBase + acceleration), Available: true, Confidence: math.Min(.9, .45+float64(history.Samples7d)/20), Change24h: acceleration, Change7d: acceleration, Sources: []string{"coingecko", "sqlite-history"}}
}

func applyAttentionSignals(ctx context.Context, client *http.Client, result map[string]NarrativeSignals) {
	cfg := config.Get()
	feeds := cfg.NarrativeRSSFeeds
	items := make([]rssItem, 0)
	for _, feed := range feeds {
		var parsed rssFeed
		if err := fetchRSS(ctx, client, feed, &parsed); err == nil {
			items = append(items, parsed.Channel.Items...)
			items = append(items, parsed.Entries...)
		}
	}
	unique := make(map[string]rssItem, len(items))
	for _, item := range items {
		key := strings.TrimSpace(item.Link)
		if key == "" {
			key = strings.ToLower(strings.TrimSpace(item.Title))
		}
		if key != "" {
			unique[key] = item
		}
	}
	items = items[:0]
	for _, item := range unique {
		items = append(items, item)
	}
	now := time.Now()
	for id, signals := range result {
		mentions24, mentions7, catalyst := 0, 0, 0
		for _, item := range items {
			if !matchesNarrative(item.Title+" "+item.Description, id) {
				continue
			}
			published := parseRSSDate(item.PubDate, item.Published)
			if published.IsZero() || now.Sub(published) < 24*time.Hour {
				mentions24++
			}
			if published.IsZero() || now.Sub(published) < 7*24*time.Hour {
				mentions7++
			}
			if !published.IsZero() && now.Sub(published) < 72*time.Hour {
				catalyst++
			}
		}
		if mentions7 > 0 {
			attention := clampScore(float64(mentions24)*12 + float64(mentions7)*2)
			change := float64(mentions24) / math.Max(1, float64(mentions7)/7) * 100
			signals.Social = Signal{Score: attention, Available: true, Confidence: .45, Change24h: change, Change7d: float64(mentions7), Sources: []string{"rss", "reddit"}}
		}
		if catalyst > 0 {
			signals.Catalyst = Signal{Score: clampScore(float64(catalyst)*15 + 35), Available: true, Confidence: .4, Change24h: float64(catalyst), Sources: []string{"rss"}}
		}
		result[id] = signals
	}
}

func applyOnchainSignals(ctx context.Context, client *http.Client, result map[string]NarrativeSignals) {
	// Public RPC endpoints are intentionally used without API keys. A signal is
	// emitted only after two observations, so a raw transaction count is never
	// presented as an on-chain score without a historical comparison.
	cfg := config.Get()
	snapshots := map[string]float64{}
	if value, ok := fetchEthereumActivity(ctx, client, cfg.EthereumRPCURL); ok {
		snapshots["ethereum"] = value
	}
	if value, ok := fetchEthereumActivity(ctx, client, cfg.BaseRPCURL); ok {
		snapshots["base"] = value
	}
	if value, ok := fetchEthereumActivity(ctx, client, cfg.ArbitrumRPCURL); ok {
		snapshots["arbitrum"] = value
	}
	if value, ok := fetchSolanaActivity(ctx, client, cfg.SolanaRPCURL); ok {
		snapshots["solana"] = value
	}
	if value, ok := fetchBitcoinActivity(ctx, client); ok {
		snapshots["bitcoin"] = value
	}
	if len(snapshots) >= 3 {
		var total float64
		for _, chain := range []string{"ethereum", "base", "arbitrum"} {
			total += snapshots[chain]
		}
		snapshots["evm-l2"] = total / 3
	}

	chainValues := make([]float64, 0, len(snapshots))
	for _, value := range snapshots {
		if value > 0 {
			chainValues = append(chainValues, value)
		}
	}
	sort.Float64s(chainValues)
	var chainBaseline float64
	if len(chainValues) > 0 {
		middle := len(chainValues) / 2
		chainBaseline = chainValues[middle]
		if len(chainValues)%2 == 0 {
			chainBaseline = (chainValues[middle-1] + chainValues[middle]) / 2
		}
	}
	for chain, value := range snapshots {
		metric := "onchain_" + chain
		history, _ := db.GetNarrativeMetricHistory("network:"+chain, metric, time.Now())
		_ = db.RecordNarrativeMetric("network:"+chain, metric, "public-rpc", value, time.Now())
		if !history.Previous24Available || history.Previous24 <= 0 {
			for id, narrativeChain := range cfg.OnchainNarrativeChains {
				if narrativeChain == chain && chainBaseline > 0 {
					signals := result[id]
					signals.Onchain = proxySignal(value, chainBaseline, "public-rpc-activity-proxy")
					result[id] = signals
				}
			}
			continue
		}
		change24 := (value/history.Previous24 - 1) * 100
		change7 := float64(0)
		if history.Previous7dAvailable && history.Previous7d > 0 {
			change7 = (value/history.Previous7d - 1) * 100
		}
		for id, narrativeChain := range cfg.OnchainNarrativeChains {
			if narrativeChain != chain {
				continue
			}
			signals := result[id]
			cfg := config.Get()
			signals.Onchain = Signal{Score: clampScore(cfg.NarrativeScoreBase + change7), Available: history.Previous7dAvailable, Confidence: .55, Change24h: change24, Change7d: change7, Sources: []string{"public-rpc", chain, "sqlite-history"}}
			result[id] = signals
		}
	}
}

func fetchEthereumActivity(ctx context.Context, client *http.Client, endpoint string) (float64, bool) {
	var block rpcResponse
	request := rpcRequest{JSONRPC: "2.0", ID: 1, Method: "eth_getBlockByNumber", Params: []any{"latest", false}}
	if err := postRPC(ctx, client, endpoint, request, &block); err != nil || len(block.Result) == 0 {
		return 0, false
	}
	var value struct {
		Transactions []json.RawMessage `json:"transactions"`
	}
	if json.Unmarshal(block.Result, &value) != nil {
		return 0, false
	}
	return float64(len(value.Transactions)), true
}

func fetchBitcoinActivity(ctx context.Context, client *http.Client) (float64, bool) {
	cfg := config.Get()
	var blocks []struct {
		TxCount int `json:"tx_count"`
	}
	if err := httpJSON(ctx, client, cfg.BitcoinAPIURL, &blocks); err != nil || len(blocks) == 0 {
		return 0, false
	}
	var total int
	for _, block := range blocks {
		total += block.TxCount
	}
	return float64(total), true
}
func fetchSolanaActivity(ctx context.Context, client *http.Client, endpoint string) (float64, bool) {
	var response struct {
		Result []struct {
			NumTransactions int `json:"numTransactions"`
		} `json:"result"`
	}
	request := rpcRequest{JSONRPC: "2.0", ID: 1, Method: "getRecentPerformanceSamples", Params: []any{1}}
	if err := postRPC(ctx, client, endpoint, request, &response); err != nil || len(response.Result) == 0 {
		return 0, false
	}
	return float64(response.Result[0].NumTransactions), true
}

func postRPC(ctx context.Context, client *http.Client, endpoint string, payload rpcRequest, target any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("rpc returned HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(target)
}
func fetchRSS(ctx context.Context, client *http.Client, endpoint string, target *rssFeed) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "portfolio-allocation/1.0 RSS reader")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("rss returned HTTP %d", resp.StatusCode)
	}
	return xml.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(target)
}

func fetchFearGreed(ctx context.Context, client *http.Client) MarketSentiment {
	cfg := config.Get()
	var response fearGreedResponse
	if err := httpJSON(ctx, client, cfg.AlternativeMeFearGreedURL, &response); err != nil || len(response.Data) == 0 {
		return MarketSentiment{}
	}
	value, err := strconv.Atoi(response.Data[0].Value)
	if err != nil {
		return MarketSentiment{}
	}
	return MarketSentiment{Value: value, Classification: response.Data[0].ValueClassification, Available: true, Source: "alternative.me", UpdatedAt: time.Now().UnixMilli()}
}

func matchesNarrative(text, id string) bool {
	text = strings.ToLower(text)
	for _, alias := range config.Get().NarrativeAliases[id] {
		if strings.Contains(text, strings.ToLower(alias)) {
			return true
		}
	}
	return false
}

func parseRSSDate(values ...string) time.Time {
	layouts := []string{time.RFC1123Z, time.RFC1123, time.RFC3339, time.RFC822Z, time.RFC822}
	for _, value := range values {
		for _, layout := range layouts {
			if parsed, err := time.Parse(layout, strings.TrimSpace(value)); err == nil {
				return parsed
			}
		}
	}
	return time.Time{}
}

func mean(values []float64) float64 {
	var total float64
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}
func clampScore(value float64) float64 { return math.Max(0, math.Min(100, math.Round(value*10)/10)) }
func confidence(found, total int) float64 {
	if total == 0 {
		return 0
	}
	return math.Min(1, .35+.65*float64(found)/float64(total))
}
