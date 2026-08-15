package httpserver

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// NewRouter builds the base chi router with shared middleware and an
// "/api/v1" mount point. Each domain package registers its own routes onto
// the returned APIRouter from main.go — router.go itself has no knowledge of
// auth/generation/puzzle/folder/profile/billing, keeping domain boundaries
// clean (Constitution I: clear module boundaries).
func NewRouter(corsAllowedOrigin string) (root chi.Router, api chi.Router) {
	root = chi.NewRouter()

	root.Use(chimiddleware.RequestID)
	root.Use(chimiddleware.Recoverer)
	root.Use(RequestLogger)
	root.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{corsAllowedOrigin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Share-Password"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	root.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	api = chi.NewRouter()
	root.Mount("/api/v1", api)

	return root, api
}
