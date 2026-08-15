package auth

import (
	"errors"
	"net/http"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

type resetStartRequest struct {
	Email string `json:"email" validate:"required,email"`
}

func (h *Handlers) PasswordResetStart(w http.ResponseWriter, r *http.Request) {
	var req resetStartRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Введите email", nil)
		return
	}
	if !h.codeLimiter.Allow(req.Email) {
		httpserver.WriteError(w, http.StatusTooManyRequests, httpserver.CodeRateLimited,
			"Код уже отправлен, повторите попытку немного позже.", nil)
		return
	}
	// Always 202, regardless of whether the email exists — avoids account
	// enumeration (Constitution VI).
	_ = h.service.StartPasswordReset(r.Context(), req.Email)
	httpserver.WriteJSON(w, http.StatusAccepted, map[string]any{})
}

type resetCompleteRequest struct {
	Email       string `json:"email" validate:"required,email"`
	Code        string `json:"code" validate:"required,len=6"`
	NewPassword string `json:"newPassword" validate:"required,min=8"`
}

func (h *Handlers) PasswordResetComplete(w http.ResponseWriter, r *http.Request) {
	var req resetCompleteRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Проверьте код и новый пароль (минимум 8 символов)", nil)
		return
	}
	err := h.service.CompletePasswordReset(r.Context(), req.Email, req.Code, req.NewPassword)
	if errors.Is(err, ErrWrongCode) {
		httpserver.WriteValidationError(w, "Неверный или истёкший код", nil)
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{})
}
