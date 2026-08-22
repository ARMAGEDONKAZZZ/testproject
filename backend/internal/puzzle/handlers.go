package puzzle

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

var validate = validator.New()

// Handlers holds the puzzle package's HTTP handlers. repo is exposed
// alongside service for the one documented case where a handler reads a
// shared catalog table directly instead of going through the service layer
// — see RequestHint below and model.go's HintPackageView doc.
type Handlers struct {
	service *Service
	repo    *Repository
}

func parseIDParam(r *http.Request, name string) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, name))
}

// GetPuzzle handles GET /puzzles/:id (rest-api.md: never includes
// solutionLine — puzzlemodel.APIView omits it entirely by construction).
func (h *Handlers) GetPuzzle(w http.ResponseWriter, r *http.Request) {
	id, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}
	p, err := h.service.GetPuzzle(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Задача не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"puzzle": p.ToAPIView()})
}

// StartAttempt handles POST /puzzles/:id/attempts — idempotent (see
// Service.StartAttempt).
func (h *Handlers) StartAttempt(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	puzzleID, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}
	attempt, err := h.service.StartAttempt(r.Context(), userID, puzzleID)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Задача не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusCreated, map[string]any{"attemptId": attempt.ID})
}

type submitMoveRequest struct {
	Move string `json:"move" validate:"required"`
}

// SubmitMove handles POST /attempts/:id/moves (FR-024–025).
func (h *Handlers) SubmitMove(w http.ResponseWriter, r *http.Request) {
	attemptID, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор попытки", nil)
		return
	}
	var req submitMoveRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Укажите ход", nil)
		return
	}

	result, err := h.service.SubmitMove(r.Context(), attemptID, req.Move)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Попытка не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"correct":      result.Correct,
		"outcome":      result.Outcome,
		"opponentMove": result.OpponentMove,
	})
}

// Simplify handles POST /attempts/:id/simplify (FR-026).
func (h *Handlers) Simplify(w http.ResponseWriter, r *http.Request) {
	attemptID, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор попытки", nil)
		return
	}

	p, err := h.service.Simplify(r.Context(), attemptID)
	switch {
	case errors.Is(err, ErrSimplifyLimitReached):
		httpserver.WriteError(w, http.StatusConflict, httpserver.ErrorCode("SIMPLIFY_LIMIT_REACHED"),
			"Эту задачу больше нельзя упростить — достигнут предел упрощений", nil)
		return
	case errors.Is(err, ErrNotFound):
		httpserver.WriteNotFound(w, "Попытка не найдена")
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"puzzle": p.ToAPIView()})
}

// RequestHint handles POST /attempts/:id/hints (FR-027). On exhaustion it
// reads the hint_packages catalog directly via SQL (h.repo) rather than
// importing internal/billing, per this architecture's convention of
// separate domain packages reading shared tables directly instead of
// importing one another — see model.go HintPackageView doc.
func (h *Handlers) RequestHint(w http.ResponseWriter, r *http.Request) {
	attemptID, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор попытки", nil)
		return
	}

	hint, hintsUsed, err := h.service.RequestHint(r.Context(), attemptID)
	if errors.Is(err, ErrHintsExhausted) {
		packages, pkgErr := h.repo.ListHintPackages(r.Context())
		if pkgErr != nil {
			httpserver.WriteInternalError(w, pkgErr)
			return
		}
		httpserver.WriteError(w, http.StatusPaymentRequired, httpserver.ErrorCode("HINTS_EXHAUSTED"),
			"Бесплатные подсказки для этой задачи закончились. Пополните баланс, чтобы получить больше.",
			map[string]any{"hintPackages": packages})
		return
	}
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Попытка не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"hint":           hint,
		"hintsRemaining": FreeHintsPerPuzzle - hintsUsed,
	})
}

// RevealSolution handles POST /attempts/:id/reveal-solution (FR-028).
func (h *Handlers) RevealSolution(w http.ResponseWriter, r *http.Request) {
	attemptID, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор попытки", nil)
		return
	}
	line, err := h.service.RevealSolution(r.Context(), attemptID)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Попытка не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"solutionLine": line})
}
