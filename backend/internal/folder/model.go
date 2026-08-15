// Package folder implements history, folders, favorites, and folder sharing
// (specs/001-neuratop-mvp/spec.md User Story 4 & 8, FR-034–042, FR-058–060).
//
// It reads and writes the `folders`, `folder_items`, and `favorite_items`
// tables directly, and reads (never writes) the shared `puzzles` table —
// writing puzzle rows is the generation package's responsibility. Like
// puzzle/generation, this package deliberately does not import the puzzle
// package's service; it reads the shared tables with its own SQL, keyed off
// the shared internal/puzzlemodel.Puzzle type for the JSON view.
package folder

import (
	"time"

	"github.com/google/uuid"
)

// Visibility values for folders.visibility (data-model.md).
const (
	VisibilityPrivate = "private"
	VisibilityPublic  = "public"
)

// defaultFolderName is assigned to every newly created folder — the create
// flow only asks for visibility, never a name (FR-035, docs/design-audit/folders.md
// Экран 11 "Новая папка").
const defaultFolderName = "Untitled"

// Folder mirrors the `folders` table.
type Folder struct {
	ID                uuid.UUID
	OwnerUserID       uuid.UUID
	Name              string
	Visibility        string
	ShareSlug         *string
	SharePasswordHash *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// FolderSummary is a Folder plus its live item count, used for the sidebar
// list (GET /folders). Counts are always computed from folder_items — never
// a placeholder value (FR-064; docs/design-audit/folders.md flags the
// audited mocks' identical "18" counters across every folder as a defect to
// fix, not a pattern to copy).
type FolderSummary struct {
	Folder
	ItemCount int
}

// APIView is the JSON shape returned to clients for a single folder. It
// never exposes SharePasswordHash.
type APIView struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Visibility string    `json:"visibility"`
	ItemCount  int       `json:"itemCount"`
	ShareSlug  *string   `json:"shareSlug,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (f Folder) toAPIView(itemCount int) APIView {
	return APIView{
		ID:         f.ID,
		Name:       f.Name,
		Visibility: f.Visibility,
		ItemCount:  itemCount,
		ShareSlug:  f.ShareSlug,
		CreatedAt:  f.CreatedAt,
		UpdatedAt:  f.UpdatedAt,
	}
}

// ToAPIView renders a Folder (no known item count) for contexts where the
// count isn't loaded, e.g. right after create/update/share.
func (f Folder) ToAPIView() APIView {
	return f.toAPIView(0)
}

// ToAPIView renders a FolderSummary with its real item count.
func (s FolderSummary) ToAPIView() APIView {
	return s.Folder.toAPIView(s.ItemCount)
}
