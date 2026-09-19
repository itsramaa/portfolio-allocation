package fx

import (
	"encoding/json"
	"net/http"
	"time"

	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
)

type FxRatesResponse struct {
	Base        string             `json:"base"`
	Rates       map[string]float64 `json:"rates"`
	LastUpdated int64              `json:"lastUpdated"`
}

// Fallback rates if external APIs fail
var FallbackRates = map[string]float64{
	"USD": 1.0,
	"IDR": 16250.0,
	"EUR": 0.92,
	"GBP": 0.79,
	"JPY": 155.0,
	"SGD": 1.35,
	"AUD": 1.52,
	"CAD": 1.37,
	"CHF": 0.90,
	"CNY": 7.24,
	"HKD": 7.82,
	"KRW": 1380.0,
	"MYR": 4.72,
	"THB": 36.8,
}

// GetRates fetches latest live FX rates with fallback to SQLite cache and defaults.
func GetRates() FxRatesResponse {
	cfg := config.Get()
	timeoutSec := cfg.FxHTTPTimeoutSec
	if timeoutSec <= 0 {
		timeoutSec = 8
	}
	client := &http.Client{Timeout: time.Duration(timeoutSec) * time.Second}

	for _, endpoint := range cfg.FxEndpoints {
		resp, err := client.Get(endpoint)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var data struct {
				Base  string             `json:"base_code"`
				Rates map[string]float64 `json:"rates"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&data); err == nil && len(data.Rates) > 0 {
				rates := make(map[string]float64, len(data.Rates)+len(FallbackRates))
				for k, v := range FallbackRates {
					rates[k] = v
				}
				for k, v := range data.Rates {
					rates[k] = v
				}

				result := FxRatesResponse{
					Base:        "USD",
					Rates:       rates,
					LastUpdated: time.Now().UnixMilli(),
				}

				// Cache in SQLite
				if b, err := json.Marshal(rates); err == nil {
					_, _ = db.DB.Exec(
						`INSERT INTO fxcache (id, rates_json, base, last_updated) VALUES (1, ?, 'USD', ?)
						 ON CONFLICT(id) DO UPDATE SET rates_json = excluded.rates_json, last_updated = excluded.last_updated`,
						string(b), result.LastUpdated,
					)
				}

				return result
			}
		}
	}

	// Read from SQLite cache if live requests failed
	var ratesJSON string
	var lastUpdated int64
	err := db.DB.QueryRow(`SELECT rates_json, last_updated FROM fxcache WHERE id = 1`).Scan(&ratesJSON, &lastUpdated)
	if err == nil && ratesJSON != "" {
		var cached map[string]float64
		if err := json.Unmarshal([]byte(ratesJSON), &cached); err == nil && len(cached) > 0 {
			return FxRatesResponse{
				Base:        "USD",
				Rates:       cached,
				LastUpdated: lastUpdated,
			}
		}
	}

	return FxRatesResponse{
		Base:        "USD",
		Rates:       FallbackRates,
		LastUpdated: time.Now().UnixMilli(),
	}
}
