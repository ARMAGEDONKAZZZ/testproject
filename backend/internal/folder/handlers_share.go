package folder

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

type shareRequest struct {
	Password *string `json:"password"`
}

// POST /folders/:id/share — FR-058/FR-059. Only valid while the folder is
// Public; the handler just forwards the business rule from Service.Share.
func (h *Handlers) Share(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	folderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор папки", nil)
		return
	}
	var req shareRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	shareURL, slug, err := h.service.Share(r.Context(), folderID, userID, req.Password)
	if handleServiceError(w, err) {
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"shareUrl": shareURL, "slug": slug})
}

// GET /share/:slug — Public, no authMiddleware (see routes.go). Reads the
// optional X-Share-Password header instead of a Bearer token.
func (h *Handlers) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	password := r.Header.Get("X-Share-Password")

	f, puzzles, err := h.service.GetBySlug(r.Context(), slug, password)
	if errors.Is(err, ErrPasswordRequired) {
		httpserver.WriteError(w, http.StatusUnauthorized, httpserver.ErrorCode("PASSWORD_REQUIRED"), "Для просмотра требуется пароль", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Папка не найдена или недоступна")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"folder": f.ToAPIView(),
		"items":  puzzleAPIViews(puzzles),
	})
}

type checkGuestMoveRequest struct {
	Move      string `json:"move"`
	MoveIndex int    `json:"moveIndex"` // which ply of solution_line this move is for; omitted/0 for the first move
}

// POST /share/:slug/puzzles/:puzzleId/check-move — Public, no
// authMiddleware, same X-Share-Password gate as GetBySlug. Backs the guest
// solving view (figma/"Задача веб вью по ссылке.svg"): validates a move
// server-side without ever sending the solution to the client, but persists
// nothing (see Service.CheckGuestMove).
func (h *Handlers) CheckGuestMove(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	password := r.Header.Get("X-Share-Password")
	puzzleID, err := uuid.Parse(chi.URLParam(r, "puzzleId"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}
	var req checkGuestMoveRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}

	correct, opponentMove, err := h.service.CheckGuestMove(r.Context(), slug, password, puzzleID, req.MoveIndex, req.Move)
	if errors.Is(err, ErrPasswordRequired) {
		httpserver.WriteError(w, http.StatusUnauthorized, httpserver.ErrorCode("PASSWORD_REQUIRED"), "Для просмотра требуется пароль", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Задача не найдена или недоступна")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"correct": correct, "opponentMove": opponentMove})
}

// GET /favorites — Bearer required. FR-039/FR-040.
func (h *Handlers) ListFavorites(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	var tag, sideToMove *string
	if v := r.URL.Query().Get("tag"); v != "" {
		tag = &v
	}
	if v := r.URL.Query().Get("sideToMove"); v != "" {
		sideToMove = &v
	}
	puzzles, err := h.service.ListFavorites(r.Context(), userID, tag, sideToMove)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, puzzleAPIViews(puzzles))
}
