package profile

import "testing"

// TestValidateFocusAxes locks in the FR-047 rule ("up to 3 skill axes") at
// the pure-function level, without touching a database — validateFocusAxes
// is the exact gate SetFocusAxes runs before any repository call.
func TestValidateFocusAxes(t *testing.T) {
	cases := []struct {
		name    string
		axes    []string
		wantErr bool
	}{
		{name: "nil axes is fine", axes: nil, wantErr: false},
		{name: "empty axes is fine", axes: []string{}, wantErr: false},
		{name: "one axis", axes: []string{"tactics"}, wantErr: false},
		{name: "exactly three axes at the FR-047 cap", axes: []string{"tactics", "strategy", "openings"}, wantErr: false},
		{name: "all five axes exceeds the cap", axes: []string{"tactics", "strategy", "openings", "endgames", "calculation"}, wantErr: true},
		{name: "four axes exceeds the FR-047 cap", axes: []string{"tactics", "strategy", "openings", "endgames"}, wantErr: true},
		{name: "unknown axis name is rejected", axes: []string{"tactics", "not-a-real-axis"}, wantErr: true},
		{name: "duplicate axis names still within the cap", axes: []string{"tactics", "tactics"}, wantErr: false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := validateFocusAxes(c.axes)
			if c.wantErr && err == nil {
				t.Errorf("validateFocusAxes(%v) = nil, want error", c.axes)
			}
			if !c.wantErr && err != nil {
				t.Errorf("validateFocusAxes(%v) = %v, want nil", c.axes, err)
			}
		})
	}
}
