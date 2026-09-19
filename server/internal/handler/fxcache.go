package handler

import (
	"database/sql"
	"encoding/json"
	"errors"

	"portfolio-server/internal/db"
	"portfolio-server/internal/util"

	"github.com/gofiber/fiber/v2"
)

type fxCacheResponse struct {
	Rates       json.RawMessage `json:"rates"`
	Base        string          `json:"base"`
	LastUpdated int64           `json:"lastUpdated"`
}

// GetFXCache handles GET /api/fxcache
func GetFXCache(c *fiber.Ctx) error {
	var ratesJSON, base string
	var lastUpdated int64

	err := db.DB.QueryRow(
		`SELECT rates_json, base, last_updated FROM fxcache WHERE id = 1`,
	).Scan(&ratesJSON, &base, &lastUpdated)

	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(fiber.Map{"data": nil})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}

	return c.JSON(fiber.Map{
		"data": fxCacheResponse{
			Rates:       json.RawMessage(ratesJSON),
			Base:        base,
			LastUpdated: lastUpdated,
		},
	})
}

// SetFXCache handles POST /api/fxcache
func SetFXCache(c *fiber.Ctx) error {
	var body struct {
		Rates       json.RawMessage `json:"rates"`
		Base        string          `json:"base"`
		LastUpdated int64           `json:"lastUpdated"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}
	if len(body.Rates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing rates"})
	}
	if body.Base == "" {
		body.Base = "USD"
	}
	if body.LastUpdated == 0 {
		body.LastUpdated = util.NowMs()
	}

	_, err := db.DB.Exec(
		`INSERT INTO fxcache (id, rates_json, base, last_updated) VALUES (1, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   rates_json   = excluded.rates_json,
		   base         = excluded.base,
		   last_updated = excluded.last_updated`,
		string(body.Rates), body.Base, body.LastUpdated,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}

	return c.JSON(fiber.Map{"ok": true})
}
