package auth

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts every auth endpoint from
// specs/001-neuratop-mvp/contracts/rest-api.md onto api. authMiddleware is
// only needed for the one endpoint that requires a caller already holding a
// token (nickname finalization).
func RegisterRoutes(api chi.Router, authMiddleware func(http.Handler) http.Handler, deps Deps) {
	h := deps.Handlers

	api.Route("/auth", func(r chi.Router) {
		r.Post("/register/start", h.RegisterStart)
		r.Post("/register/code", h.RegisterCode)
		r.Post("/register/verify", h.RegisterVerify)
		r.Post("/register/oauth/{provider}", h.RegisterOAuth)
		r.Post("/login", h.Login)
		r.Post("/refresh", h.Refresh)
		r.Post("/password-reset/start", h.PasswordResetStart)
		r.Post("/password-reset/complete", h.PasswordResetComplete)

		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)
			r.Post("/register/nickname", h.RegisterNickname)
			r.Post("/logout", h.Logout)
		})
	})
}
