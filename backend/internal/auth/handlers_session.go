package auth

import (
	"errors"
	"net/http"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Введите email и пароль", nil)
		return
	}

	limitKey := r.RemoteAddr + ":" + req.Email
	if !h.loginLimiter.Allow(limitKey) {
		httpserver.WriteError(w, http.StatusTooManyRequests, httpserver.CodeRateLimited,
			"Слишком много попыток входа. Попробуйте позже.", nil)
		return
	}

	_, access, refresh, err := h.service.Login(r.Context(), req.Email, req.Password)
	if errors.Is(err, ErrWrongPass) {
		httpserver.WriteError(w, http.StatusUnauthorized, httpserver.ErrorCode("WRONG_PASSWORD"), "Неверный пароль", nil)
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"accessToken": access, "refreshToken": refresh})
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

func (h *Handlers) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	access, refresh, err := h.service.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		httpserver.WriteUnauthenticated(w, "Сессия истекла, войдите снова")
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"accessToken": access, "refreshToken": refresh})
}

func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := h.service.Logout(r.Context(), req.RefreshToken); err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
