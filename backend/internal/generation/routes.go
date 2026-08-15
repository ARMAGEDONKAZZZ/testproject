package generation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts every generation endpoint from
// specs/001-neuratop-mvp/contracts/rest-api.md ("Generation") onto api,
// plus the mocked AI-chat endpoint (US7 Scenario 3). Every endpoint in this
// package requires an authenticated caller.
func RegisterRoutes(api chi.Router, authMiddleware func(http.Handler) http.Handler, deps Deps) {
	h := deps.Handlers

	api.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		r.Post("/generations", h.CreateGeneration)
		r.Get("/generations", h.ListGenerations)
		r.Post("/generations/fen", h.GenerateFromFEN)
		r.Get("/generations/{id}", h.GetGeneration)
		r.Post("/generations/{id}/cancel", h.CancelGeneration)

		r.Post("/puzzles/{id}/regenerate", h.RegeneratePuzzle)
		r.Post("/puzzles/{id}/chat", h.Chat)

		r.Get("/fen/current/{puzzleId}", h.CurrentFEN)
	})
}
