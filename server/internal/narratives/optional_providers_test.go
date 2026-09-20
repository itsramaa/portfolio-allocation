package narratives

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOptionalProviderDisabled(t *testing.T) {
	result := map[string]NarrativeSignals{"ai-agents": emptySignals()}
	available, errText := applyOptionalProvider(context.Background(), http.DefaultClient, optionalProviderSpec{Name: "x", Enabled: false}, result)
	if available || errText != "disabled" {
		t.Fatalf("disabled provider = (%v, %q), want (false, disabled)", available, errText)
	}
}

func TestOptionalProviderAuthHeaderAndSignal(t *testing.T) {
	seenAuth := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenAuth = r.Header.Get("X-API-Key")
		_, _ = w.Write([]byte(`{"data":{"score":72}}`))
	}))
	defer server.Close()

	result := map[string]NarrativeSignals{}
	for _, n := range SeedNarratives {
		result[n.ID] = emptySignals()
	}
	available, errText := applyOptionalProvider(context.Background(), server.Client(), optionalProviderSpec{
		Name: "test-provider", Enabled: true, APIKey: "abc", BaseURL: server.URL,
		EndpointTemplate: "/asset/{symbol}", AuthHeader: "X-API-Key",
		FieldPaths: providerFieldPaths{Score: "data.score"},
		Apply:      func(signals *NarrativeSignals, signal Signal) { signals.Social = mergeSignals(signals.Social, signal) },
	}, result)
	if !available || errText != "" {
		t.Fatalf("provider = (%v, %q), want available", available, errText)
	}
	if seenAuth != "abc" {
		t.Fatalf("auth header = %q, want abc", seenAuth)
	}
	if !result["ai-agents"].Social.Available || result["ai-agents"].Social.Score != 72 {
		t.Fatalf("social signal = %+v, want score 72 available", result["ai-agents"].Social)
	}
}

func TestOptionalProviderMetricSpecificEndpoints(t *testing.T) {
	requested := map[string]bool{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requested[r.URL.Path] = true
		switch r.URL.Path {
		case "/active/FET":
			_, _ = w.Write([]byte(`{"result":{"data":[{"active_addresses":500000}]}}`))
		case "/netflow/FET":
			_, _ = w.Write([]byte(`{"result":{"data":[{"netflow_total":1000}]}}`))
		case "/reserve/FET":
			_, _ = w.Write([]byte(`{"result":{"data":[{"reserve":500000}]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	signal, err := fetchOptionalProviderSignal(context.Background(), server.Client(), optionalProviderSpec{
		Name: "cryptoquant", Enabled: true, APIKey: "token", BaseURL: server.URL,
		EndpointTemplate: "/active/{symbol}", AuthHeader: "Authorization",
		Metrics: []optionalProviderMetric{
			{Path: "result.data.0.active_addresses", EndpointTemplate: "/active/{symbol}", Baseline: 500000, Polarity: 1, Transform: "log10"},
			{Path: "result.data.0.netflow_total", EndpointTemplate: "/netflow/{symbol}", Baseline: 1000, Polarity: -1, Transform: "log10"},
			{Path: "result.data.0.reserve", EndpointTemplate: "/reserve/{symbol}", Baseline: 500000, Polarity: -1, Transform: "log10"},
		},
	}, "FET")
	if err != nil {
		t.Fatalf("fetch signal error = %v", err)
	}
	if !signal.Available || signal.Score != 50 {
		t.Fatalf("signal = %+v, want available baseline score 50", signal)
	}
	for _, path := range []string{"/active/FET", "/netflow/FET", "/reserve/FET"} {
		if !requested[path] {
			t.Fatalf("endpoint %s was not requested", path)
		}
	}
}
