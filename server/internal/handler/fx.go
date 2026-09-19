package handler

import (
	"portfolio-server/internal/fx"

	"github.com/gofiber/fiber/v2"
)

// GetFXRates handles GET /api/fx — returns latest FX rates with cache
func GetFXRates(c *fiber.Ctx) error {
	rates := fx.GetRates()
	return c.JSON(rates)
}
