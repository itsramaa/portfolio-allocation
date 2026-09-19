package handler

import (
	"database/sql"
	"errors"

	"portfolio-server/internal/db"

	"github.com/gofiber/fiber/v2"
)

type snapshot struct {
	DayKey    string   `json:"dayKey"`
	Timestamp int64    `json:"timestamp"`
	TotalUSDT float64  `json:"totalUSDT"`
	BtcPrice  *float64 `json:"btcPrice"`
}

// GetHistory handles GET /api/history
func GetHistory(c *fiber.Ctx) error {
	rows, err := db.DB.Query(
		`SELECT day_key, timestamp, total_usdt, btc_price FROM history ORDER BY timestamp ASC`,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}
	defer rows.Close()

	result := make([]snapshot, 0)
	for rows.Next() {
		var s snapshot
		if err := rows.Scan(&s.DayKey, &s.Timestamp, &s.TotalUSDT, &s.BtcPrice); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scan error"})
		}
		result = append(result, s)
	}
	return c.JSON(result)
}

// PostHistory handles POST /api/history — upserts one daily snapshot (latest wins)
func PostHistory(c *fiber.Ctx) error {
	var s snapshot
	if err := c.BodyParser(&s); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}
	if s.DayKey == "" || s.TotalUSDT <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid snapshot"})
	}

	// Only update if this timestamp is newer than what we have
	var existing int64
	err := db.DB.QueryRow(`SELECT timestamp FROM history WHERE day_key = ?`, s.DayKey).Scan(&existing)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}

	if errors.Is(err, sql.ErrNoRows) || s.Timestamp >= existing {
		_, err = db.DB.Exec(
			`INSERT INTO history (day_key, timestamp, total_usdt, btc_price) VALUES (?, ?, ?, ?)
			 ON CONFLICT(day_key) DO UPDATE SET
			   timestamp = excluded.timestamp,
			   total_usdt = excluded.total_usdt,
			   btc_price  = excluded.btc_price`,
			s.DayKey, s.Timestamp, s.TotalUSDT, s.BtcPrice,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
		}
	}

	return c.JSON(fiber.Map{"ok": true})
}

// DeleteHistory handles DELETE /api/history
func DeleteHistory(c *fiber.Ctx) error {
	if _, err := db.DB.Exec(`DELETE FROM history`); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}
	return c.JSON(fiber.Map{"ok": true})
}
