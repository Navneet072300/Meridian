package handlers

import "testing"

func TestBetaEmailAllowed(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("BETA_ALLOWED_EMAILS", "")
	if !betaEmailAllowed("test@example.test") {
		t.Fatal("local development should allow test accounts")
	}
	t.Setenv("APP_ENV", "production")
	if betaEmailAllowed("test@example.test") {
		t.Fatal("production must fail closed without invitations")
	}
	t.Setenv("BETA_ALLOWED_EMAILS", " invited@example.test ,SECOND@example.test")
	if !betaEmailAllowed("INVITED@example.test") || !betaEmailAllowed("second@example.test") {
		t.Fatal("normalized invited email was rejected")
	}
	if betaEmailAllowed("other@example.test") || betaEmailAllowed("invited@example.test.evil") {
		t.Fatal("non-invited email accepted")
	}
}
