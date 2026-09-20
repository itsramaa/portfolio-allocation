package db

import (
	"database/sql"
	"time"
)

// RecordNarrativeMetric stores one normalized provider observation. The table
// is append-only so the signal engine can compare current values with history.
func RecordNarrativeMetric(narrativeID, metric, source string, value float64, sampledAt time.Time) error {
	if DB == nil {
		return sql.ErrConnDone
	}
	_, err := DB.Exec(`INSERT INTO narrative_signal_samples
		(sampled_at, narrative_id, metric, source, value) VALUES (?, ?, ?, ?, ?)`,
		sampledAt.UnixMilli(), narrativeID, metric, source, value)
	return err
}

type NarrativeMetricHistory struct {
	Latest              float64
	Average7d           float64
	Samples7d           int
	Previous24          float64
	Previous24Available bool
	Previous7d          float64
	Previous7dAvailable bool
	Oldest7d            int64
}

func GetNarrativeMetricHistory(narrativeID, metric string, now time.Time) (NarrativeMetricHistory, error) {
	if DB == nil {
		return NarrativeMetricHistory{}, sql.ErrConnDone
	}
	cutoff7d := now.Add(-7 * 24 * time.Hour).UnixMilli()
	cutoff24h := now.Add(-24 * time.Hour).UnixMilli()
	var history NarrativeMetricHistory
	err := DB.QueryRow(`
		SELECT COALESCE(AVG(value), 0), COUNT(*)
		FROM narrative_signal_samples
		WHERE narrative_id = ? AND metric = ? AND sampled_at >= ?`,
		narrativeID, metric, cutoff7d).Scan(&history.Average7d, &history.Samples7d)
	if err != nil {
		return history, err
	}
	_ = DB.QueryRow(`
		SELECT COALESCE(MIN(sampled_at), 0) FROM narrative_signal_samples
		WHERE narrative_id = ? AND metric = ? AND sampled_at >= ?`,
		narrativeID, metric, cutoff7d).Scan(&history.Oldest7d)
	_ = DB.QueryRow(`
		SELECT value FROM narrative_signal_samples
		WHERE narrative_id = ? AND metric = ?
		ORDER BY sampled_at DESC LIMIT 1`,
		narrativeID, metric).Scan(&history.Latest)
	var previous7d sql.NullFloat64
	_ = DB.QueryRow(`
		SELECT value FROM narrative_signal_samples
		WHERE narrative_id = ? AND metric = ? AND sampled_at <= ?
		ORDER BY sampled_at DESC LIMIT 1`,
		narrativeID, metric, cutoff7d).Scan(&previous7d)
	if previous7d.Valid {
		history.Previous7d, history.Previous7dAvailable = previous7d.Float64, true
	}
	var previous24 sql.NullFloat64
	_ = DB.QueryRow(`
		SELECT value FROM narrative_signal_samples
		WHERE narrative_id = ? AND metric = ? AND sampled_at < ?
		ORDER BY sampled_at DESC LIMIT 1`,
		narrativeID, metric, cutoff24h).Scan(&previous24)
	if previous24.Valid {
		history.Previous24, history.Previous24Available = previous24.Float64, true
	}
	return history, nil
}

func PruneNarrativeMetrics(before time.Time) error {
	if DB == nil {
		return sql.ErrConnDone
	}
	_, err := DB.Exec(`DELETE FROM narrative_signal_samples WHERE sampled_at < ?`, before.UnixMilli())
	return err
}
