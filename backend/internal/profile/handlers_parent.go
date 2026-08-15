package profile

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

// VerifyParentLink handles POST /parent-links/{id}/verify — deliberately
// mounted WITHOUT authMiddleware in routes.go: the guardian clicking the
// link from their email has no Neuratop account/session of their own
// (FR-051), so this endpoint must be reachable while fully unauthenticated.
func (h *Handlers) VerifyParentLink(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpserver.WriteValidationError(w, "Отсутствует идентификатор ссылки подтверждения", nil)
		return
	}

	// contracts/rest-api.md documents a `{ token }` JSON body for this
	// endpoint. In this package's simplified verification scheme (see
	// Service.VerifyParentLink) the token IS the parent_links id already
	// carried in the URL path, so the body is optional here: it is read
	// best-effort and never required.
	if r.Body != nil {
		var body struct {
			Token string `json:"token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = r.Body.Close()
	}

	if err := h.service.VerifyParentLink(r.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpserver.WriteNotFound(w, "Ссылка подтверждения недействительна или уже использована")
			return
		}
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{})
}
