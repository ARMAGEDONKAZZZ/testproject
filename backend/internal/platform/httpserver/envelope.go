// Package httpserver provides the shared HTTP plumbing (router, envelope,
// middleware) used by every domain package's handlers.
package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// ErrorCode is one of the small, fixed set of machine-readable error codes
// used across the whole API (Constitution IV: one consistent error shape).
type ErrorCode string

const (
	CodeValidation      ErrorCode = "VALIDATION_ERROR"
	CodeUnauthenticated ErrorCode = "UNAUTHENTICATED"
	CodeForbidden       ErrorCode = "FORBIDDEN"
	CodeNotFound        ErrorCode = "NOT_FOUND"
	CodeConflict        ErrorCode = "CONFLICT"
	CodeRateLimited     ErrorCode = "RATE_LIMITED"
	CodeInternal        ErrorCode = "INTERNAL_ERROR"
)

type apiError struct {
	Code    ErrorCode      `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type errorEnvelope struct {
	Error apiError `json:"error"`
}

type dataEnvelope struct {
	Data any            `json:"data"`
	Meta map[string]any `json:"meta,omitempty"`
}

// WriteJSON writes a successful {"data": ...} envelope.
func WriteJSON(w http.ResponseWriter, status int, data any) {
	WriteJSONMeta(w, status, data, nil)
}

// WriteJSONMeta writes a successful {"data": ..., "meta": ...} envelope.
func WriteJSONMeta(w http.ResponseWriter, status int, data any, meta map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(dataEnvelope{Data: data, Meta: meta}); err != nil {
		slog.Error("failed writing json response", "error", err)
	}
}

// WriteError writes the shared {"error": {...}} envelope. Every handler in
// the codebase MUST go through this helper so error shape never drifts.
func WriteError(w http.ResponseWriter, status int, code ErrorCode, message string, details map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(errorEnvelope{Error: apiError{Code: code, Message: message, Details: details}}); err != nil {
		slog.Error("failed writing error response", "error", err)
	}
}

// Common shortcuts for the error codes every domain package needs.

func WriteValidationError(w http.ResponseWriter, message string, details map[string]any) {
	WriteError(w, http.StatusBadRequest, CodeValidation, message, details)
}

func WriteUnauthenticated(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusUnauthorized, CodeUnauthenticated, message, nil)
}

func WriteForbidden(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusForbidden, CodeForbidden, message, nil)
}

func WriteNotFound(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusNotFound, CodeNotFound, message, nil)
}

func WriteConflict(w http.ResponseWriter, message string, details map[string]any) {
	WriteError(w, http.StatusConflict, CodeConflict, message, details)
}

func WriteInternalError(w http.ResponseWriter, err error) {
	slog.Error("internal error", "error", err)
	WriteError(w, http.StatusInternalServerError, CodeInternal, "Внутренняя ошибка сервера. Попробуйте позже.", nil)
}

// DecodeJSON decodes a request body into dst, returning false and writing a
// VALIDATION_ERROR response itself if decoding fails.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		WriteValidationError(w, "Некорректное тело запроса", nil)
		return false
	}
	return true
}
