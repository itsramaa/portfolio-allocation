package narratives

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"portfolio-server/internal/config"
)

type providerFieldPaths struct {
	Score           string
	Mentions        string
	Engagement      string
	OpenInterest    string
	FundingRate     string
	Liquidations    string
	ActiveAddresses string
	ExchangeFlow    string
	Reserve         string
}

type optionalProviderMetric struct {
	Path             string
	EndpointTemplate string
	Baseline         float64
	Polarity         float64
	Transform        string
}

type optionalProviderSpec struct {
	Name             string
	Enabled          bool
	APIKey           string
	BaseURL          string
	EndpointTemplate string
	AuthHeader       string
	FieldPaths       providerFieldPaths
	Metrics          []optionalProviderMetric
	Apply            func(*NarrativeSignals, Signal)
}

func applyOptionalProviders(ctx context.Context, client *http.Client, result map[string]NarrativeSignals, statuses map[string]ProviderStatus, updatedAt int64) {
	cfg := config.Get()
	specs := []optionalProviderSpec{
		{
			Name: "lunarcrush", Enabled: cfg.LunarCrushEnabled, APIKey: cfg.LunarCrushAPIKey,
			BaseURL: cfg.LunarCrushBaseURL, EndpointTemplate: cfg.LunarCrushEndpointTemplate, AuthHeader: cfg.LunarCrushAuthHeader,
			FieldPaths: providerFieldPaths{Score: cfg.LunarCrushSocialScorePath, Mentions: cfg.LunarCrushMentionsPath, Engagement: cfg.LunarCrushEngagementPath},
			Metrics: []optionalProviderMetric{
				{Path: cfg.LunarCrushMentionsPath, Baseline: cfg.LunarCrushMentionsBaseline, Polarity: 1, Transform: "log10"},
				{Path: cfg.LunarCrushEngagementPath, Baseline: cfg.LunarCrushEngagementBaseline, Polarity: 1, Transform: "log10"},
			},
			Apply: func(signals *NarrativeSignals, signal Signal) { signals.Social = mergeSignals(signals.Social, signal) },
		},
		{
			Name: "coinglass", Enabled: cfg.CoinGlassEnabled, APIKey: cfg.CoinGlassAPIKey,
			BaseURL: cfg.CoinGlassBaseURL, EndpointTemplate: cfg.CoinGlassEndpointTemplate, AuthHeader: cfg.CoinGlassAuthHeader,
			FieldPaths: providerFieldPaths{OpenInterest: cfg.CoinGlassOpenInterestPath, FundingRate: cfg.CoinGlassFundingRatePath, Liquidations: cfg.CoinGlassLiquidationsPath},
			Metrics: []optionalProviderMetric{
				{Path: cfg.CoinGlassOpenInterestPath, Baseline: cfg.CoinGlassOpenInterestBaseline, Polarity: 1, Transform: "log10"},
				{Path: cfg.CoinGlassFundingRatePath, Baseline: cfg.CoinGlassFundingRateBaseline, Polarity: 1, Transform: "abs"},
				{Path: cfg.CoinGlassLiquidationsPath, Baseline: cfg.CoinGlassLiquidationsBaseline, Polarity: -1, Transform: "log10"},
			},
			Apply: func(signals *NarrativeSignals, signal Signal) { signals.Market = mergeSignals(signals.Market, signal) },
		},
		{
			Name: "cryptoquant", Enabled: cfg.CryptoQuantEnabled, APIKey: cfg.CryptoQuantAPIKey,
			BaseURL: cfg.CryptoQuantBaseURL, EndpointTemplate: cfg.CryptoQuantEndpointTemplate, AuthHeader: cfg.CryptoQuantAuthHeader,
			FieldPaths: providerFieldPaths{ActiveAddresses: cfg.CryptoQuantActiveAddressPath, ExchangeFlow: cfg.CryptoQuantExchangeFlowPath, Reserve: cfg.CryptoQuantReservePath},
			Metrics: []optionalProviderMetric{
				{Path: cfg.CryptoQuantActiveAddressPath, EndpointTemplate: cfg.CryptoQuantEndpointTemplate, Baseline: cfg.CryptoQuantActiveAddressBaseline, Polarity: 1, Transform: "log10"},
				{Path: cfg.CryptoQuantExchangeFlowPath, EndpointTemplate: cfg.CryptoQuantExchangeFlowEndpointTemplate, Baseline: cfg.CryptoQuantExchangeFlowBaseline, Polarity: -1, Transform: "log10"},
				{Path: cfg.CryptoQuantReservePath, EndpointTemplate: cfg.CryptoQuantReserveEndpointTemplate, Baseline: cfg.CryptoQuantReserveBaseline, Polarity: -1, Transform: "log10"},
			},
			Apply: func(signals *NarrativeSignals, signal Signal) {
				signals.Onchain = mergeSignals(signals.Onchain, signal)
			},
		},
	}

	for _, spec := range specs {
		available, errText := applyOptionalProvider(ctx, client, spec, result)
		statuses[spec.Name] = ProviderStatus{Available: available, Source: spec.Name, Error: errText, UpdatedAt: updatedAt}
	}
}

func applyOptionalProvider(ctx context.Context, client *http.Client, spec optionalProviderSpec, result map[string]NarrativeSignals) (bool, string) {
	if !spec.Enabled {
		return false, "disabled"
	}
	if strings.TrimSpace(spec.APIKey) == "" || strings.TrimSpace(spec.BaseURL) == "" || strings.TrimSpace(spec.EndpointTemplate) == "" {
		return false, "missing configuration"
	}
	available := false
	var lastErr string
	for _, narrative := range SeedNarratives {
		values := make([]Signal, 0, len(narrative.Assets))
		for _, asset := range narrative.Assets {
			signal, err := fetchOptionalProviderSignal(ctx, client, spec, normalizeSymbol(asset))
			if err != nil {
				lastErr = err.Error()
				continue
			}
			if signal.Available {
				values = append(values, signal)
			}
		}
		if len(values) == 0 {
			continue
		}
		signal := averageSignals(values, spec.Name)
		signals := result[narrative.ID]
		spec.Apply(&signals, signal)
		result[narrative.ID] = signals
		available = true
	}
	if available {
		return true, ""
	}
	if lastErr == "" {
		lastErr = "no usable data"
	}
	return false, lastErr
}

func fetchOptionalProviderSignal(ctx context.Context, client *http.Client, spec optionalProviderSpec, symbol string) (Signal, error) {
	values := make([]float64, 0)
	var lastErr error
	payload, err := fetchOptionalProviderPayload(ctx, client, spec, symbol, spec.EndpointTemplate)
	if err != nil {
		lastErr = err
	} else if signal := optionalPayloadSignal(spec.Name, spec, payload); signal.Available {
		values = append(values, signal.Score)
	}

	for _, metric := range spec.Metrics {
		if strings.TrimSpace(metric.EndpointTemplate) == "" || metric.EndpointTemplate == spec.EndpointTemplate {
			continue
		}
		metricPayload, err := fetchOptionalProviderPayload(ctx, client, spec, symbol, metric.EndpointTemplate)
		if err != nil {
			lastErr = err
			continue
		}
		if score, ok := normalizedProviderMetric(metricPayload, metric); ok {
			values = append(values, score)
		}
	}
	if len(values) > 0 {
		return Signal{Score: clampScore(mean(values)), Available: true, Confidence: .6, Sources: []string{spec.Name}}, nil
	}
	if lastErr != nil {
		return Signal{}, lastErr
	}
	return Signal{}, nil
}

func fetchOptionalProviderPayload(ctx context.Context, client *http.Client, spec optionalProviderSpec, symbol string, endpointTemplate string) (any, error) {
	endpoint := strings.TrimRight(spec.BaseURL, "/") + "/" + strings.TrimLeft(endpointTemplate, "/")
	endpoint = strings.ReplaceAll(endpoint, "{symbol}", url.QueryEscape(symbol))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if spec.AuthHeader != "" {
		value := spec.APIKey
		if strings.EqualFold(spec.AuthHeader, "Authorization") && !strings.HasPrefix(strings.ToLower(value), "bearer ") {
			value = "Bearer " + value
		}
		req.Header.Set(spec.AuthHeader, value)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("rate limited")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var payload any
	if err := json.NewDecoder(http.MaxBytesReader(nil, resp.Body, 4<<20)).Decode(&payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func optionalPayloadSignal(source string, spec optionalProviderSpec, payload any) Signal {
	paths := spec.FieldPaths
	if paths.Score != "" {
		if value, ok := jsonNumber(payload, paths.Score); ok {
			return Signal{Score: clampScore(value), Available: true, Confidence: .75, Sources: []string{source}}
		}
	}
	values := make([]float64, 0)
	for _, metric := range spec.Metrics {
		if score, ok := normalizedProviderMetric(payload, metric); ok {
			values = append(values, score)
		}
	}
	if len(values) == 0 {
		return Signal{}
	}
	return Signal{Score: clampScore(mean(values)), Available: true, Confidence: .6, Sources: []string{source}}
}

func normalizedProviderMetric(payload any, metric optionalProviderMetric) (float64, bool) {
	if strings.TrimSpace(metric.Path) == "" {
		return 0, false
	}
	value, ok := jsonNumber(payload, metric.Path)
	if !ok || value == 0 || metric.Baseline <= 0 {
		return 0, false
	}
	magnitude := value / metric.Baseline
	switch metric.Transform {
	case "abs":
		magnitude = math.Abs(value) / metric.Baseline
	case "log10":
		magnitude = math.Log10(math.Max(value, 0)+1) / math.Log10(metric.Baseline+1)
	}
	if magnitude <= 0 {
		return 0, false
	}
	polarity := metric.Polarity
	if polarity == 0 {
		polarity = 1
	}
	return clampScore(50 + polarity*(magnitude-1)*35), true
}

func jsonNumber(payload any, path string) (float64, bool) {
	if strings.TrimSpace(path) == "" {
		return 0, false
	}
	current := payload
	for _, part := range strings.Split(path, ".") {
		part = strings.TrimSpace(part)
		if part == "" {
			return 0, false
		}
		switch node := current.(type) {
		case map[string]any:
			value, ok := node[part]
			if !ok {
				return 0, false
			}
			current = value
		case []any:
			idx, err := strconv.Atoi(part)
			if err != nil || idx < 0 || idx >= len(node) {
				return 0, false
			}
			current = node[idx]
		default:
			return 0, false
		}
	}
	switch value := current.(type) {
	case float64:
		return value, true
	case string:
		parsed, err := strconv.ParseFloat(value, 64)
		return parsed, err == nil
	case json.Number:
		parsed, err := value.Float64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func averageSignals(signals []Signal, source string) Signal {
	var score, confidence, change24h, change7d float64
	for _, signal := range signals {
		score += signal.Score
		confidence += signal.Confidence
		change24h += signal.Change24h
		change7d += signal.Change7d
	}
	count := float64(len(signals))
	return Signal{Score: clampScore(score / count), Available: true, Confidence: confidence / count, Change24h: change24h / count, Change7d: change7d / count, Sources: []string{source}}
}

func mergeSignals(left, right Signal) Signal {
	if !left.Available {
		return right
	}
	if !right.Available {
		return left
	}
	leftWeight := math.Max(.1, left.Confidence)
	rightWeight := math.Max(.1, right.Confidence)
	total := leftWeight + rightWeight
	return Signal{
		Score:      clampScore((left.Score*leftWeight + right.Score*rightWeight) / total),
		Available:  true,
		Confidence: math.Min(1, (left.Confidence+right.Confidence)/2+.1),
		Change24h:  (left.Change24h*leftWeight + right.Change24h*rightWeight) / total,
		Change7d:   (left.Change7d*leftWeight + right.Change7d*rightWeight) / total,
		Sources:    uniqueStrings(append(left.Sources, right.Sources...)),
	}
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}
