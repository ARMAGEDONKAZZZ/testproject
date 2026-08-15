package folder

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
	"github.com/neuratop/backend/internal/puzzlemodel"
)

type Handlers struct {
	service *Service
}

// callerID reads the authenticated user id injected by httpserver.RequireAuth.
// Every handler in this file is mounted behind authMiddleware (see routes.go).
func callerID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return uuid.UUID{}, false
	}
	return id, true
}

func puzzleAPIViews(puzzles []puzzlemodel.Puzzle) []puzzlemodel.APIView {
	views := make([]puzzlemodel.APIView, 0, len(puzzles))
	for _, p := range puzzles {
		views = append(views, p.ToAPIView())
	}
	return views
}

// GET /history — FR-034.
func (h *Handlers) History(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))

	puzzles, total, err := h.service.ListHistory(r.Context(), userID, page, pageSize)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSONMeta(w, http.StatusOK, puzzleAPIViews(puzzles), map[string]any{"total": total})
}

// GET /folders.
func (h *Handlers) ListFolders(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	private, public, err := h.service.ListFolders(r.Context(), userID)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"private": summariesToAPIViews(private),
		"public":  summariesToAPIViews(public),
	})
}

func summariesToAPIViews(summaries []FolderSummary) []APIView {
	views := make([]APIView, 0, len(summaries))
	for _, s := range summaries {
		views = append(views, s.ToAPIView())
	}
	return views
}

type createFolderRequest struct {
	Visibility string `json:"visibility"`
}

// POST /folders — name-less create, default "Untitled" (FR-035).
func (h *Handlers) CreateFolder(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	var req createFolderRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	f, err := h.service.CreateFolder(r.Context(), userID, req.Visibility)
	if handleServiceError(w, err) {
		return
	}
	httpserver.WriteJSON(w, http.StatusCreated, map[string]any{"folder": f.ToAPIView()})
}

type updateFolderRequest struct {
	Name       *string `json:"name"`
	Visibility *string `json:"visibility"`
}

// PATCH /folders/:id — rename and/or change visibility.
func (h *Handlers) UpdateFolder(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	folderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор папки", nil)
		return
	}
	var req updateFolderRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	f, err := h.service.UpdateFolder(r.Context(), folderID, userID, req.Name, req.Visibility)
	if handleServiceError(w, err) {
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"folder": f.ToAPIView()})
}

// DELETE /folders/:id?confirm=true — FR-038.
func (h *Handlers) DeleteFolder(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	folderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор папки", nil)
		return
	}
	confirmed := r.URL.Query().Get("confirm") == "true"
	err = h.service.DeleteFolder(r.Context(), folderID, userID, confirmed)
	if errors.Is(err, ErrConfirmationRequired) {
		httpserver.WriteConflict(w, "Требуется подтверждение удаления папки (передайте confirm=true)", nil)
		return
	}
	if handleServiceError(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /folders/:id/items — owner-only listing (see routes.go: this endpoint
// sits behind authMiddleware; anonymous/public access to a shared folder
// goes through GET /share/:slug instead).
func (h *Handlers) ListFolderItems(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	folderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор папки", nil)
		return
	}
	puzzles, err := h.service.ListItems(r.Context(), folderID, &userID, "")
	if handleServiceError(w, err) {
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, puzzleAPIViews(puzzles))
}

type addItemsRequest struct {
	PuzzleIDs []uuid.UUID `json:"puzzleIds"`
}

// POST /folders/:id/items — multi-select add; drag-and-drop and the
// context-menu action on the frontend both call this same endpoint (FR-036).
func (h *Handlers) AddFolderItems(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	folderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор папки", nil)
		return
	}
	var req addItemsRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := h.service.AddItems(r.Context(), folderID, userID, req.PuzzleIDs); handleServiceError(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /folders/:id/items/:puzzleId — FR-037.
func (h *Handlers) RemoveFolderItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}
	folderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор папки", nil)
		return
	}
	puzzleID, err := uuid.Parse(chi.URLParam(r, "puzzleId"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}
	if err := h.service.RemoveItem(r.Context(), folderID, userID, puzzleID); handleServiceError(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleServiceError maps the small set of sentinel errors this package's
// Service returns onto the shared error envelope (envelope.go). It returns
// true (and has already written the response) when err was handled, so
// callers can `if handleServiceError(w, err) { return }`.
func handleServiceError(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, ErrNotFound):
		httpserver.WriteNotFound(w, "Папка не найдена")
	case errors.Is(err, ErrForbidden):
		httpserver.WriteForbidden(w, "У вас нет доступа к этой папке")
	case errors.Is(err, ErrValidation):
		httpserver.WriteValidationError(w, err.Error(), nil)
	case errors.Is(err, ErrConfirmationRequired):
		httpserver.WriteConflict(w, "Требуется подтверждение", nil)
	case errors.Is(err, ErrPasswordRequired):
		httpserver.WriteError(w, http.StatusUnauthorized, httpserver.ErrorCode("PASSWORD_REQUIRED"), "Неверный или отсутствующий пароль для просмотра", nil)
	default:
		httpserver.WriteInternalError(w, err)
	}
	return true
}
