package billing

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts every billing endpoint from
// specs/001-neuratop-mvp/contracts/rest-api.md onto api. Every endpoint
// requires an authenticated caller (there is no public billing surface).
func RegisterRoutes(api chi.Router, authMiddleware func(http.Handler) http.Handler, deps Deps) {
	h := deps.Handlers

	api.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/me/credits", h.GetCredits)
		r.Get("/hint-packages", h.ListHintPackages)
		r.Post("/hint-packages/{id}/purchase", h.PurchaseHintPackage)
		r.Get("/me/transactions", h.ListTransactions)
		r.Post("/me/credits/topup", h.Topup)
	})
}
