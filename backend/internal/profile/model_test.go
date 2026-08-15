package profile

import "testing"

// TestDeriveAgeTier_ConsentBoundaries mirrors
// internal/auth/model_test.go's TestDeriveAgeTier_ConsentBoundaries. This
// package intentionally duplicates auth's DeriveAgeTier/RequiresGuardianConsent
// (see model.go for why) so this test locks in the same corrected age-gate
// logic here too: everyone under 18 (child AND teen) requires guardian
// consent, 18+ never does — the exact branch the audited Figma prototype
// had reversed. If the duplicate ever drifts from the canonical
// implementation, this test (and auth's) should catch it.
func TestDeriveAgeTier_ConsentBoundaries(t *testing.T) {
	cases := []struct {
		age              int16
		wantTier         string
		wantNeedsConsent bool
	}{
		{age: 0, wantTier: "child", wantNeedsConsent: true},
		{age: 11, wantTier: "child", wantNeedsConsent: true},
		{age: 12, wantTier: "teen", wantNeedsConsent: true},
		{age: 17, wantTier: "teen", wantNeedsConsent: true},
		{age: 18, wantTier: "adult", wantNeedsConsent: false},
		{age: 25, wantTier: "adult", wantNeedsConsent: false},
		{age: 120, wantTier: "adult", wantNeedsConsent: false},
	}

	for _, c := range cases {
		gotTier := DeriveAgeTier(c.age)
		if gotTier != c.wantTier {
			t.Errorf("DeriveAgeTier(%d) = %q, want %q", c.age, gotTier, c.wantTier)
		}
		gotConsent := RequiresGuardianConsent(gotTier)
		if gotConsent != c.wantNeedsConsent {
			t.Errorf("RequiresGuardianConsent(%q) for age %d = %v, want %v", gotTier, c.age, gotConsent, c.wantNeedsConsent)
		}
	}
}
