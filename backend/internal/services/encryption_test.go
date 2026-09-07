package services

import (
	"meridian/internal/config"
	"testing"
)

func TestEncryptionFailsClosed(t *testing.T) {
	old := config.EncryptionKey
	defer func() { config.EncryptionKey = old }()
	config.EncryptionKey = "bad"
	if _, e := Encrypt("secret"); e == nil {
		t.Fatal("invalid key accepted")
	}
	config.EncryptionKey = "12345678901234567890123456789012"
	enc, e := Encrypt("secret")
	if e != nil {
		t.Fatal(e)
	}
	plain, e := Decrypt(enc)
	if e != nil || plain != "secret" {
		t.Fatal("roundtrip failed")
	}
	if _, e = Decrypt("plaintext-legacy"); e == nil {
		t.Fatal("plaintext accepted")
	}
	config.EncryptionKey = "22345678901234567890123456789012"
	if _, e = Decrypt(enc); e == nil {
		t.Fatal("wrong key accepted")
	}
}
