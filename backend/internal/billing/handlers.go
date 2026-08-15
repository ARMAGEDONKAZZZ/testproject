package billing

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

var validate = validator.New()

type Handlers struct {
	service *Service
}

// --- response shapes ---

type hintPackageResponse struct {
	ID           uuid.UUID `json:"id"`
	Label        string    `json:"label"`
	HintCount    *int      `json:"hintCount"`
	PriceCredits int       `json:"priceCredits"`
	IsFeatured   bool      `json:"isFeatured"`
	SortOrder    int16     `json:"sortOrder"`
}

func toHintPackageResponse(p HintPackage) hintPackageResponse {
	return hintPackageResponse{
		ID:           p.ID,
		Label:        p.Label,
		HintCount:    p.HintCount,
		PriceCredits: p.PriceCredits,
		IsFeatured:   p.IsFeatured,
		SortOrder:    p.SortOrder,
	}
}

type transactionResponse struct {
	ID                   uuid.UUID  `json:"id"`
	Amount               int        `json:"amount"`
	Reason               string     `json:"reason"`
	RelatedPuzzleID      *uuid.UUID `json:"relatedPuzzleId,omitempty"`
	RelatedHintPackageID *uuid.UUID `json:"relatedHintPackageId,omitempty"`
	CreatedAt            time.Time  `json:"createdAt"`
}

func toTransactionResponse(t CreditTransaction) transactionResponse {
	return transactionResponse{
		ID:                   t.ID,
		Amount:               t.Amount,
		Reason:               t.Reason,
		RelatedPuzzleID:      t.RelatedPuzzleID,
		RelatedHintPackageID: t.RelatedHintPackageID,
		CreatedAt:            t.CreatedAt,
	}
}

// --- handlers ---

// GetCredits handles GET /me/credits (FR-052).
func (h *Handlers) GetCredits(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	balance, err := h.service.GetBalance(r.Context(), userID)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Пользователь не найден")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"balance": balance})
}

// ListHintPackages handles GET /hint-packages (FR-053).
func (h *Handlers) ListHintPackages(w http.ResponseWriter, r *http.Request) {
	packages, err := h.service.ListHintPackages(r.Context())
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	resp := make([]hintPackageResponse, 0, len(packages))
	for _, p := range packages {
		resp = append(resp, toHintPackageResponse(p))
	}
	httpserver.WriteJSON(w, http.StatusOK, resp)
}

type purchaseRequest struct {
	AttemptID uuid.UUID `json:"attemptId" validate:"required"`
}

// PurchaseHintPackage handles POST /hint-packages/:id/purchase (FR-054).
func (h *Handlers) PurchaseHintPackage(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}

	packageID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpserver.WriteValidationError(w, "Некорректный идентификатор пакета подсказок", nil)
		return
	}

	var req purchaseRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Укажите попытку решения (attemptId)", nil)
		return
	}

	result, err := h.service.PurchaseHintPackage(r.Context(), userID, packageID, req.AttemptID)
	switch {
	case errors.Is(err, ErrInsufficientCredits):
		httpserver.WriteError(w, http.StatusPaymentRequired, httpserver.ErrorCode("INSUFFICIENT_CREDITS"),
			"Недостаточно кредитов для покупки этого пакета подсказок", nil)
		return
	case errors.Is(err, ErrNotFound):
		httpserver.WriteNotFound(w, "Пакет подсказок не найден")
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{
		"balance":        result.Balance,
		"hintsRemaining": result.HintsRemaining,
	})
}

// ListTransactions handles GET /me/transactions (FR-055).
func (h *Handlers) ListTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}

	page := parseIntQuery(r, "page", 1)
	pageSize := parseIntQuery(r, "pageSize", 20)

	txns, err := h.service.ListTransactions(r.Context(), userID, page, pageSize)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	resp := make([]transactionResponse, 0, len(txns))
	for _, t := range txns {
		resp = append(resp, toTransactionResponse(t))
	}
	httpserver.WriteJSONMeta(w, http.StatusOK, resp, map[string]any{"page": page, "pageSize": pageSize})
}

type topupRequest struct {
	Amount int `json:"amount" validate:"required,min=1"`
}

// Topup handles POST /me/credits/topup — the simulated payment provider
// (FR-057, research.md "Payments / credit top-up").
func (h *Handlers) Topup(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}

	var req topupRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Укажите положительную сумму пополнения", nil)
		return
	}

	balance, err := h.service.SimulatedTopup(r.Context(), userID, req.Amount)
	if errors.Is(err, ErrInvalidAmount) {
		httpserver.WriteValidationError(w, err.Error(), nil)
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"balance": balance})
}

// parseIntQuery reads a positive integer query param, falling back to def
// when absent or unparseable — pagination params are UX-only bounds, not a
// source of validation errors worth failing the request over.
func parseIntQuery(r *http.Request, key string, def int) int {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return def
	}
	return n
}
