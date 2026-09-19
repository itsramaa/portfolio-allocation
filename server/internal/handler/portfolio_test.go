package handler

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func postInjection(t *testing.T, payload string) int {
	t.Helper()
	app := fiber.New()
	app.Post("/inject", CalculateInjection)
	req := httptest.NewRequest("POST", "/inject", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode
}

func TestCalculateInjectionRejectsNonPositiveDeposit(t *testing.T) {
	if status := postInjection(t, `{"depositAmount":0,"targets":{},"assets":[]}`); status != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", status)
	}
}

func TestCalculateInjectionRejectsTargetSumThatIsNot100(t *testing.T) {
	if status := postInjection(t, `{"depositAmount":100,"targets":{"BTC":80},"assets":[]}`); status != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", status)
	}
}

func TestCalculateInjectionRejectsInvalidTarget(t *testing.T) {
	if status := postInjection(t, `{"depositAmount":100,"targets":{"BTC":101},"assets":[]}`); status != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", status)
	}
}
