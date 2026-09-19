package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all server configuration values.
// Nothing is hardcoded; all values are loaded from environment variables or .env files with sensible defaults.
type Config struct {
	Port                  string
	DataDir               string
	DBPath                string
	JWTSecret             []byte
	DefaultPassword       string
	JWTExpiryHours        int
	BinanceBaseURL        string
	BinanceFapiURL        string
	BinanceDapiURL        string
	BinanceApiKey         string
	BinanceApiSecret      string
	RecvWindowMs          int64
	TimeSyncIntervalMs    int64
	SimpleEarnPageSize    int
	BinanceHTTPTimeoutSec int
	FxEndpoints           []string
	FxHTTPTimeoutSec      int
	AllowedSettingKeys    map[string]bool
	PopularCoins          []string
	DustThresholdUSDT     float64
	ActionThresholdPct    float64
	RebalanceMinTradeUSDT float64
	RebalanceThresholdPct float64
	RebalanceFeeRate      float64
}

var globalConfig *Config

// Load initializes the configuration by reading .env files and environment variables.
func Load() *Config {
	// Attempt to load .env from current directory or parent directory
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	port := getEnv("PORT", "3001")
	dataDir := getEnv("DATA_DIR", "./server/data")

	// If running from inside the server/ directory, normalize ./server/ paths
	if cwd, err := os.Getwd(); err == nil && filepath.Base(cwd) == "server" {
		if strings.HasPrefix(dataDir, "./server/") {
			dataDir = "." + strings.TrimPrefix(dataDir, "./server")
		} else if strings.HasPrefix(dataDir, "server/") {
			dataDir = "./" + strings.TrimPrefix(dataDir, "server/")
		}
	}

	dbPath := getEnv("DB_PATH", dataDir+"/portfolio.db")
	if cwd, err := os.Getwd(); err == nil && filepath.Base(cwd) == "server" {
		if strings.HasPrefix(dbPath, "./server/") {
			dbPath = "." + strings.TrimPrefix(dbPath, "./server")
		} else if strings.HasPrefix(dbPath, "server/") {
			dbPath = "./" + strings.TrimPrefix(dbPath, "server/")
		}
	}

	jwtSecret := getEnv("JWT_SECRET", "portfolio-dev-secret-change-in-prod")
	defaultPassword := getEnv("DEFAULT_PASSWORD", "132456")
	jwtExpiryHours := getEnvInt("JWT_EXPIRY_HOURS", 720)

	binanceBaseURL := getEnv("BINANCE_BASE_URL", "https://api.binance.com")
	binanceFapiURL := getEnv("BINANCE_FAPI_URL", "https://fapi.binance.com")
	binanceDapiURL := getEnv("BINANCE_DAPI_URL", "https://dapi.binance.com")

	binanceApiKey := getEnv("BINANCE_API_KEY", getEnv("VITE_BINANCE_API_KEY", ""))
	binanceApiSecret := getEnv("BINANCE_API_SECRET", getEnv("VITE_BINANCE_API_SECRET", ""))

	recvWindowMs := getEnvInt64("BINANCE_RECV_WINDOW_MS", 5000)
	timeSyncIntervalMs := getEnvInt64("BINANCE_TIME_SYNC_INTERVAL_MS", 300000)
	simpleEarnPageSize := getEnvInt("SIMPLE_EARN_PAGE_SIZE", 100)
	binanceHTTPTimeoutSec := getEnvInt("BINANCE_HTTP_TIMEOUT_SEC", 15)

	fxEndpointsRaw := getEnv(
		"FX_RATE_ENDPOINTS",
		"https://open.er-api.com/v6/latest/USD,https://api.exchangerate-api.com/v4/latest/USD",
	)
	fxEndpoints := strings.Split(fxEndpointsRaw, ",")
	fxHTTPTimeoutSec := getEnvInt("FX_HTTP_TIMEOUT_SEC", 8)

	allowedKeysRaw := getEnv("ALLOWED_SETTING_KEYS", "credentials,targets,archived,currency")
	allowedKeys := make(map[string]bool)
	for _, key := range strings.Split(allowedKeysRaw, ",") {
		trimmed := strings.TrimSpace(key)
		if trimmed != "" {
			allowedKeys[trimmed] = true
		}
	}

	popularCoinsRaw := getEnv(
		"POPULAR_COINS",
		"BTC,ETH,SOL,BNB,DOGE,XRP,ADA,AVAX,DOT,LINK,MATIC,LTC,ATOM,UNI,NEAR,APT,ARB,OP,FDUSD,USDT,USDC,FUTURES_USDT,OTHER",
	)
	popularCoins := strings.Split(popularCoinsRaw, ",")

	dustThresholdUSDT := getEnvFloat64("DUST_THRESHOLD_USDT", 0.50)
	actionThresholdPct := getEnvFloat64("ACTION_THRESHOLD_PCT", 0.50)
	rebalanceMinTradeUSDT := getEnvFloat64("REBALANCE_MIN_TRADE_USDT", 5.0)
	rebalanceThresholdPct := getEnvFloat64("REBALANCE_THRESHOLD_PCT", 1.0)
	rebalanceFeeRate := getEnvFloat64("REBALANCE_FEE_RATE", 0.001)

	globalConfig = &Config{
		Port:                  port,
		DataDir:               dataDir,
		DBPath:                dbPath,
		JWTSecret:             []byte(jwtSecret),
		DefaultPassword:       defaultPassword,
		JWTExpiryHours:        jwtExpiryHours,
		BinanceBaseURL:        binanceBaseURL,
		BinanceFapiURL:        binanceFapiURL,
		BinanceDapiURL:        binanceDapiURL,
		BinanceApiKey:         binanceApiKey,
		BinanceApiSecret:      binanceApiSecret,
		RecvWindowMs:          recvWindowMs,
		TimeSyncIntervalMs:    timeSyncIntervalMs,
		SimpleEarnPageSize:    simpleEarnPageSize,
		BinanceHTTPTimeoutSec: binanceHTTPTimeoutSec,
		FxEndpoints:           fxEndpoints,
		FxHTTPTimeoutSec:      fxHTTPTimeoutSec,
		AllowedSettingKeys:    allowedKeys,
		PopularCoins:          popularCoins,
		DustThresholdUSDT:     dustThresholdUSDT,
		ActionThresholdPct:    actionThresholdPct,
		RebalanceMinTradeUSDT: rebalanceMinTradeUSDT,
		RebalanceThresholdPct: rebalanceThresholdPct,
		RebalanceFeeRate:      rebalanceFeeRate,
	}

	return globalConfig
}

// Get returns the loaded global configuration singleton.
func Get() *Config {
	if globalConfig == nil {
		return Load()
	}
	return globalConfig
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return strings.TrimSpace(v)
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if val, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			return val
		}
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if val, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64); err == nil {
			return val
		}
	}
	return fallback
}

func getEnvFloat64(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if val, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
			return val
		}
	}
	return fallback
}
