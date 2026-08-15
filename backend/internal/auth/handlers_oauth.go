package auth

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

// mockOAuthCode is the shape trusted in place of a real Google/Apple token
// exchange (see Service.CompleteOAuth doc comment for why). The frontend's
// OAuth mock button encodes this directly as the "oauthCode" payload.
type mockOAuthCode struct {
	Subject string `json:"subject"`
	Email   string `json:"email"`
	Age     int16  `json:"age"`
}

type oauthRequest struct {
	OAuthCode string `json:"oauthCode" validate:"required"`
}

func (h *Handlers) RegisterOAuth(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if provider != "google" && provider != "apple" {
		httpserver.WriteValidationError(w, "Неизвестный провайдер", nil)
		return
	}

	var req oauthRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}

	var claim mockOAuthCode
	if err := json.Unmarshal([]byte(req.OAuthCode), &claim); err != nil || claim.Email == "" || claim.Age == 0 {
		httpserver.WriteValidationError(w, "Некорректные данные от провайдера входа", nil)
		return
	}

	_, access, refresh, err := h.service.CompleteOAuth(r.Context(), OAuthIdentity{
		Provider: provider, Subject: claim.Subject, Email: claim.Email,
	}, claim.Age)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"accessToken": access, "refreshToken": refresh})
}
