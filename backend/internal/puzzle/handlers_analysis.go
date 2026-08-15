package puzzle

import (
	"errors"
	"net/http"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

// GetAnalysis handles GET /attempts/:id/analysis. The endpoint is scoped to
// an attempt (rest-api.md), so it first resolves the attempt's puzzle_id,
// then returns the puzzle's stored mock_eval as-is (Service.GetAnalysis —
// MOCKED, no live engine).
func (h *Handlers) GetAnalysis(w http.ResponseWriter, r *http.Request) {
	attemptID, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор попытки", nil)
		return
	}

	attempt, err := h.service.GetAttempt(r.Context(), attemptID)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Попытка не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}

	eval, err := h.service.GetAnalysis(r.Context(), attempt.PuzzleID)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"evaluation": eval.Evaluation,
		"bestMove":   eval.BestMove,
		"depth":      eval.Depth,
	})
}
