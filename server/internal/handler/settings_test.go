package handler

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"portfolio-server/internal/config"
	"portfolio-server/internal/util"
)

func TestParseStoredCredentialsDecryptsEncryptedPayload(t *testing.T) {
	const secret = "test-jwt-secret"
	_ = os.Setenv("JWT_SECRET", secret)
	config.Load()

	payload, err := json.Marshal(CredentialPayload{
		APIKey:    "new-api-key",
		APISecret: "new-api-secret",
	})
	if err != nil {
		t.Fatal(err)
	}

	encrypted, err := util.EncryptAESGCM(payload, []byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(encrypted, "new-api-secret") {
		t.Fatal("encrypted credential payload contains the API secret")
	}

	credentials, err := parseStoredCredentials(encrypted)
	if err != nil {
		t.Fatalf("parseStoredCredentials returned an error: %v", err)
	}
	if credentials.APIKey != "new-api-key" || credentials.APISecret != "new-api-secret" {
		t.Fatalf("unexpected credentials: %+v", credentials)
	}
}
