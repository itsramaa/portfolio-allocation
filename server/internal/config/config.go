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

	// Narrative provider and scoring configuration.
	CoinGeckoBaseURL                        string
	CoinGeckoAPIKey                         string
	CoinGeckoMarketIDs                      []string
	AlternativeMeFearGreedURL               string
	NarrativeBinanceBaseURL                 string
	NarrativeRSSFeeds                       []string
	RedditRSSURL                            string
	EthereumRPCURL                          string
	BaseRPCURL                              string
	ArbitrumRPCURL                          string
	SolanaRPCURL                            string
	BitcoinAPIURL                           string
	NarrativeHTTPTimeoutSec                 int
	NarrativeCacheMinutes                   int
	NarrativeRefreshMinutes                 int
	NarrativeHistoryRetentionDays           int
	NarrativeMarketWeight                   float64
	NarrativeVolumeWeight                   float64
	NarrativeSocialWeight                   float64
	NarrativeOnchainWeight                  float64
	NarrativeCatalystWeight                 float64
	NarrativeCrowdedThreshold               float64
	NarrativeGrowingThreshold               float64
	NarrativeDirectionThreshold             float64
	NarrativeScoreScale                     float64
	NarrativeScoreBase                      float64
	AssetAliases                            map[string]string
	NarrativeAliases                        map[string][]string
	OnchainNarrativeChains                  map[string]string
	LunarCrushEnabled                       bool
	LunarCrushAPIKey                        string
	LunarCrushBaseURL                       string
	LunarCrushEndpointTemplate              string
	LunarCrushAuthHeader                    string
	LunarCrushSocialScorePath               string
	LunarCrushMentionsPath                  string
	LunarCrushEngagementPath                string
	LunarCrushMentionsBaseline              float64
	LunarCrushEngagementBaseline            float64
	CoinGlassEnabled                        bool
	CoinGlassAPIKey                         string
	CoinGlassBaseURL                        string
	CoinGlassEndpointTemplate               string
	CoinGlassAuthHeader                     string
	CoinGlassOpenInterestPath               string
	CoinGlassFundingRatePath                string
	CoinGlassLiquidationsPath               string
	CoinGlassOpenInterestBaseline           float64
	CoinGlassFundingRateBaseline            float64
	CoinGlassLiquidationsBaseline           float64
	CryptoQuantEnabled                      bool
	CryptoQuantAPIKey                       string
	CryptoQuantBaseURL                      string
	CryptoQuantEndpointTemplate             string
	CryptoQuantExchangeFlowEndpointTemplate string
	CryptoQuantReserveEndpointTemplate      string
	CryptoQuantAuthHeader                   string
	CryptoQuantActiveAddressPath            string
	CryptoQuantExchangeFlowPath             string
	CryptoQuantReservePath                  string
	CryptoQuantActiveAddressBaseline        float64
	CryptoQuantExchangeFlowBaseline         float64
	CryptoQuantReserveBaseline              float64
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

	narrativeMarketIDs := splitCSV(getEnv("NARRATIVE_COINGECKO_MARKET_IDS", "bitcoin,ethereum,solana,binancecoin,avalanche-2,sui,aptos,near,fetch-ai,render-token,the-graph,ocean-protocol,singularitynet,ondo-finance,chainlink,maker,pax-gold,filecoin,arweave,helium,theta-token,stacks,ordinals,arbitrum,optimism,polygon-ecosystem"))
	narrativeRSSFeeds := splitCSV(getEnv("NARRATIVE_RSS_FEEDS", "https://www.reddit.com/r/CryptoCurrency/.rss,https://www.coindesk.com/arc/outboundfeeds/rss/,https://decrypt.co/feed"))
	assetAliases := parseMap(getEnv("NARRATIVE_ASSET_ALIASES", "RNDR=RENDER,MATIC=POL"))
	narrativeAliases := parseListMap(getEnv("NARRATIVE_ALIASES", "ai-agents=AI agents|agentic|Fetch.ai|Artificial Superintelligence|NEAR|Render|RNDR|GRT|OCEAN|AGIX;rwa=real world asset|tokenization|Ondo|ONDO|Chainlink|MKR|PAXG;depin=DePIN|decentralized physical|Render|Filecoin|Arweave|Helium|Theta;btc-fi=Bitcoin|BTC|Ordinals|Stacks|STX;l1-chains=Solana|SOL|BNB Chain|Avalanche|Sui|Aptos|NEAR;eth-l2s=Ethereum|Arbitrum|Optimism|Polygon|rollup|Layer 2|L2"))
	onchainNarrativeChains := parseMap(getEnv("NARRATIVE_ONCHAIN_CHAINS", "eth-l2s=evm-l2,rwa=ethereum,l1-chains=solana,btc-fi=bitcoin"))
	globalConfig = &Config{
		Port:                                    port,
		DataDir:                                 dataDir,
		DBPath:                                  dbPath,
		JWTSecret:                               []byte(jwtSecret),
		DefaultPassword:                         defaultPassword,
		JWTExpiryHours:                          jwtExpiryHours,
		BinanceBaseURL:                          binanceBaseURL,
		BinanceFapiURL:                          binanceFapiURL,
		BinanceDapiURL:                          binanceDapiURL,
		BinanceApiKey:                           binanceApiKey,
		BinanceApiSecret:                        binanceApiSecret,
		RecvWindowMs:                            recvWindowMs,
		TimeSyncIntervalMs:                      timeSyncIntervalMs,
		SimpleEarnPageSize:                      simpleEarnPageSize,
		BinanceHTTPTimeoutSec:                   binanceHTTPTimeoutSec,
		FxEndpoints:                             fxEndpoints,
		FxHTTPTimeoutSec:                        fxHTTPTimeoutSec,
		AllowedSettingKeys:                      allowedKeys,
		PopularCoins:                            popularCoins,
		DustThresholdUSDT:                       dustThresholdUSDT,
		ActionThresholdPct:                      actionThresholdPct,
		RebalanceMinTradeUSDT:                   rebalanceMinTradeUSDT,
		RebalanceThresholdPct:                   rebalanceThresholdPct,
		RebalanceFeeRate:                        rebalanceFeeRate,
		CoinGeckoBaseURL:                        getEnv("COINGECKO_BASE_URL", "https://api.coingecko.com/api/v3"),
		CoinGeckoAPIKey:                         getEnv("COINGECKO_API_KEY", ""),
		CoinGeckoMarketIDs:                      narrativeMarketIDs,
		AlternativeMeFearGreedURL:               getEnv("ALTERNATIVE_ME_FEAR_GREED_URL", "https://api.alternative.me/fng/?limit=1&format=json"),
		NarrativeBinanceBaseURL:                 getEnv("NARRATIVE_BINANCE_BASE_URL", binanceBaseURL),
		NarrativeRSSFeeds:                       narrativeRSSFeeds,
		RedditRSSURL:                            getEnv("REDDIT_RSS_URL", "https://www.reddit.com/r/CryptoCurrency/.rss"),
		EthereumRPCURL:                          getEnv("ETHEREUM_RPC_URL", "https://cloudflare-eth.com"),
		BaseRPCURL:                              getEnv("BASE_RPC_URL", "https://mainnet.base.org"),
		ArbitrumRPCURL:                          getEnv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
		SolanaRPCURL:                            getEnv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"),
		BitcoinAPIURL:                           getEnv("BITCOIN_API_URL", "https://mempool.space/api/v1/blocks"),
		NarrativeHTTPTimeoutSec:                 getEnvInt("NARRATIVE_HTTP_TIMEOUT_SEC", 12),
		NarrativeCacheMinutes:                   getEnvInt("NARRATIVE_CACHE_MINUTES", 5),
		NarrativeRefreshMinutes:                 getEnvInt("NARRATIVE_REFRESH_MINUTES", 15),
		NarrativeHistoryRetentionDays:           getEnvInt("NARRATIVE_HISTORY_RETENTION_DAYS", 30),
		NarrativeMarketWeight:                   getEnvFloat64("NARRATIVE_MARKET_WEIGHT", 0.25),
		NarrativeVolumeWeight:                   getEnvFloat64("NARRATIVE_VOLUME_WEIGHT", 0.25),
		NarrativeSocialWeight:                   getEnvFloat64("NARRATIVE_SOCIAL_WEIGHT", 0.20),
		NarrativeOnchainWeight:                  getEnvFloat64("NARRATIVE_ONCHAIN_WEIGHT", 0.20),
		NarrativeCatalystWeight:                 getEnvFloat64("NARRATIVE_CATALYST_WEIGHT", 0.10),
		NarrativeCrowdedThreshold:               getEnvFloat64("NARRATIVE_CROWDED_THRESHOLD", 75),
		NarrativeGrowingThreshold:               getEnvFloat64("NARRATIVE_GROWING_THRESHOLD", 55),
		NarrativeDirectionThreshold:             getEnvFloat64("NARRATIVE_DIRECTION_THRESHOLD", 5),
		NarrativeScoreScale:                     getEnvFloat64("NARRATIVE_SCORE_SCALE", 2),
		NarrativeScoreBase:                      getEnvFloat64("NARRATIVE_SCORE_BASE", 50),
		AssetAliases:                            assetAliases,
		NarrativeAliases:                        narrativeAliases,
		OnchainNarrativeChains:                  onchainNarrativeChains,
		LunarCrushEnabled:                       getEnvBool("LUNARCRUSH_ENABLED", true),
		LunarCrushAPIKey:                        getEnv("LUNARCRUSH_API_KEY", ""),
		LunarCrushBaseURL:                       getEnv("LUNARCRUSH_BASE_URL", "https://lunarcrush.com/api4"),
		LunarCrushEndpointTemplate:              getEnv("LUNARCRUSH_ENDPOINT_TEMPLATE", "/public/coins/{symbol}/v1"),
		LunarCrushAuthHeader:                    getEnv("LUNARCRUSH_AUTH_HEADER", "Authorization"),
		LunarCrushSocialScorePath:               getEnv("LUNARCRUSH_SOCIAL_SCORE_PATH", "data.0.galaxy_score"),
		LunarCrushMentionsPath:                  getEnv("LUNARCRUSH_MENTIONS_PATH", "data.0.posts_active"),
		LunarCrushEngagementPath:                getEnv("LUNARCRUSH_ENGAGEMENT_PATH", "data.0.interactions"),
		LunarCrushMentionsBaseline:              getEnvFloat64("LUNARCRUSH_MENTIONS_BASELINE", 25),
		LunarCrushEngagementBaseline:            getEnvFloat64("LUNARCRUSH_ENGAGEMENT_BASELINE", 1000),
		CoinGlassEnabled:                        getEnvBool("COINGLASS_ENABLED", true),
		CoinGlassAPIKey:                         getEnv("COINGLASS_API_KEY", ""),
		CoinGlassBaseURL:                        getEnv("COINGLASS_BASE_URL", "https://open-api-v4.coinglass.com"),
		CoinGlassEndpointTemplate:               getEnv("COINGLASS_ENDPOINT_TEMPLATE", "/api/futures/open-interest/exchange-list?symbol={symbol}"),
		CoinGlassAuthHeader:                     getEnv("COINGLASS_AUTH_HEADER", "CG-API-KEY"),
		CoinGlassOpenInterestPath:               getEnv("COINGLASS_OPEN_INTEREST_PATH", "data.0.openInterest"),
		CoinGlassFundingRatePath:                getEnv("COINGLASS_FUNDING_RATE_PATH", ""),
		CoinGlassLiquidationsPath:               getEnv("COINGLASS_LIQUIDATIONS_PATH", ""),
		CoinGlassOpenInterestBaseline:           getEnvFloat64("COINGLASS_OPEN_INTEREST_BASELINE", 10000000),
		CoinGlassFundingRateBaseline:            getEnvFloat64("COINGLASS_FUNDING_RATE_BASELINE", 0.0001),
		CoinGlassLiquidationsBaseline:           getEnvFloat64("COINGLASS_LIQUIDATIONS_BASELINE", 1000000),
		CryptoQuantEnabled:                      getEnvBool("CRYPTOQUANT_ENABLED", true),
		CryptoQuantAPIKey:                       getEnv("CRYPTOQUANT_API_KEY", ""),
		CryptoQuantBaseURL:                      getEnv("CRYPTOQUANT_BASE_URL", "https://api.cryptoquant.com/v1"),
		CryptoQuantEndpointTemplate:             getEnv("CRYPTOQUANT_ENDPOINT_TEMPLATE", "/btc/network-indicator/active-addresses?window=day&limit=1"),
		CryptoQuantExchangeFlowEndpointTemplate: getEnv("CRYPTOQUANT_EXCHANGE_FLOW_ENDPOINT_TEMPLATE", "/btc/exchange-flows/netflow?exchange=all_exchange&window=day&limit=1"),
		CryptoQuantReserveEndpointTemplate:      getEnv("CRYPTOQUANT_RESERVE_ENDPOINT_TEMPLATE", "/btc/exchange-flows/reserve?exchange=all_exchange&window=day&limit=1"),
		CryptoQuantAuthHeader:                   getEnv("CRYPTOQUANT_AUTH_HEADER", "Authorization"),
		CryptoQuantActiveAddressPath:            getEnv("CRYPTOQUANT_ACTIVE_ADDRESS_PATH", "result.data.0.active_addresses"),
		CryptoQuantExchangeFlowPath:             getEnv("CRYPTOQUANT_EXCHANGE_FLOW_PATH", "result.data.0.netflow_total"),
		CryptoQuantReservePath:                  getEnv("CRYPTOQUANT_RESERVE_PATH", "result.data.0.reserve"),
		CryptoQuantActiveAddressBaseline:        getEnvFloat64("CRYPTOQUANT_ACTIVE_ADDRESS_BASELINE", 500000),
		CryptoQuantExchangeFlowBaseline:         getEnvFloat64("CRYPTOQUANT_EXCHANGE_FLOW_BASELINE", 1000),
		CryptoQuantReserveBaseline:              getEnvFloat64("CRYPTOQUANT_RESERVE_BASELINE", 500000),
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

func splitCSV(raw string) []string {
	values := make([]string, 0)
	for _, value := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func parseMap(raw string) map[string]string {
	values := make(map[string]string)
	for _, item := range splitCSV(raw) {
		parts := strings.SplitN(item, "=", 2)
		if len(parts) == 2 && strings.TrimSpace(parts[0]) != "" && strings.TrimSpace(parts[1]) != "" {
			values[strings.ToUpper(strings.TrimSpace(parts[0]))] = strings.ToUpper(strings.TrimSpace(parts[1]))
		}
	}
	return values
}
func parseListMap(raw string) map[string][]string {
	values := make(map[string][]string)
	for _, item := range strings.Split(raw, ";") {
		parts := strings.SplitN(item, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		if key == "" {
			continue
		}
		list := make([]string, 0)
		for _, value := range strings.Split(parts[1], "|") {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				list = append(list, trimmed)
			}
		}
		if len(list) > 0 {
			values[key] = list
		}
	}
	return values
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

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if val, err := strconv.ParseBool(strings.TrimSpace(v)); err == nil {
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
