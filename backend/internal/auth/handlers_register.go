package auth

import (
	"errors"
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

var validate = validator.New()

type registerStartRequest struct {
	Age    int16   `json:"age" validate:"required,min=1,max=120"`
	Email  string  `json:"email" validate:"omitempty,email"`
	Parent *parent `json:"parent"`
}

type parent struct {
	Name  string `json:"name" validate:"required"`
	Email string `json:"email" validate:"required,email"`
}

func (h *Handlers) RegisterStart(w http.ResponseWriter, r *http.Request) {
	var req registerStartRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Проверьте корректность введённых данных", nil)
		return
	}

	in := StartRegistrationInput{Age: req.Age, Email: req.Email}
	if req.Parent != nil {
		in.Parent = &struct{ Name, Email string }{Name: req.Parent.Name, Email: req.Parent.Email}
	}

	user, err := h.service.StartRegistration(r.Context(), in)
	switch {
	case errors.Is(err, ErrValidation):
		httpserver.WriteValidationError(w, "Для этой возрастной категории требуется согласие родителя/опекуна", nil)
		return
	case errors.Is(err, ErrEmailInUse):
		httpserver.WriteError(w, http.StatusConflict, httpserver.CodeConflict, "Этот email уже зарегистрирован", nil)
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusCreated, map[string]any{
		"registrationId": user.ID,
		"ageTier":        user.AgeTier,
	})
}

type registerCodeRequest struct {
	RegistrationID uuid.UUID `json:"registrationId" validate:"required"`
}

func (h *Handlers) RegisterCode(w http.ResponseWriter, r *http.Request) {
	var req registerCodeRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if !h.codeLimiter.Allow(req.RegistrationID.String()) {
		httpserver.WriteError(w, http.StatusTooManyRequests, httpserver.CodeRateLimited,
			"Код уже отправлен, повторите попытку немного позже.", nil)
		return
	}
	devCode, err := h.service.SendRegistrationCode(r.Context(), req.RegistrationID)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	data := map[string]any{}
	if devCode != "" {
		data["devCode"] = devCode
	}
	httpserver.WriteJSON(w, http.StatusAccepted, data)
}

type registerVerifyRequest struct {
	RegistrationID uuid.UUID `json:"registrationId" validate:"required"`
	Code           string    `json:"code" validate:"required,len=6"`
}

// RegisterVerify completes the email/OTP registration leg. There is no
// client-supplied password here — for an adult account, the verified code
// itself becomes the account password (see Service.VerifyRegistration), so
// there is nothing else for the client to submit or get wrong.
func (h *Handlers) RegisterVerify(w http.ResponseWriter, r *http.Request) {
	var req registerVerifyRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Проверьте код", nil)
		return
	}
	user, access, refresh, err := h.service.VerifyRegistration(r.Context(), VerifyRegistrationInput{
		UserID: req.RegistrationID, Code: req.Code,
	})
	if errors.Is(err, ErrWrongCode) {
		httpserver.WriteValidationError(w, "Неверный или истёкший код", nil)
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"userId": user.ID, "nickname": user.Nickname,
		"accessToken": access, "refreshToken": refresh,
	})
}

type registerNicknameRequest struct {
	Nickname string `json:"nickname" validate:"required,min=3,max=32"`
}

// RegisterNickname requires the caller to already hold a valid access token
// (issued right after RegisterVerify/CompleteOAuth with a temporary
// nickname) — see routes.go for how this endpoint is mounted behind
// RequireAuth.
func (h *Handlers) RegisterNickname(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req registerNicknameRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Никнейм должен быть от 3 до 32 символов", nil)
		return
	}
	_, access, refresh, err := h.service.CompleteNickname(r.Context(), userID, req.Nickname)
	if errors.Is(err, ErrNicknameUsed) {
		httpserver.WriteError(w, http.StatusConflict, httpserver.CodeConflict, "Этот никнейм уже занят", nil)
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"accessToken": access, "refreshToken": refresh})
}
