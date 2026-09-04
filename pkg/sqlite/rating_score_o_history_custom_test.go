package sqlite

import "testing"

func TestORatingBonusDeltaCustom(t *testing.T) {
	tests := []struct {
		entityType string
		before     int
		after      int
	}{
		{entityType: "scene", before: 2, after: 3},
		{entityType: "scene", before: 6, after: 5},
		{entityType: "performer", before: 2, after: 3},
		{entityType: "performer", before: 4, after: 5},
	}

	for _, tt := range tests {
		got := oRatingBonusDeltaCustom(tt.entityType, tt.before, tt.after)
		want := calculateOrgasmRatingBonus(tt.entityType, tt.after) - calculateOrgasmRatingBonus(tt.entityType, tt.before)
		if got != want {
			t.Fatalf("%s %d->%d: got %d, want %d", tt.entityType, tt.before, tt.after, got, want)
		}
	}
}
