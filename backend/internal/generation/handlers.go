package generation

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
	"github.com/neuratop/backend/internal/puzzlemodel"
)

var validate = validator.New()

type Handlers struct {
	service *Service
}

type createGenerationRequest struct {
	InputMode string `json:"inputMode" validate:"required,oneof=text tag image fen_pgn"`
	Payload   string `json:"payload"`
	Count     int16  `json:"count" validate:"omitempty,min=1,max=4"`
}

// CreateGeneration handles POST /generations (FR-013–016).
func (h *Handlers) CreateGeneration(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req createGenerationRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Проверьте режим ввода и количество задач (от 1 до 4)", nil)
		return
	}
	count := req.Count
	if count == 0 {
		count = 4 // FR-015: default count is 4 when not specified.
	}

	g, err := h.service.CreateGeneration(r.Context(), CreateGenerationInput{
		OwnerUserID: userID,
		InputMode:   req.InputMode,
		Payload:     req.Payload,
		Count:       count,
	})
	switch {
	case errors.Is(err, ErrMissingInput):
		httpserver.WriteError(w, http.StatusBadRequest, httpserver.ErrorCode("MISSING_INPUT"),
			"Введите текст, тег, изображение или FEN/PGN для генерации", nil)
		return
	case errors.Is(err, ErrInvalidMode), errors.Is(err, ErrInvalidCount):
		httpserver.WriteValidationError(w, "Некорректные параметры запроса генерации", nil)
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusAccepted, map[string]any{
		"generationId": g.ID,
		"status":       g.Status,
	})
}

// GetGeneration handles GET /generations/:id — poll until status is
// succeeded/failed (FR-016).
func (h *Handlers) GetGeneration(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор генерации", nil)
		return
	}

	g, puzzles, err := h.service.GetGeneration(r.Context(), userID, id)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Генерация не найдена")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}

	views := make([]puzzlemodel.APIView, 0, len(puzzles))
	for _, p := range puzzles {
		views = append(views, p.ToAPIView())
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"generation": g.ToAPIView(),
		"puzzles":    views,
	})
}

// CancelGeneration handles POST /generations/:id/cancel (FR-016).
func (h *Handlers) CancelGeneration(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор генерации", nil)
		return
	}

	if err := h.service.CancelGeneration(r.Context(), userID, id); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpserver.WriteNotFound(w, "Генерация не найдена")
			return
		}
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{})
}
