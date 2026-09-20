package narratives

import "testing"

func TestCompositeScoreRenormalizesAvailableSignals(t *testing.T) {
	score := compositeScore(NarrativeSignals{
		Market:      Signal{Score: 80, Available: true},
		Volume:      Signal{Score: 40, Available: true},
		CapitalFlow: Signal{Score: 0, Available: false},
	})
	want := 60
	if score != want {
		t.Fatalf("composite score = %d, want %d", score, want)
	}
}

func TestLifecycleUsesDirection(t *testing.T) {
	base := NarrativeSignals{Market: Signal{Score: 80, Available: true}}
	if got := lifecycleFor(base, -6); got != "cooling" {
		t.Fatalf("falling high-score lifecycle = %q, want cooling", got)
	}
	if got := lifecycleFor(base, 0); got != "crowded" {
		t.Fatalf("stable high-score lifecycle = %q, want crowded", got)
	}
}

func TestNormalizeSymbol(t *testing.T) {
	for input, want := range map[string]string{"rndr": "RENDER", "MATIC": "POL", " btc ": "BTC"} {
		if got := normalizeSymbol(input); got != want {
			t.Errorf("normalizeSymbol(%q) = %q, want %q", input, got, want)
		}
	}
}
