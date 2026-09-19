package handler

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"portfolio-server/internal/binance"
	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
	"portfolio-server/internal/narratives"
	"portfolio-server/internal/portfolio"
	"portfolio-server/internal/util"

	"github.com/gofiber/fiber/v2"
)

type CredentialPayload struct {
	APIKey    string `json:"apiKey"`
	APISecret string `json:"apiSecret"`
}

func parseStoredCredentials(val string) (*CredentialPayload, error) {
	var creds CredentialPayload
	trimmed := strings.TrimSpace(val)
	if strings.HasPrefix(trimmed, "{") {
		// Legacy plaintext format
		if err := json.Unmarshal([]byte(trimmed), &creds); err == nil && creds.APIKey != "" {
			return &creds, nil
		}
	} else {
		// Encrypted AES-256-GCM format
		cfg := config.Get()
		decrypted, err := util.DecryptAESGCM(trimmed, cfg.JWTSecret)
		if err == nil {
			if err := json.Unmarshal(decrypted, &creds); err == nil && creds.APIKey != "" {
				return &creds, nil
			}
		}
	}
	return nil, errors.New("invalid stored credentials")
}

func getActiveCredentials() (*CredentialPayload, error) {
	cfg := config.Get()

	// 1. Try SQLite database (with AES-GCM decryption)
	val, err := db.GetSetting("credentials")
	if err == nil && val != "" {
		creds, err := parseStoredCredentials(val)
		if err == nil && creds.APIKey != "" {
			return creds, nil
		}
	}

	// 2. Try server environment variables
	if cfg.BinanceApiKey != "" && cfg.BinanceApiSecret != "" {
		return &CredentialPayload{
			APIKey:    cfg.BinanceApiKey,
			APISecret: cfg.BinanceApiSecret,
		}, nil
	}

	return nil, errors.New("no credentials configured")
}

func getActiveTargets() map[string]float64 {
	val, err := db.GetSetting("targets")
	if err == nil && val != "" {
		var t map[string]float64
		if err := json.Unmarshal([]byte(val), &t); err == nil {
			return t
		}
	}
	// Fallback default targets
	return map[string]float64{
		"BTC":  40,
		"ETH":  25,
		"SOL":  15,
		"BNB":  10,
		"NEAR": 10,
	}
}

// SyncPortfolio handles GET /api/portfolio/sync — fetches live Binance data & calculates portfolio
func SyncPortfolio(c *fiber.Ctx) error {
	creds, err := getActiveCredentials()
	if err != nil {
		return c.JSON(fiber.Map{
			"status": "unconfigured",
			"error":  "Binance API key not configured",
		})
	}

	client := binance.DefaultClient()
	prices, err := client.FetchAllPrices()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch ticker prices: " + err.Error(),
		})
	}

	balances, err := client.FetchAllBalances(creds.APIKey, creds.APISecret)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Failed to fetch balances: " + err.Error(),
		})
	}

	targets := getActiveTargets()
	assets := portfolio.BuildAssets(balances, prices, targets)

	var totalUSDT float64
	for _, a := range assets {
		totalUSDT += a.Value
	}
	btcPrice := prices["BTCUSDT"]
	now := time.Now().UnixMilli()

	// Auto-record daily snapshot in SQLite history
	if totalUSDT > 0 {
		dayKey := time.Now().UTC().Format("2006-01-02")
		_, _ = db.DB.Exec(
			`INSERT INTO history (day_key, timestamp, total_usdt, btc_price) VALUES (?, ?, ?, ?)
			 ON CONFLICT(day_key) DO UPDATE SET
			   timestamp  = excluded.timestamp,
			   total_usdt = excluded.total_usdt,
			   btc_price  = excluded.btc_price`,
			dayKey, now, totalUSDT, btcPrice,
		)
	}

	return c.JSON(fiber.Map{
		"status":        "connected",
		"isDemo":        false,
		"assets":        assets,
		"prices":        prices,
		"totalUSDT":     totalUSDT,
		"btcPrice":      btcPrice,
		"lastRefreshed": now,
	})
}

// DemoPortfolio handles GET /api/portfolio/demo — provides simulated portfolio data
func DemoPortfolio(c *fiber.Ctx) error {
	client := binance.DefaultClient()
	prices, err := client.FetchAllPrices()
	if err != nil || len(prices) == 0 {
		prices = portfolio.DemoPrices()
	}

	targets := getActiveTargets()
	assets := portfolio.BuildAssets(portfolio.DemoBalances(), prices, targets)

	var totalUSDT float64
	for _, a := range assets {
		totalUSDT += a.Value
	}
	btcPrice := prices["BTCUSDT"]
	now := time.Now().UnixMilli()

	return c.JSON(fiber.Map{
		"status":        "connected",
		"isDemo":        true,
		"assets":        assets,
		"prices":        prices,
		"totalUSDT":     totalUSDT,
		"btcPrice":      btcPrice,
		"lastRefreshed": now,
	})
}

func validateAssets(assets []portfolio.Asset) error {
	for _, asset := range assets {
		if strings.TrimSpace(asset.Symbol) == "" || asset.Value < 0 || asset.Price < 0 ||
			math.IsNaN(asset.Value) || math.IsInf(asset.Value, 0) ||
			math.IsNaN(asset.Price) || math.IsInf(asset.Price, 0) ||
			math.IsNaN(asset.TargetPct) || math.IsInf(asset.TargetPct, 0) || asset.TargetPct < 0 || asset.TargetPct > 100 {
			return errors.New("invalid asset values")
		}
	}
	return nil
}

func validateTargets(targets map[string]float64) error {
	var total float64
	for symbol, target := range targets {
		if strings.TrimSpace(symbol) == "" || math.IsNaN(target) || math.IsInf(target, 0) || target < 0 || target > 100 {
			return errors.New("invalid target allocation")
		}
		total += target
	}
	if math.Abs(total-100) > 0.000001 {
		return errors.New("target allocations must total 100 percent")
	}
	return nil
}

// CalculateInjection handles POST /api/portfolio/inject
func CalculateInjection(c *fiber.Ctx) error {
	var body struct {
		DepositAmount float64            `json:"depositAmount"`
		Targets       map[string]float64 `json:"targets"`
		Assets        []portfolio.Asset  `json:"assets"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}

	if body.DepositAmount <= 0 || math.IsNaN(body.DepositAmount) || math.IsInf(body.DepositAmount, 0) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "depositAmount must be positive"})
	}

	if body.Targets == nil {
		body.Targets = getActiveTargets()
	}
	if err := validateTargets(body.Targets); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if err := validateAssets(body.Assets); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	res := portfolio.CalculateCashInjection(body.Assets, body.Targets, body.DepositAmount)
	return c.JSON(res)
}

// CalculateRebalance handles POST /api/portfolio/rebalance
func CalculateRebalance(c *fiber.Ctx) error {
	var body struct {
		Assets       []portfolio.Asset `json:"assets"`
		MinTradeUSDT float64           `json:"minTradeUSDT"`
		ThresholdPct float64           `json:"thresholdPct"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}

	if err := validateAssets(body.Assets); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	res := portfolio.CalculateRebalance(body.Assets, body.MinTradeUSDT, body.ThresholdPct)
	return c.JSON(res)
}

// GetNarratives handles GET /api/portfolio/narratives
func GetNarratives(c *fiber.Ctx) error {
	targets := getActiveTargets()

	// Use demo assets if not provided or live data
	client := binance.DefaultClient()
	prices, _ := client.FetchAllPrices()
	if len(prices) == 0 {
		prices = portfolio.DemoPrices()
	}

	var assets []portfolio.Asset
	creds, err := getActiveCredentials()
	if err == nil {
		balances, err := client.FetchAllBalances(creds.APIKey, creds.APISecret)
		if err == nil && len(balances) > 0 {
			assets = portfolio.BuildAssets(balances, prices, targets)
		}
	}

	if len(assets) == 0 {
		assets = portfolio.BuildAssets(portfolio.DemoBalances(), prices, targets)
	}

	report := narratives.EvaluateNarratives(assets)
	return c.JSON(report)
}

// TestBinanceConnection handles POST /api/portfolio/test-connection
func TestBinanceConnection(c *fiber.Ctx) error {
	var creds CredentialPayload
	if err := c.BodyParser(&creds); err != nil || creds.APIKey == "" || creds.APISecret == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"ok":    false,
			"error": "API Key and Secret required",
		})
	}

	client := binance.DefaultClient()
	if err := client.TestConnection(creds.APIKey, creds.APISecret); err != nil {
		return c.JSON(fiber.Map{
			"ok":    false,
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}
