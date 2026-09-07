package config

import (
	"strings"
	"testing"
)

func TestProductionValidation(t *testing.T) {
	oldDB, oldJWT, oldEncryption := DatabaseURL, JWTSecret, EncryptionKey
	oldFrontend, oldResend, oldSender := FrontendURL, ResendAPIKey, EmailFrom
	defer func() {
		DatabaseURL, JWTSecret, EncryptionKey = oldDB, oldJWT, oldEncryption
		FrontendURL, ResendAPIKey, EmailFrom = oldFrontend, oldResend, oldSender
	}()
	t.Setenv("APP_ENV", "production")
	t.Setenv("BETA_ALLOWED_EMAILS", "invited@example.test")
	DatabaseURL = "postgres://test"
	JWTSecret = strings.Repeat("a", 64)
	EncryptionKey = strings.Repeat("b", 64)
	FrontendURL = "https://dashboard.example.test"
	ResendAPIKey = "test-provider-key"
	EmailFrom = "Meridian <hello@example.test>"
	if err := ValidateProduction(); err != nil {
		t.Fatal(err)
	}
	EncryptionKey = strings.Repeat("z", 64)
	if ValidateProduction() == nil {
		t.Fatal("invalid hex key accepted")
	}
	EncryptionKey = strings.Repeat("b", 64)
	for _, invalid := range []string{"https://", "http://example.test", "https://example.test/path", "https://user@example.test"} {
		FrontendURL = invalid
		if ValidateProduction() == nil {
			t.Fatalf("invalid frontend origin accepted: %s", invalid)
		}
	}
	FrontendURL = "https://dashboard.example.test"
	EmailFrom = ""
	if ValidateProduction() == nil {
		t.Fatal("missing email sender accepted")
	}
	EmailFrom = "hello@example.test"
	t.Setenv("BETA_ALLOWED_EMAILS", "")
	if ValidateProduction() == nil {
		t.Fatal("unrestricted beta signup accepted")
	}
}
