package db

import (
	"database/sql"
	"log"
	"os"

	"portfolio-server/internal/config"
	"portfolio-server/internal/util"

	_ "modernc.org/sqlite"
)

// DB is the package-level database handle shared across the application.
var DB *sql.DB

// Init opens the SQLite database, runs migrations, and seeds defaults.
func Init() {
	cfg := config.Get()
	if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
		log.Fatalf("db: failed to create data dir: %v", err)
	}

	var err error
	DB, err = sql.Open("sqlite", cfg.DBPath)
	if err != nil {
		log.Fatalf("db: failed to open sqlite: %v", err)
	}

	// SQLite does not support concurrent writers
	DB.SetMaxOpenConns(1)

	runMigrations()
	seedDefaults()
}

func runMigrations() {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS settings (
			key        TEXT    PRIMARY KEY,
			value      TEXT    NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS history (
			day_key    TEXT    PRIMARY KEY,
			timestamp  INTEGER NOT NULL,
			total_usdt REAL    NOT NULL,
			btc_price  REAL
		)`,
		`CREATE TABLE IF NOT EXISTS fxcache (
			id           INTEGER PRIMARY KEY CHECK (id = 1),
			rates_json   TEXT    NOT NULL,
			base         TEXT    NOT NULL DEFAULT 'USD',
			last_updated INTEGER NOT NULL
		)`,
	}
	for _, s := range stmts {
		if _, err := DB.Exec(s); err != nil {
			log.Fatalf("db: migration failed: %v", err)
		}
	}
}

// seedDefaults inserts the default password hash on first run.
func seedDefaults() {
	var count int
	_ = DB.QueryRow(`SELECT COUNT(*) FROM settings WHERE key = 'password_hash'`).Scan(&count)
	if count > 0 {
		return
	}
	cfg := config.Get()
	_, err := DB.Exec(
		`INSERT INTO settings (key, value, updated_at) VALUES ('password_hash', ?, ?)`,
		util.SHA256Hex(cfg.DefaultPassword), util.NowMs(),
	)
	if err != nil {
		log.Fatalf("db: seed failed: %v", err)
	}
	log.Printf("db: seeded default password (%s)", cfg.DefaultPassword)
}

// UpsertSetting inserts or replaces a key-value setting.
func UpsertSetting(key, value string) error {
	_, err := DB.Exec(
		`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, util.NowMs(),
	)
	return err
}

// GetSetting fetches a value by key; returns ("", sql.ErrNoRows) if absent.
func GetSetting(key string) (string, error) {
	var v string
	err := DB.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	return v, err
}

// DeleteSetting removes a key from settings.
func DeleteSetting(key string) error {
	_, err := DB.Exec(`DELETE FROM settings WHERE key = ?`, key)
	return err
}
