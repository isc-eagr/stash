package api

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
)

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

func TestVatoStatsAgeRange(t *testing.T) {
	tests := []struct {
		age  int
		want string
	}{
		{age: 18, want: "18"},
		{age: 20, want: "20"},
		{age: 21, want: "21"},
		{age: 25, want: "25"},
		{age: 26, want: "26"},
		{age: 40, want: "40"},
	}

	for _, tt := range tests {
		got := vatoStatsAgeRange(tt.age)
		if got != tt.want {
			t.Fatalf("vatoStatsAgeRange(%d) = %q, want %q", tt.age, got, tt.want)
		}
	}
}

func TestVatoStatsStringPtrValue(t *testing.T) {
	tests := []struct {
		name  string
		value interface{}
	}{
		{name: "nil", value: nil},
		{name: "nil string", value: "<nil>"},
		{name: "null string", value: "null"},
		{name: "blank", value: "  "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := vatoStatsStringPtrValue(tt.value); got != nil {
				t.Fatalf("vatoStatsStringPtrValue(%#v) = %#v, want nil", tt.value, got)
			}
		})
	}

	got := vatoStatsStringPtrValue(" Black ")
	if got == nil || *got != "Black" {
		t.Fatalf("vatoStatsStringPtrValue trims real values to %#v, want Black", got)
	}
}

func TestVatoStatsEthnicityLabel(t *testing.T) {
	for _, value := range []interface{}{nil, "", "  ", "<nil>", "null"} {
		if got := vatoStatsEthnicityLabel(value); got != "Unknown" {
			t.Fatalf("vatoStatsEthnicityLabel(%#v) = %q, want Unknown", value, got)
		}
	}
	if got := vatoStatsEthnicityLabel(" Black "); got != "Black" {
		t.Fatalf("vatoStatsEthnicityLabel trims real values to %q, want Black", got)
	}
}

func TestSceneOStatsEthnicityFilter(t *testing.T) {
	got, err := sceneOStatsEthnicityFilter(" Black ")
	if err != nil {
		t.Fatalf("sceneOStatsEthnicityFilter returned error: %v", err)
	}
	if got != "Black" {
		t.Fatalf("sceneOStatsEthnicityFilter = %q, want Black", got)
	}

	if _, err := sceneOStatsEthnicityFilter(" "); err == nil {
		t.Fatal("sceneOStatsEthnicityFilter blank value returned nil error")
	}
}

func TestSceneOEventAssociatedTagsFromCandidates(t *testing.T) {
	tag := func(id int, name string) *models.Tag {
		return &models.Tag{ID: id, Name: name}
	}

	got := sceneOEventAssociatedTagsFromCandidates([]sceneOEventAssociatedTagCandidate{
		{OID: "1", MarkerID: 10, Tag: tag(1, "Oral")},
		{OID: "1", MarkerID: 11, IsOrgasm: true, Tag: tag(2, "Orgasm")},
		{OID: "1", MarkerID: 11, IsOrgasm: true, Tag: tag(3, "Hands Free")},
		{OID: "1", MarkerID: 11, IsOrgasm: true, Tag: tag(3, "Hands Free")},
		{OID: "2", MarkerID: 20, Tag: tag(4, "Solo")},
		{OID: "2", MarkerID: 20, Tag: tag(5, "Toy")},
	})

	if len(got["1"]) != 2 {
		t.Fatalf("event 1 associated tags = %#v, want two orgasm-marker tags", got["1"])
	}
	if got["1"][0].Name != "Orgasm" || got["1"][1].Name != "Hands Free" {
		t.Fatalf("event 1 associated tags = %#v, want orgasm marker tags in order", got["1"])
	}
	if len(got["2"]) != 2 || got["2"][0].Name != "Solo" || got["2"][1].Name != "Toy" {
		t.Fatalf("event 2 associated tags = %#v, want all covered tags", got["2"])
	}
}

func TestVatoStatsSetAgeCount(t *testing.T) {
	performer := &VatoStatsPerformer{
		AgeCounts: []*VatoStatsAgeCount{},
	}

	vatoStatsSetAgeCount(performer, "21", 2)
	vatoStatsSetAgeCount(performer, "26", 3)
	vatoStatsSetAgeCount(performer, "21", 4)

	if len(performer.AgeCounts) != 2 {
		t.Fatalf("got %d age buckets, want 2", len(performer.AgeCounts))
	}
	if performer.AgeCounts[0].AgeRange != "21" || performer.AgeCounts[0].Count != 6 {
		t.Fatalf("first age count = %#v, want 21 count 6", performer.AgeCounts[0])
	}
	if performer.AgeCounts[1].AgeRange != "26" || performer.AgeCounts[1].Count != 3 {
		t.Fatalf("second age count = %#v, want 26 count 3", performer.AgeCounts[1])
	}
}

func TestVatoStatsIDFilter(t *testing.T) {
	clause, args := vatoStatsIDFilter("p.id", []int{1, 2, 3})
	if clause != " AND p.id IN (?,?,?)" {
		t.Fatalf("clause = %q, want ID filter clause", clause)
	}
	if len(args) != 3 || args[0] != 1 || args[1] != 2 || args[2] != 3 {
		t.Fatalf("args = %#v, want 1, 2, 3", args)
	}

	tooManyIDs := make([]int, 901)
	clause, args = vatoStatsIDFilter("p.id", tooManyIDs)
	if clause != "" || args != nil {
		t.Fatalf("large filter = %q %#v, want empty clause and nil args", clause, args)
	}
}
