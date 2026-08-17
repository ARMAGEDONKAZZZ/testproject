package folder

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts every folder/history/favorites/share endpoint from
// specs/001-neuratop-mvp/contracts/rest-api.md onto api.
//
// GET /share/:slug is the one endpoint in this package that is deliberately
// NOT wrapped in authMiddleware — it's the public, unauthenticated view of a
// shared folder (US8/FR-058). Every other endpoint requires a Bearer token.
func RegisterRoutes(api chi.Router, authMiddleware func(http.Handler) http.Handler, deps Deps) {
	h := deps.Handlers

	api.Get("/share/{slug}", h.GetBySlug)
	api.Post("/share/{slug}/puzzles/{puzzleId}/check-move", h.CheckGuestMove)

	api.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		r.Get("/history", h.History)
		r.Get("/favorites", h.ListFavorites)

		r.Route("/folders", func(r chi.Router) {
			r.Get("/", h.ListFolders)
			r.Post("/", h.CreateFolder)

			r.Route("/{id}", func(r chi.Router) {
				r.Patch("/", h.UpdateFolder)
				r.Delete("/", h.DeleteFolder)
				r.Post("/share", h.Share)

				r.Route("/items", func(r chi.Router) {
					r.Get("/", h.ListFolderItems)
					r.Post("/", h.AddFolderItems)
					r.Delete("/{puzzleId}", h.RemoveFolderItem)
				})
			})
		})
	})
}
