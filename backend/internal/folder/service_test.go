package folder

import (
	"errors"
	"strings"
	"testing"
)

// TestValidateShareable_OnlyPublicFoldersCanBeShared locks in FR-058: a
// folder must be Public before a share link can be generated for it. This is
// the exact rule Service.Share enforces before ever touching the database,
// pulled out into a pure function so it's testable without pgx/pgxpool.
func TestValidateShareable_OnlyPublicFoldersCanBeShared(t *testing.T) {
	if err := validateShareable(VisibilityPrivate); !errors.Is(err, ErrValidation) {
		t.Errorf("validateShareable(private) = %v, want an ErrValidation", err)
	}
	if err := validateShareable(VisibilityPublic); err != nil {
		t.Errorf("validateShareable(public) = %v, want nil", err)
	}
}

// TestGenerateShareSlug_ShapeAndUniqueness checks the share-slug generator
// (used by Service.Share, FR-058/059) produces dash-free, fixed-length,
// practically-unique tokens suitable for a public URL path segment.
func TestGenerateShareSlug_ShapeAndUniqueness(t *testing.T) {
	const n = 1000
	seen := make(map[string]bool, n)
	for i := 0; i < n; i++ {
		slug := GenerateShareSlug()
		if len(slug) != 12 {
			t.Fatalf("GenerateShareSlug() = %q, want length 12, got %d", slug, len(slug))
		}
		if strings.Contains(slug, "-") {
			t.Fatalf("GenerateShareSlug() = %q, must not contain dashes", slug)
		}
		if seen[slug] {
			t.Fatalf("GenerateShareSlug() produced a duplicate: %q", slug)
		}
		seen[slug] = true
	}
}

func TestShareURLForSlug(t *testing.T) {
	got := shareURLForSlug("abc123def456")
	want := "https://neuratop.com/board/abc123def456"
	if got != want {
		t.Errorf("shareURLForSlug() = %q, want %q", got, want)
	}
}
