package folder

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/neuratop/backend/internal/puzzlemodel"
)

var (
	// ErrForbidden: the caller is authenticated but does not own the folder.
	ErrForbidden = errors.New("forbidden")
	// ErrValidation: the request violates a business rule (bad visibility
	// value, empty name, sharing a private folder, ...).
	ErrValidation = errors.New("validation")
	// ErrConfirmationRequired: folder delete was attempted without
	// confirm=true (FR-038).
	ErrConfirmationRequired = errors.New("confirmation required")
	// ErrPasswordRequired: a share password is set and the caller didn't
	// supply the right one (FR-059).
	ErrPasswordRequired = errors.New("password required")
)

type Service struct {
	repo          *Repository
	publicBaseURL string
}

func NewService(repo *Repository, publicBaseURL string) *Service {
	return &Service{repo: repo, publicBaseURL: publicBaseURL}
}

// --- folder CRUD ---

// CreateFolder creates a new folder with the fixed default name "Untitled"
// (FR-035) — the create flow only ever asks for visibility.
func (s *Service) CreateFolder(ctx context.Context, ownerID uuid.UUID, visibility string) (Folder, error) {
	if !isValidVisibility(visibility) {
		return Folder{}, fmt.Errorf("%w: недопустимый уровень доступа папки", ErrValidation)
	}
	return s.repo.CreateFolder(ctx, ownerID, defaultFolderName, visibility)
}

// UpdateFolder renames and/or changes the visibility of a folder the caller
// owns (FR-035 rename, US8 Scenario 1 visibility toggle). Any field left nil
// is left unchanged.
func (s *Service) UpdateFolder(ctx context.Context, folderID, ownerID uuid.UUID, name, visibility *string) (Folder, error) {
	f, err := s.repo.GetFolderByID(ctx, folderID)
	if err != nil {
		return Folder{}, err
	}
	if f.OwnerUserID != ownerID {
		return Folder{}, ErrForbidden
	}
	if visibility != nil && !isValidVisibility(*visibility) {
		return Folder{}, fmt.Errorf("%w: недопустимый уровень доступа папки", ErrValidation)
	}
	if name != nil && strings.TrimSpace(*name) == "" {
		return Folder{}, fmt.Errorf("%w: имя папки не может быть пустым", ErrValidation)
	}
	return s.repo.UpdateFolder(ctx, folderID, name, visibility)
}

// DeleteFolder removes a folder the caller owns. It requires an explicit
// confirmed=true (FR-038) and never deletes the puzzles it contained — only
// the folders row and (via FK cascade) the folder_items join rows.
func (s *Service) DeleteFolder(ctx context.Context, folderID, ownerID uuid.UUID, confirmed bool) error {
	f, err := s.repo.GetFolderByID(ctx, folderID)
	if err != nil {
		return err
	}
	if f.OwnerUserID != ownerID {
		return ErrForbidden
	}
	if !confirmed {
		return ErrConfirmationRequired
	}
	return s.repo.DeleteFolder(ctx, folderID)
}

// ListFolders returns the caller's folders split into private/public
// buckets, matching the sidebar layout in docs/design-audit/folders.md.
func (s *Service) ListFolders(ctx context.Context, ownerID uuid.UUID) (private, public []FolderSummary, err error) {
	all, err := s.repo.ListFoldersByOwner(ctx, ownerID)
	if err != nil {
		return nil, nil, err
	}
	for _, f := range all {
		if f.Visibility == VisibilityPrivate {
			private = append(private, f)
		} else {
			public = append(public, f)
		}
	}
	return private, public, nil
}

// --- folder items ---

// AddItems adds one or more puzzles to a folder the caller owns. All three
// frontend entry points (multi-select picker, drag-and-drop, context menu)
// funnel through this single method so they always produce the same
// resulting state (FR-036).
func (s *Service) AddItems(ctx context.Context, folderID, ownerID uuid.UUID, puzzleIDs []uuid.UUID) error {
	f, err := s.repo.GetFolderByID(ctx, folderID)
	if err != nil {
		return err
	}
	if f.OwnerUserID != ownerID {
		return ErrForbidden
	}
	if len(puzzleIDs) == 0 {
		return fmt.Errorf("%w: список задач пуст", ErrValidation)
	}
	return s.repo.AddFolderItems(ctx, folderID, puzzleIDs)
}

// RemoveItem removes a puzzle from a folder the caller owns without
// deleting the puzzle itself (FR-037).
func (s *Service) RemoveItem(ctx context.Context, folderID, ownerID, puzzleID uuid.UUID) error {
	f, err := s.repo.GetFolderByID(ctx, folderID)
	if err != nil {
		return err
	}
	if f.OwnerUserID != ownerID {
		return ErrForbidden
	}
	return s.repo.RemoveFolderItem(ctx, folderID, puzzleID)
}

// ListItems returns the puzzles inside folderID for callerID (nil for an
// anonymous caller). A private folder is only visible to its owner — a
// non-owner gets ErrNotFound rather than ErrForbidden so the endpoint never
// confirms whether a given private folder id exists. A public folder is
// visible to anyone, gated by its share password if one is set.
func (s *Service) ListItems(ctx context.Context, folderID uuid.UUID, callerID *uuid.UUID, sharePasswordProvided string) ([]puzzlemodel.Puzzle, error) {
	f, err := s.repo.GetFolderByID(ctx, folderID)
	if err != nil {
		return nil, err
	}
	return s.listItemsForFolder(ctx, f, callerID, sharePasswordProvided)
}

func (s *Service) listItemsForFolder(ctx context.Context, f Folder, callerID *uuid.UUID, sharePasswordProvided string) ([]puzzlemodel.Puzzle, error) {
	isOwner := callerID != nil && *callerID == f.OwnerUserID
	if f.Visibility == VisibilityPrivate {
		if !isOwner {
			return nil, ErrNotFound
		}
	} else if !isOwner && f.SharePasswordHash != nil {
		if err := bcrypt.CompareHashAndPassword([]byte(*f.SharePasswordHash), []byte(sharePasswordProvided)); err != nil {
			return nil, ErrPasswordRequired
		}
	}
	return s.repo.ListFolderItems(ctx, f.ID)
}

// --- favorites ---

// ListFavorites returns userID's favorited puzzles, optionally filtered by
// tactical tag and/or side-to-move (FR-040). Toggling favorite status is
// owned by the puzzle package (per FR-030/FR-039); this package only reads
// the shared favorite_items table for the aggregating "Избранное" view.
func (s *Service) ListFavorites(ctx context.Context, userID uuid.UUID, tag, sideToMove *string) ([]puzzlemodel.Puzzle, error) {
	return s.repo.ListFavorites(ctx, userID, tag, sideToMove)
}

// --- history ---

// ListHistory returns a page of ownerID's generated puzzles (FR-034),
// newest first, plus the total row count for pagination metadata.
func (s *Service) ListHistory(ctx context.Context, ownerID uuid.UUID, page, pageSize int) ([]puzzlemodel.Puzzle, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.ListHistory(ctx, ownerID, page, pageSize)
}

// --- sharing ---

// validateShareable enforces FR-058: only a Public folder can be shared.
// Pulled out as a small pure function so the rule is unit-testable without a
// database (see service_test.go).
func validateShareable(visibility string) error {
	if visibility != VisibilityPublic {
		return fmt.Errorf("%w: папка должна быть публичной, чтобы поделиться ею", ErrValidation)
	}
	return nil
}

func isValidVisibility(v string) bool {
	return v == VisibilityPrivate || v == VisibilityPublic
}

// GenerateShareSlug returns a fresh, URL-safe, effectively-unique token for
// a folder's public share link: a UUID with its dashes stripped, truncated
// to 12 hex characters. Real collision-safety comes from the database's
// UNIQUE constraint on folders.share_slug plus the retry loop in Share.
func GenerateShareSlug() string {
	raw := strings.ReplaceAll(uuid.NewString(), "-", "")
	return raw[:12]
}

// shareURLForSlug builds the absolute link handed back to the client. The
// path MUST match the SPA route that actually renders a shared folder
// (App.tsx: <Route path="/share/:slug" element={<SharedFolderPage />} />) —
// this previously pointed at a hardcoded "neuratop.com/board/…" that matched
// neither the deployed origin nor any real frontend route, so every
// generated link was a dead end regardless of visibility/password.
func shareURLForSlug(publicBaseURL, slug string) string {
	return strings.TrimSuffix(publicBaseURL, "/") + "/share/" + slug
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// Share generates (or regenerates) a public share link for a folder the
// caller owns. The folder MUST already be Public (FR-058) — Private folders
// cannot be shared at all, not even to get a not-yet-active link. An
// optional password is bcrypt-hashed and stored; a blank/nil password clears
// any previously set password.
func (s *Service) Share(ctx context.Context, folderID, ownerID uuid.UUID, password *string) (shareURL, slug string, err error) {
	f, err := s.repo.GetFolderByID(ctx, folderID)
	if err != nil {
		return "", "", err
	}
	if f.OwnerUserID != ownerID {
		return "", "", ErrForbidden
	}
	if err := validateShareable(f.Visibility); err != nil {
		return "", "", err
	}

	var passwordHash *string
	if password != nil && *password != "" {
		hash, hErr := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
		if hErr != nil {
			return "", "", hErr
		}
		h := string(hash)
		passwordHash = &h
	}

	const maxAttempts = 5
	for attempt := 0; attempt < maxAttempts; attempt++ {
		candidate := GenerateShareSlug()
		if _, setErr := s.repo.SetShare(ctx, folderID, candidate, passwordHash); setErr == nil {
			return shareURLForSlug(s.publicBaseURL, candidate), candidate, nil
		} else if !isUniqueViolation(setErr) {
			return "", "", setErr
		} else {
			err = setErr
		}
	}
	return "", "", fmt.Errorf("не удалось сгенерировать уникальную ссылку: %w", err)
}

// GetBySlug resolves a public share link (FR-058 scenario: switching a
// folder back to Private immediately revokes third-party access even though
// the share_slug row is kept for history). If a view password is set, the
// caller must supply the matching plaintext password.
func (s *Service) GetBySlug(ctx context.Context, slug, providedPassword string) (Folder, []puzzlemodel.Puzzle, error) {
	f, err := s.repo.GetFolderBySlug(ctx, slug)
	if err != nil {
		return Folder{}, nil, ErrNotFound
	}
	if f.Visibility != VisibilityPublic {
		return Folder{}, nil, ErrNotFound
	}
	items, err := s.listItemsForFolder(ctx, f, nil, providedPassword)
	if err != nil {
		return Folder{}, nil, err
	}
	return f, items, nil
}

// CheckGuestMove validates a move against puzzleID's solution for a guest
// viewing it through a public share link (figma/"Задача веб вью по
// ссылке.svg"). Guest attempts are stateless by design — nothing is
// persisted, no solve_attempts row, no skill_profiles bump — the puzzle
// screen's own CTA ("Зарегистрируйтесь, чтобы отслеживать прогресс...") is
// the point: an account is what turns a solve into tracked progress.
// Re-derives the slug/password/visibility gate independently rather than
// trusting a prior GetBySlug call, since this is a separate request.
func (s *Service) CheckGuestMove(ctx context.Context, slug, providedPassword string, puzzleID uuid.UUID, move string) (bool, error) {
	f, err := s.repo.GetFolderBySlug(ctx, slug)
	if err != nil {
		return false, ErrNotFound
	}
	if f.Visibility != VisibilityPublic {
		return false, ErrNotFound
	}
	if f.SharePasswordHash != nil {
		if err := bcrypt.CompareHashAndPassword([]byte(*f.SharePasswordHash), []byte(providedPassword)); err != nil {
			return false, ErrPasswordRequired
		}
	}
	solution, err := s.repo.GetPuzzleSolutionFirstMove(ctx, f.ID, puzzleID)
	if err != nil {
		return false, err
	}
	return strings.EqualFold(strings.TrimSpace(move), strings.TrimSpace(solution)), nil
}
