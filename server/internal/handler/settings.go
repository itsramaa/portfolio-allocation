package handler

import (
	"database/sql"
	"encoding/json"
	"errors"

	"portfolio-server/internal/binance"
	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
	"portfolio-server/internal/util"

	"github.com/gofiber/fiber/v2"
)

func isAllowedKey(key string) bool {
	if key == "password_hash" || key == "credentials" {
		return false
	}
	return config.Get().AllowedSettingKeys[key]
}

// GetSetting handles GET /api/settings/:key
func GetSetting(c *fiber.Ctx) error {
	key := c.Params("key")
	if !isAllowedKey(key) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unknown key"})
	}

	value, err := db.GetSetting(key)
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(fiber.Map{"value": nil})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}

	// Return value as raw JSON so the frontend gets the actual type (object/array/string)
	return c.JSON(fiber.Map{"value": json.RawMessage(value)})
}

// PutSetting handles PUT /api/settings/:key  { "value": <any JSON> }
func PutSetting(c *fiber.Ctx) error {
	key := c.Params("key")
	if !isAllowedKey(key) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unknown key"})
	}

	var body struct {
		Value json.RawMessage `json:"value"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}

	if err := db.UpsertSetting(key, string(body.Value)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// DeleteSetting handles DELETE /api/settings/:key
func DeleteSetting(c *fiber.Ctx) error {
	key := c.Params("key")
	if !isAllowedKey(key) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unknown key"})
	}

	if err := db.DeleteSetting(key); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// GetPublicConfig handles GET /api/config — returns public operational parameters to frontend
func GetPublicConfig(c *fiber.Ctx) error {
	cfg := config.Get()
	_, err := getActiveCredentials()
	hasCredentials := err == nil
	return c.JSON(fiber.Map{
		"hasCredentials":        hasCredentials,
		"popularCoins":          cfg.PopularCoins,
		"dustThresholdUSDT":     cfg.DustThresholdUSDT,
		"actionThresholdPct":    cfg.ActionThresholdPct,
		"rebalanceMinTradeUSDT": cfg.RebalanceMinTradeUSDT,
		"rebalanceThresholdPct": cfg.RebalanceThresholdPct,
		"rebalanceFeeRate":      cfg.RebalanceFeeRate,
	})
}

type CredentialsStatusResponse struct {
	Configured   bool   `json:"configured"`
	Source       string `json:"source"` // "database", "env", "none"
	MaskedAPIKey string `json:"maskedApiKey"`
}

// GetCredentialsStatus handles GET /api/credentials — safely returns whether credentials exist without exposing secrets
func GetCredentialsStatus(c *fiber.Ctx) error {
	cfg := config.Get()

	// 1. Check database first
	val, err := db.GetSetting("credentials")
	if err == nil && val != "" {
		creds, err := parseStoredCredentials(val)
		if err == nil && creds.APIKey != "" {
			return c.JSON(CredentialsStatusResponse{
				Configured:   true,
				Source:       "database",
				MaskedAPIKey: util.MaskString(creds.APIKey),
			})
		}
	}

	// 2. Check env variables
	if cfg.BinanceApiKey != "" && cfg.BinanceApiSecret != "" {
		return c.JSON(CredentialsStatusResponse{
			Configured:   true,
			Source:       "env",
			MaskedAPIKey: util.MaskString(cfg.BinanceApiKey),
		})
	}

	return c.JSON(CredentialsStatusResponse{
		Configured:   false,
		Source:       "none",
		MaskedAPIKey: "",
	})
}

// SaveCredentials handles POST /api/credentials — tests connection, encrypts with AES-256-GCM, and saves to database
func SaveCredentials(c *fiber.Ctx) error {
	var body struct {
		APIKey    string `json:"apiKey"`
		APISecret string `json:"apiSecret"`
	}
	if err := c.BodyParser(&body); err != nil || body.APIKey == "" || body.APISecret == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"ok":    false,
			"error": "API Key dan Secret wajib diisi",
		})
	}

	// Verify credentials against Binance
	client := binance.DefaultClient()
	err := client.TestConnection(body.APIKey, body.APISecret)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"ok":    false,
			"error": "Koneksi ke Binance gagal: " + err.Error(),
		})
	}

	// Encrypt using AES-256-GCM with server secret
	cfg := config.Get()
	credJSON, err := json.Marshal(body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Serialisasi gagal"})
	}

	encrypted, err := util.EncryptAESGCM(credJSON, cfg.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Enkripsi gagal"})
	}

	if err := db.UpsertSetting("credentials", encrypted); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan ke database"})
	}

	return c.JSON(fiber.Map{
		"ok":           true,
		"configured":   true,
		"source":       "database",
		"maskedApiKey": util.MaskString(body.APIKey),
	})
}

// DeleteCredentials handles DELETE /api/credentials — deletes database credentials
func DeleteCredentials(c *fiber.Ctx) error {
	if err := db.DeleteSetting("credentials"); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus kredensial"})
	}

	cfg := config.Get()
	hasEnvFallback := cfg.BinanceApiKey != "" && cfg.BinanceApiSecret != ""
	source := "none"
	maskedKey := ""
	if hasEnvFallback {
		source = "env"
		maskedKey = util.MaskString(cfg.BinanceApiKey)
	}

	return c.JSON(fiber.Map{
		"ok":             true,
		"configured":     hasEnvFallback,
		"source":         source,
		"maskedApiKey":   maskedKey,
		"hasEnvFallback": hasEnvFallback,
	})
}
