package main

import (
	"log"

	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
	"portfolio-server/internal/handler"
	"portfolio-server/internal/middleware"
	"portfolio-server/internal/narratives"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// Load configuration from environment / .env
	cfg := config.Load()

	// Initialize database
	db.Init()
	narratives.StartProviderScheduler()

	app := fiber.New(fiber.Config{
		AppName: "Portfolio Allocation API",
	})

	// Global Middlewares
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// API Group
	api := app.Group("/api")

	// Public routes
	api.Post("/auth/login", handler.Login)
	api.Get("/config", handler.GetPublicConfig)

	// Protected routes
	protected := api.Group("", middleware.Auth)

	// Auth routes
	protected.Get("/auth/check", handler.AuthCheck)
	protected.Post("/auth/change-password", handler.ChangePassword)

	// Settings routes
	protected.Get("/settings/:key", handler.GetSetting)
	protected.Put("/settings/:key", handler.PutSetting)
	protected.Delete("/settings/:key", handler.DeleteSetting)

	// Credentials routes (AES-256-GCM encrypted storage)
	protected.Get("/credentials", handler.GetCredentialsStatus)
	protected.Post("/credentials", handler.SaveCredentials)
	protected.Delete("/credentials", handler.DeleteCredentials)

	// History routes
	protected.Get("/history", handler.GetHistory)
	protected.Post("/history", handler.PostHistory)
	protected.Delete("/history", handler.DeleteHistory)

	// FX Cache & Rates routes
	protected.Get("/fxcache", handler.GetFXCache)
	protected.Post("/fxcache", handler.SetFXCache)
	protected.Get("/fx", handler.GetFXRates)

	// Portfolio Business Logic routes (Backend computation)
	protected.Get("/portfolio/sync", handler.SyncPortfolio)
	protected.Get("/portfolio/demo", handler.DemoPortfolio)
	protected.Post("/portfolio/inject", handler.CalculateInjection)
	protected.Post("/portfolio/rebalance", handler.CalculateRebalance)
	protected.Get("/portfolio/narratives", handler.GetNarratives)
	protected.Post("/portfolio/test-connection", handler.TestBinanceConnection)

	log.Printf("Server listening on port %s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
