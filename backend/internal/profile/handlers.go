package profile

import (
	"errors"
	"net/http"

	"github.com/go-playground/validator/v10"

	"github.com/neuratop/backend/internal/platform/httpserver"
)

var validate = validator.New()

type Handlers struct {
	service *Service
}

// --- GET /me ---

func (h *Handlers) GetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}

	res, err := h.service.GetMe(r.Context(), userID)
	if errors.Is(err, ErrNotFound) {
		httpserver.WriteNotFound(w, "Пользователь не найден")
		return
	}
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}

	data := map[string]any{
		"user":             userJSON(res.User),
		"skillProfile":     skillProfileJSON(res.SkillProfile),
		"boardPreferences": boardPreferencesJSON(res.BoardPreferences),
		"onboarding":       onboardingJSON(res.OnboardingState),
	}
	// FR-043/044: parentLink is present only for a minor profile that has a
	// guardian link on file. Whether "email" is present on the user object
	// is decided inside userJSON below.
	if res.User.AgeTier != "adult" && res.ParentLink != nil {
		data["parentLink"] = parentLinkJSON(*res.ParentLink)
	}

	httpserver.WriteJSON(w, http.StatusOK, data)
}

// userJSON renders the user object as a map (not a struct+omitempty) so it
// can OMIT the "email" key entirely for a non-adult account (FR-044)
// instead of emitting `"email": null`. Whether a minor account has an email
// on file at all must not be observable from the response shape, only from
// the key's complete absence — a struct field with `omitempty` still allows
// distinguishing "empty string" from "field not sent" ambiguously depending
// on the JSON encoder version/config, so a hand-built map removes that risk
// entirely.
func userJSON(u User) map[string]any {
	out := map[string]any{
		"id":            u.ID,
		"nickname":      u.Nickname,
		"age":           u.Age,
		"ageTier":       u.AgeTier,
		"language":      u.Language,
		"avatarUrl":     u.AvatarURL,
		"creditBalance": u.CreditBalance,
		"createdAt":     u.CreatedAt,
	}
	if u.AgeTier == "adult" && u.Email != nil {
		out["email"] = *u.Email
	}
	return out
}

func parentLinkJSON(p ParentLink) map[string]any {
	return map[string]any{
		"id":            p.ID,
		"guardianName":  p.GuardianName,
		"guardianEmail": p.GuardianEmail,
		"verified":      p.VerifiedAt != nil,
	}
}

func skillProfileJSON(sp SkillProfile) map[string]any {
	return map[string]any{
		"tactics":     sp.Tactics,
		"strategy":    sp.Strategy,
		"openings":    sp.Openings,
		"endgames":    sp.Endgames,
		"calculation": sp.Calculation,
		"overall":     sp.Overall,
		"focusAxes":   sp.FocusAxes,
		"updatedAt":   sp.UpdatedAt,
	}
}

func boardPreferencesJSON(bp BoardPreferences) map[string]any {
	return map[string]any{
		"theme":             bp.Theme,
		"pieceSet":          bp.PieceSet,
		"showCoordinates":   bp.ShowCoordinates,
		"animationSpeedPct": bp.AnimationSpeedPct,
		"updatedAt":         bp.UpdatedAt,
	}
}

func onboardingJSON(o OnboardingState) map[string]any {
	return map[string]any{
		"role":                o.Role,
		"declaredLevel":       o.DeclaredLevel,
		"wizardCompleted":     o.WizardCompleted,
		"homeTourCompleted":   o.HomeTourCompleted,
		"puzzleTourCompleted": o.PuzzleTourCompleted,
	}
}

// --- PATCH /me ---

type updateProfileRequest struct {
	Name      *string `json:"name" validate:"omitempty,min=1,max=64"`
	Age       *int16  `json:"age" validate:"omitempty,min=0,max=120"`
	AvatarURL *string `json:"avatarUrl"`
}

func (h *Handlers) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req updateProfileRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Проверьте корректность введённых данных", nil)
		return
	}

	user, err := h.service.UpdateProfile(r.Context(), userID, req.Name, req.Age, req.AvatarURL)
	switch {
	case errors.Is(err, ErrConsentRequired):
		// FR-045: age edit would cross into a tier that requires guardian
		// consent, and no verified parent_links row exists yet.
		httpserver.WriteError(w, http.StatusConflict, httpserver.ErrorCode("CONSENT_REQUIRED"),
			"Для этой возрастной категории требуется подтверждённое согласие родителя/опекуна",
			map[string]any{"parentConsentUrl": "/parent-consent/" + userID.String()})
		return
	case errors.Is(err, ErrNotFound):
		httpserver.WriteNotFound(w, "Пользователь не найден")
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"user": userJSON(user)})
}

// --- POST /me/password ---

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword" validate:"required,min=8"`
}

func (h *Handlers) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req changePasswordRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Новый пароль должен быть не короче 8 символов", nil)
		return
	}

	err := h.service.ChangePassword(r.Context(), userID, req.CurrentPassword, req.NewPassword)
	switch {
	case errors.Is(err, ErrForbidden):
		httpserver.WriteForbidden(w, "Смена пароля доступна только взрослым пользователям")
		return
	case errors.Is(err, ErrWrongPassword):
		httpserver.WriteError(w, http.StatusUnauthorized, httpserver.ErrorCode("WRONG_PASSWORD"), "Неверный текущий пароль", nil)
		return
	case errors.Is(err, ErrNotFound):
		httpserver.WriteNotFound(w, "Пользователь не найден")
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{})
}

// --- DELETE /me ---

type deleteAccountRequest struct {
	Confirm bool `json:"confirm"`
}

func (h *Handlers) DeleteMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req deleteAccountRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if !req.Confirm {
		httpserver.WriteValidationError(w, "Требуется явное подтверждение удаления аккаунта (confirm: true)", nil)
		return
	}

	err := h.service.DeleteAccount(r.Context(), userID)
	switch {
	case errors.Is(err, ErrForbidden):
		// FR-044/FR-049: minors have no self-service account deletion.
		httpserver.WriteForbidden(w, "Самостоятельное удаление аккаунта недоступно для несовершеннолетних")
		return
	case errors.Is(err, ErrNotFound):
		httpserver.WriteNotFound(w, "Пользователь не найден")
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- GET /me/skills ---

func (h *Handlers) GetSkills(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	sp, err := h.service.GetSkills(r.Context(), userID)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"skillProfile": skillProfileJSON(sp)})
}

// --- GET /me/training/summary ---

func (h *Handlers) GetTrainingSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	summary, err := h.service.GetTrainingSummary(r.Context(), userID)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"trainingSummary": trainingSummaryJSON(summary)})
}

func trainingSummaryJSON(t TrainingSummary) map[string]any {
	data := map[string]any{
		"sessionsCount":   t.SessionsCount,
		"streakDays":      t.StreakDays,
		"accuracyPercent": t.AccuracyPercent,
		"rating":          t.Rating,
		"ratingDelta":     t.RatingDelta,
	}
	if t.NextTopic != nil {
		data["nextTopic"] = map[string]any{
			"axis":  t.NextTopic.Axis,
			"tag":   t.NextTopic.Tag,
			"label": t.NextTopic.Label,
		}
	}
	return data
}

// --- PATCH /me/skills/focus ---

type setFocusAxesRequest struct {
	Axes []string `json:"axes"`
}

func (h *Handlers) SetFocusAxes(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req setFocusAxesRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}

	sp, err := h.service.SetFocusAxes(r.Context(), userID, req.Axes)
	switch {
	case errors.Is(err, ErrValidation):
		httpserver.WriteValidationError(w, "Можно выбрать не более 3 навыков для фокусировки тренировок", map[string]any{"field": "axes"})
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"skillProfile": skillProfileJSON(sp)})
}

// --- PUT /me/board-preferences ---

type setBoardPreferencesRequest struct {
	Theme             string `json:"theme" validate:"required"`
	PieceSet          string `json:"pieceSet" validate:"required"`
	ShowCoordinates   bool   `json:"showCoordinates"`
	AnimationSpeedPct int    `json:"animationSpeedPct" validate:"min=0,max=100"`
}

func (h *Handlers) SetBoardPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req setBoardPreferencesRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Проверьте параметры настроек доски", nil)
		return
	}

	bp, err := h.service.SetBoardPreferences(r.Context(), userID, req.Theme, req.PieceSet, req.ShowCoordinates, req.AnimationSpeedPct)
	switch {
	case errors.Is(err, ErrValidation):
		httpserver.WriteValidationError(w, "Проверьте параметры настроек доски", nil)
		return
	case err != nil:
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"boardPreferences": boardPreferencesJSON(bp)})
}

// --- PATCH /me/onboarding ---

type updateOnboardingRequest struct {
	Role                *string `json:"role" validate:"omitempty,oneof=student teacher"`
	DeclaredLevel       *string `json:"declaredLevel" validate:"omitempty,oneof=beginner intermediate advanced expert"`
	WizardCompleted     *bool   `json:"wizardCompleted"`
	HomeTourCompleted   *bool   `json:"homeTourCompleted"`
	PuzzleTourCompleted *bool   `json:"puzzleTourCompleted"`
}

func (h *Handlers) UpdateOnboarding(w http.ResponseWriter, r *http.Request) {
	userID, ok := httpserver.UserIDFromContext(r.Context())
	if !ok {
		httpserver.WriteUnauthenticated(w, "Требуется авторизация")
		return
	}
	var req updateOnboardingRequest
	if !httpserver.DecodeJSON(w, r, &req) {
		return
	}
	if err := validate.Struct(req); err != nil {
		httpserver.WriteValidationError(w, "Некорректное значение роли или уровня", nil)
		return
	}

	ob, err := h.service.UpdateOnboardingState(r.Context(), userID, req.Role, req.DeclaredLevel, req.WizardCompleted, req.HomeTourCompleted, req.PuzzleTourCompleted)
	if err != nil {
		httpserver.WriteInternalError(w, err)
		return
	}

	httpserver.WriteJSON(w, http.StatusOK, map[string]any{"onboarding": onboardingJSON(ob)})
}
