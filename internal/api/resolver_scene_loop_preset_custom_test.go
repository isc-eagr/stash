package api

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
)

func TestNormalizeSegmentsKeepsTrimmedTitles(t *testing.T) {
	segments, err := normalizeSegments([]models.SceneLoopSegment{
		{Start: 10, End: 4, Title: "  Oral  "},
		{Start: 20, End: 20},
	})
	if err != nil {
		t.Fatal(err)
	}

	if got := segments[0]; got.Start != 4 || got.End != 10 || got.Title != "Oral" {
		t.Errorf("first segment = %+v, want swapped bounds and trimmed title", got)
	}
	if got := segments[1]; got.Title != "" || got.End <= got.Start {
		t.Errorf("second segment = %+v, want untitled non-empty range", got)
	}
}

func TestLoopSegmentTitle(t *testing.T) {
	blank := "   "
	named := " Facial "
	for _, test := range []struct {
		input *string
		want  string
	}{
		{nil, ""},
		{&blank, ""},
		{&named, "Facial"},
	} {
		if got := loopSegmentTitle(test.input); got != test.want {
			t.Errorf("loopSegmentTitle(%v) = %q, want %q", test.input, got, test.want)
		}
	}
}

func TestToAPIMultiSegmentLoopPresetTitles(t *testing.T) {
	preset := toAPIMultiSegmentLoopPreset(&models.SceneLoopPreset{
		Segments: []models.SceneLoopSegment{
			{Start: 1, End: 2, Title: "Sex"},
			{Start: 3, End: 4},
		},
	})

	if preset.Segments[0].Title == nil || *preset.Segments[0].Title != "Sex" {
		t.Errorf("titled segment = %+v, want title Sex", preset.Segments[0])
	}
	if preset.Segments[1].Title != nil {
		t.Errorf("untitled segment title = %q, want nil", *preset.Segments[1].Title)
	}
}
