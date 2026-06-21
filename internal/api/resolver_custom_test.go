package api

import "testing"

func TestSceneOStatsDate(t *testing.T) {
	tests := []struct {
		name      string
		year      int
		month     int
		day       int
		want      string
		wantError bool
	}{
		{
			name:  "formats valid dates",
			year:  2024,
			month: 6,
			day:   7,
			want:  "2024-06-07",
		},
		{
			name:  "accepts leap day",
			year:  2024,
			month: 2,
			day:   29,
			want:  "2024-02-29",
		},
		{
			name:      "rejects invalid month",
			year:      2024,
			month:     13,
			day:       1,
			wantError: true,
		},
		{
			name:      "rejects invalid day for month",
			year:      2025,
			month:     2,
			day:       29,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := sceneOStatsDate(tt.year, tt.month, tt.day)
			if tt.wantError {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestValidateSceneOStatsDate(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		want      string
		wantError bool
	}{
		{
			name:  "accepts ISO dates",
			value: "2026-06-21",
			want:  "2026-06-21",
		},
		{
			name:      "rejects slash dates",
			value:     "2026/06/21",
			wantError: true,
		},
		{
			name:      "rejects impossible dates",
			value:     "2026-02-31",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateSceneOStatsDate(tt.value)
			if tt.wantError {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}
