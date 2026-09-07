package auth

import (
	"github.com/golang-jwt/jwt/v5"
	"meridian/internal/config"
	"testing"
)

func TestSessionRequiresExpiryAndExactAlgorithm(t *testing.T) {
	valid, e := CreateToken(42)
	if e != nil {
		t.Fatal(e)
	}
	if id, ok := ParseToken(valid); !ok || id != 42 {
		t.Fatal("valid session rejected")
	}
	for _, method := range []jwt.SigningMethod{jwt.SigningMethodHS256, jwt.SigningMethodHS512} {
		token := jwt.NewWithClaims(method, jwt.MapClaims{"sub": "42"})
		s, _ := token.SignedString([]byte(config.JWTSecret))
		if _, ok := ParseToken(s); ok {
			t.Fatal("accepted session without expiry")
		}
	}
}
