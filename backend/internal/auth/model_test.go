package auth

import "testing"

// TestDeriveAgeTier_ConsentBoundaries locks in the corrected age-gate logic
// documented in spec.md Assumptions: everyone under 18 (child AND teen)
// requires guardian consent, 18+ never does. This is the exact bug the
// audited Figma prototype had backwards — this test exists specifically so
// nobody re-introduces that reversal.
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
