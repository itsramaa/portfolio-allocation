package binance

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"portfolio-server/internal/config"
)

type Balance struct {
	Asset  string  `json:"asset"`
	Free   float64 `json:"free"`
	Locked float64 `json:"locked"`
	Total  float64 `json:"total"`
}

type Client struct {
	httpClient *http.Client
	timeOffset int64
	lastSync   int64
	mu         sync.RWMutex
}

var (
	defaultClient *Client
	once          sync.Once
)

// DefaultClient returns the shared Binance client instance.
func DefaultClient() *Client {
	once.Do(func() {
		cfg := config.Get()
		timeoutSec := cfg.BinanceHTTPTimeoutSec
		if timeoutSec <= 0 {
			timeoutSec = 15
		}
		defaultClient = &Client{
			httpClient: &http.Client{
				Timeout: time.Duration(timeoutSec) * time.Second,
			},
		}
	})
	return defaultClient
}

// SyncServerTime calibrates the local clock offset against the Binance server clock.
func (c *Client) SyncServerTime() error {
	cfg := config.Get()
	t0 := time.Now().UnixMilli()

	resp, err := c.httpClient.Get(cfg.BinanceBaseURL + "/api/v3/time")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server time HTTP %d", resp.StatusCode)
	}

	var data struct {
		ServerTime int64 `json:"serverTime"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return err
	}

	t1 := time.Now().UnixMilli()
	rtt := t1 - t0
	offset := (data.ServerTime + rtt/2) - t1

	c.mu.Lock()
	c.timeOffset = offset
	c.lastSync = t1
	c.mu.Unlock()

	return nil
}

func (c *Client) getCalibratedTimestamp() int64 {
	cfg := config.Get()
	now := time.Now().UnixMilli()

	c.mu.RLock()
	needsSync := c.timeOffset == 0 || (now-c.lastSync) > cfg.TimeSyncIntervalMs
	c.mu.RUnlock()

	if needsSync {
		_ = c.SyncServerTime()
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	return time.Now().UnixMilli() + c.timeOffset
}

func hmacSHA256(secret, message string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

func (c *Client) signedGet(baseURL, path string, params url.Values, apiKey, apiSecret string) ([]byte, error) {
	cfg := config.Get()
	if params == nil {
		params = url.Values{}
	}

	params.Set("recvWindow", strconv.FormatInt(cfg.RecvWindowMs, 10))
	params.Set("timestamp", strconv.FormatInt(c.getCalibratedTimestamp(), 10))

	queryStr := params.Encode()
	signature := hmacSHA256(apiSecret, queryStr)
	params.Set("signature", signature)

	fullURL := fmt.Sprintf("%s%s?%s", baseURL, path, params.Encode())

	req, err := http.NewRequest(http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-MBX-APIKEY", apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Code int    `json:"code"`
			Msg  string `json:"msg"`
		}
		_ = json.Unmarshal(body, &apiErr)
		if apiErr.Msg != "" {
			return nil, fmt.Errorf("Binance API error (%d): %s", apiErr.Code, apiErr.Msg)
		}
		return nil, fmt.Errorf("Binance HTTP %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// TestConnection verifies that the provided Binance API credentials are valid.
func (c *Client) TestConnection(apiKey, apiSecret string) error {
	cfg := config.Get()
	_, err := c.signedGet(cfg.BinanceBaseURL, "/api/v3/account", nil, apiKey, apiSecret)
	return err
}

// FetchAllPrices returns all latest symbol prices from Binance ticker.
func (c *Client) FetchAllPrices() (map[string]float64, error) {
	cfg := config.Get()
	resp, err := c.httpClient.Get(cfg.BinanceBaseURL + "/api/v3/ticker/price")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("prices HTTP %d", resp.StatusCode)
	}

	var rawList []struct {
		Symbol string `json:"symbol"`
		Price  string `json:"price"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rawList); err != nil {
		return nil, err
	}

	prices := make(map[string]float64, len(rawList))
	for _, item := range rawList {
		if p, err := strconv.ParseFloat(item.Price, 64); err == nil && p > 0 {
			prices[item.Symbol] = p
		}
	}
	// Stablecoin anchors
	prices["USDTUSDT"] = 1.0
	prices["USDCUSDT"] = 1.0
	prices["FDUSDUSDT"] = 1.0

	return prices, nil
}

// FetchAllBalances aggregates all balances from Spot, Funding, Simple Earn, and Futures accounts.
func (c *Client) FetchAllBalances(apiKey, apiSecret string) (map[string]float64, error) {
	cfg := config.Get()
	balances := make(map[string]float64)
	var mu sync.Mutex

	var wg sync.WaitGroup

	addBalance := func(asset string, amount float64) {
		if amount <= 0 {
			return
		}
		mu.Lock()
		balances[asset] += amount
		mu.Unlock()
	}

	// 1. Spot Balances
	wg.Add(1)
	go func() {
		defer wg.Done()
		body, err := c.signedGet(cfg.BinanceBaseURL, "/api/v3/account", nil, apiKey, apiSecret)
		if err != nil {
			return
		}
		var acc struct {
			Balances []struct {
				Asset  string `json:"asset"`
				Free   string `json:"free"`
				Locked string `json:"locked"`
			} `json:"balances"`
		}
		if err := json.Unmarshal(body, &acc); err == nil {
			for _, b := range acc.Balances {
				free, _ := strconv.ParseFloat(b.Free, 64)
				locked, _ := strconv.ParseFloat(b.Locked, 64)
				addBalance(b.Asset, free+locked)
			}
		}
	}()

	// 2. Funding Balances
	wg.Add(1)
	go func() {
		defer wg.Done()
		body, err := c.signedGet(cfg.BinanceBaseURL, "/sapi/v1/asset/get-funding-asset", nil, apiKey, apiSecret)
		if err != nil {
			return
		}
		var funding []struct {
			Asset  string `json:"asset"`
			Free   string `json:"free"`
			Locked string `json:"locked"`
			Freeze string `json:"freeze"`
		}
		if err := json.Unmarshal(body, &funding); err == nil {
			for _, b := range funding {
				free, _ := strconv.ParseFloat(b.Free, 64)
				locked, _ := strconv.ParseFloat(b.Locked, 64)
				freeze, _ := strconv.ParseFloat(b.Freeze, 64)
				addBalance(b.Asset, free+locked+freeze)
			}
		}
	}()

	// 3. Simple Earn Flexible
	wg.Add(1)
	go func() {
		defer wg.Done()
		params := url.Values{"size": {strconv.Itoa(cfg.SimpleEarnPageSize)}}
		body, err := c.signedGet(cfg.BinanceBaseURL, "/sapi/v1/simple-earn/flexible/position", params, apiKey, apiSecret)
		if err != nil {
			return
		}
		var res struct {
			Rows []struct {
				Asset         string `json:"asset"`
				TotalAmount   string `json:"totalAmount"`
			} `json:"rows"`
		}
		if err := json.Unmarshal(body, &res); err == nil {
			for _, row := range res.Rows {
				amt, _ := strconv.ParseFloat(row.TotalAmount, 64)
				addBalance(row.Asset, amt)
			}
		}
	}()

	// 4. Simple Earn Locked
	wg.Add(1)
	go func() {
		defer wg.Done()
		params := url.Values{"size": {strconv.Itoa(cfg.SimpleEarnPageSize)}}
		body, err := c.signedGet(cfg.BinanceBaseURL, "/sapi/v1/simple-earn/locked/position", params, apiKey, apiSecret)
		if err != nil {
			return
		}
		var res struct {
			Rows []struct {
				Asset  string `json:"asset"`
				Amount string `json:"amount"`
			} `json:"rows"`
		}
		if err := json.Unmarshal(body, &res); err == nil {
			for _, row := range res.Rows {
				amt, _ := strconv.ParseFloat(row.Amount, 64)
				addBalance(row.Asset, amt)
			}
		}
	}()

	// 5. Futures USD-M
	wg.Add(1)
	go func() {
		defer wg.Done()
		body, err := c.signedGet(cfg.BinanceFapiURL, "/fapi/v2/balance", nil, apiKey, apiSecret)
		if err != nil {
			return
		}
		var rows []struct {
			Asset   string `json:"asset"`
			Balance string `json:"balance"`
		}
		if err := json.Unmarshal(body, &rows); err == nil {
			for _, row := range rows {
				if row.Asset == "USDT" {
					bal, _ := strconv.ParseFloat(row.Balance, 64)
					if bal > 0 {
						addBalance("FUTURES_USDT", bal)
					}
				}
			}
		}
	}()

	// 6. Futures Coin-M
	wg.Add(1)
	go func() {
		defer wg.Done()
		body, err := c.signedGet(cfg.BinanceDapiURL, "/dapi/v1/balance", nil, apiKey, apiSecret)
		if err != nil {
			return
		}
		var rows []struct {
			Asset   string `json:"asset"`
			Balance string `json:"balance"`
		}
		if err := json.Unmarshal(body, &rows); err == nil {
			for _, row := range rows {
				bal, _ := strconv.ParseFloat(row.Balance, 64)
				addBalance(row.Asset, bal)
			}
		}
	}()

	wg.Wait()
	return balances, nil
}
