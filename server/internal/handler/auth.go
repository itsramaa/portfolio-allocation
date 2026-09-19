package handler

import (
	"time"

	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
	"portfolio-server/internal/util"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Login handles POST /api/auth/login { "password": "..." }
func Login(c *fiber.Ctx) error {
	var body struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}

	storedHash, err := db.GetSetting("password_hash")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error"})
	}

	if util.SHA256Hex(body.Password) != storedHash {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid password"})
	}

	token, err := makeToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "token error"})
	}

	return c.JSON(fiber.Map{"token": token})
}

// AuthCheck handles GET /api/auth/check — protected, just confirms token is valid.
func AuthCheck(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"ok": true})
}

// ChangePassword handles POST /api/auth/change-password { "current": "...", "next": "..." }
func ChangePassword(c *fiber.Ctx) error {
	var body struct {
		Current string `json:"current"`
		Next    string `json:"next"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}
	if len(body.Next) < 4 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "password too short (min 4 chars)"})
	}

	storedHash, err := db.GetSetting("password_hash")
	if err != nil || util.SHA256Hex(body.Current) != storedHash {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "current password wrong"})
	}

	if err := db.UpsertSetting("password_hash", util.SHA256Hex(body.Next)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func makeToken() (string, error) {
	cfg := config.Get()
	expiryHours := cfg.JWTExpiryHours
	if expiryHours <= 0 {
		expiryHours = 720
	}
	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Duration(expiryHours) * time.Hour).Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(cfg.JWTSecret)
}
