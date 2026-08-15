package httpserver

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// TokenIssuer issues and verifies the short-lived access JWT. Refresh tokens
// are opaque random strings persisted (hashed) in the sessions table, not
// JWTs — see internal/auth.
type TokenIssuer struct {
	secret []byte
	ttl    time.Duration
}

func NewTokenIssuer(secret []byte, ttl time.Duration) TokenIssuer {
	return TokenIssuer{secret: secret, ttl: ttl}
}

type AccessClaims struct {
	UserID  uuid.UUID `json:"uid"`
	AgeTier string    `json:"age_tier"`
	jwt.RegisteredClaims
}

func (i TokenIssuer) Issue(userID uuid.UUID, ageTier string) (string, error) {
	claims := AccessClaims{
		UserID:  userID,
		AgeTier: ageTier,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(i.ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(i.secret)
}

func (i TokenIssuer) Verify(tokenString string) (AccessClaims, error) {
	var claims AccessClaims
	token, err := jwt.ParseWithClaims(tokenString, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return i.secret, nil
	})
	if err != nil || !token.Valid {
		return AccessClaims{}, fmt.Errorf("invalid token: %w", err)
	}
	return claims, nil
}
