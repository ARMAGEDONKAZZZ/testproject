package puzzle

import (
	"errors"
	"net/http"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

// AddFavorite handles POST /puzzles/:id/favorite (idempotent add, FR-030).
func (h *Handlers) AddFavorite(w http.ResponseWriter, r *http.Request) {
	h.setFavorite(w, r, true)
}

// RemoveFavorite handles DELETE /puzzles/:id/favorite (idempotent remove, FR-030).
func (h *Handlers) RemoveFavorite(w http.ResponseWriter, r *http.Request) {
	h.setFavorite(w, r, false)
}

func (h *Handlers) setFavorite(w http.ResponseWriter, r *http.Request, add bool) {
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
	if err := h.service.ToggleFavorite(r.Context(), userID, puzzleID, add); err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Export handles GET /puzzles/:id/export?format=pgn|fen|image (FR-031).
func (h *Handlers) Export(w http.ResponseWriter, r *http.Request) {
	puzzleID, err := parseIDParam(r, "id")
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}
	format := r.URL.Query().Get("format")

	result, err := h.service.Export(r.Context(), puzzleID, format)
	switch {
	case errors.Is(err, ErrExportNotImplemented):
		httpserver.WriteError(w, http.StatusNotImplemented, httpserver.ErrorCode("NOT_IMPLEMENTED"),
			"Экспорт в изображение пока не поддерживается", nil)
		return
	case errors.Is(err, ErrInvalidExportFormat):
		httpserver.WriteValidationError(w, "Формат экспорта должен быть pgn, fen или image", map[string]any{"field": "format"})
		return
	case errors.Is(err, ErrNotFound):
		httpserver.WriteNotFound(w, "Задача не найдена")
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	w.Header().Set("Content-Type", result.ContentType)
	w.Header().Set("Content-Disposition", `attachment; filename="`+result.Filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(result.Body)
}
