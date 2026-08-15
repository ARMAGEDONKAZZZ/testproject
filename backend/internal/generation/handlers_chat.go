package generation

import (
	"net/http"
	"sync/atomic"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

// chatReplies is a small, fixed set of canned, topic-plausible responses for
// the mocked AI chat panel (spec.md User Story 7, Scenario 3). Per
// research.md ("AI generation / chat / engine analysis") no real LLM is
// wired up yet — the assistant "returns canned, context-templated replies
// from the same package." This deliberately ignores the puzzle position and
// message content and just cycles through the list so responses don't feel
// perfectly static across a chat session.
var chatReplies = []string{
	"Хороший вопрос! Обрати внимание на позицию ферзя.",
	"Попробуй поискать шахи в этой позиции — часто решение начинается именно с них.",
	"Проверь, есть ли у соперника незащищённые фигуры рядом с королём.",
	"Подумай о жертве материала ради атаки — иногда это ключ к решению задачи.",
	"Оцени, какие поля контролируют твои лёгкие фигуры в этой позиции.",
}

var chatReplyCounter uint64

type chatRequest struct {
	PuzzleID string `json:"puzzleId"`
	Message  string `json:"message" validate:"required"`
}

// Chat handles POST /puzzles/:id/chat — a fully mocked stand-in for the AI
// chat assistant (US7 Scenario 3). No real model is called; the handler
// cycles through chatReplies round-robin so the frontend has a realistic,
// varied response to render for any message.
func (h *Handlers) Chat(w http.ResponseWriter, r *http.Request) {
	if _, ok := httpserver.UserIDFromContext(r.Context()); !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	puzzleID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор задачи", nil)
		return
	}

	var req chatRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Введите текст сообщения", nil)
		return
	}

	next := atomic.AddUint64(&chatReplyCounter, 1)
	reply := chatReplies[next%uint64(len(chatReplies))]

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"puzzleId": puzzleID,
		"reply":    reply,
	})
}
