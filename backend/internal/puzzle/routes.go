package puzzle

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts every "Puzzles & solving" endpoint from
// specs/001-neuratop-mvp/contracts/rest-api.md onto api. Every route in
// this package requires an authenticated caller.
func RegisterRoutes(api chi.Router, authMiddleware func(http.Handler) http.Handler, deps Deps) {
	h := deps.Handlers

	api.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		r.Get("/puzzles/{id}", h.GetPuzzle)
		r.Post("/puzzles/{id}/attempts", h.StartAttempt)
		r.Post("/puzzles/{id}/favorite", h.AddFavorite)
		r.Delete("/puzzles/{id}/favorite", h.RemoveFavorite)
		r.Get("/puzzles/{id}/export", h.Export)

		r.Post("/attempts/{id}/moves", h.SubmitMove)
		r.Post("/attempts/{id}/simplify", h.Simplify)
		r.Post("/attempts/{id}/hints", h.RequestHint)
		r.Post("/attempts/{id}/reveal-solution", h.RevealSolution)
		r.Get("/attempts/{id}/analysis", h.GetAnalysis)
	})
}
