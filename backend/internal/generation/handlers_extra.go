package generation

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

// ListGenerations handles GET /generations — "История генераций" (FR-023).
func (h *Handlers) ListGenerations(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	page := parsePositiveIntDefault(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveIntDefault(r.URL.Query().Get("pageSize"), 20)

	list, total, err := h.service.ListGenerations(r.Context(), userID, page, pageSize)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}

	views := make([]APIView, 0, len(list))
	for _, g := range list {
		views = append(views, g.ToAPIView())
	}
	httpserver.WriteJSONMeta(w, http.StatusOK, views, map[string]any{
		"page":     page,
		"pageSize": pageSize,
		"total":    total,
	})
}

func parsePositiveIntDefault(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return fallback
	}
	return n
}

// RegeneratePuzzle handles POST /puzzles/:id/regenerate — regenerate a
// single puzzle from a result set without discarding the others (FR-021).
func (h *Handlers) RegeneratePuzzle(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	puzzleID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}

	g, err := h.service.RegeneratePuzzle(r.Context(), userID, puzzleID)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Задача не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusAccepted, map[string]any{"generationId": g.ID})
}

// CurrentFEN handles GET /fen/current/:puzzleId — powers the "copy FEN"
// dialog (FR-020).
func (h *Handlers) CurrentFEN(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	puzzleID, err := uuid.Parse(chi.URLParam(r, "puzzleId"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}

	fen, err := h.service.GetPuzzleFEN(r.Context(), userID, puzzleID)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Задача не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"fen": fen})
}

type generateFromFENRequest struct {
	FEN   string `json:"fen" validate:"required"`
	Count int16  `json:"count" validate:"omitempty,min=1,max=4"`
}

// GenerateFromFEN handles POST /generations/fen — "paste your own FEN to
// generate from a specific position" (FR-013, FR-020). Count defaults to 1
// per the contract.
func (h *Handlers) GenerateFromFEN(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req generateFromFENRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Введите корректный FEN", nil)
		return
	}
	count := req.Count
	if count == 0 {
		count = 1
	}

	g, err := h.service.FromFEN(r.Context(), userID, req.FEN, count)
	if errors.Is(err, ErrMissingInput) {
		httpserver.WriteError(w, http.StatusBadRequest, httpserver.ErrorCode("MISSING_INPUT"), "Введите FEN для генерации", nil)
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusAccepted, map[string]any{"generationId": g.ID})
}
