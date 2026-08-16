package profile

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts every profile endpoint from
// specs/001-neuratop-mvp/contracts/rest-api.md onto api.
//
// /parent-links/{id}/verify is deliberately mounted OUTSIDE authMiddleware:
// the guardian confirming via an emailed link has no account/session in the
// system (FR-051). Every /me* endpoint requires an authenticated caller.
func RegisterRoutes(api chi.Router, authMiddleware func(http.Handler) http.Handler, deps Deps) {
	h := deps.Handlers

	api.Post("/parent-links/{id}/verify", h.VerifyParentLink)

	api.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/me", h.GetMe)
		r.Patch("/me", h.UpdateMe)
		r.Post("/me/password", h.ChangePassword)
		r.Delete("/me", h.DeleteMe)
		r.Get("/me/skills", h.GetSkills)
		r.Get("/me/training/summary", h.GetTrainingSummary)
		r.Patch("/me/skills/focus", h.SetFocusAxes)
		r.Put("/me/board-preferences", h.SetBoardPreferences)
		r.Patch("/me/onboarding", h.UpdateOnboarding)
	})
}
