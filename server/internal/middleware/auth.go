package middleware

import (
	"strings"

	"portfolio-server/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Auth validates the Authorization: Bearer <token> header.
func Auth(c *fiber.Ctx) error {
	header := c.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	tokenStr := strings.TrimPrefix(header, "Bearer ")
	_, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return config.Get().JWTSecret, nil
	})
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
	}

	return c.Next()
}
