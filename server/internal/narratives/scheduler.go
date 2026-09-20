package narratives

import (
	"time"

	"portfolio-server/internal/config"
	"portfolio-server/internal/db"
)

// StartProviderScheduler refreshes free provider data in the background so
// historical samples continue accumulating even when the narrative page is
// not being viewed. It is safe to call once during server startup.
func StartProviderScheduler() {
	cfg := config.Get()
	interval := time.Duration(cfg.NarrativeRefreshMinutes) * time.Minute
	if interval <= 0 {
		return
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			providerCache.mu.Lock()
			providerCache.expiresAt = time.Time{}
			providerCache.mu.Unlock()
			collectFreeSignals()
			_ = db.PruneNarrativeMetrics(time.Now().Add(-time.Duration(cfg.NarrativeHistoryRetentionDays) * 24 * time.Hour))
		}
	}()
}
