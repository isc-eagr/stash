package sqlite

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
)

func TestSceneLoopPresetRowKeepsSegmentTitles(t *testing.T) {
	var row sceneLoopPresetRow
	row.fromModel(models.SceneLoopPreset{
		SceneID: 1,
		Name:    "best",
		Segments: []models.SceneLoopSegment{
			{Start: 1, End: 2, Title: "Oral"},
			{Start: 3, End: 4},
		},
	})

	got := row.resolve().Segments
	if len(got) != 2 || got[0].Title != "Oral" || got[1].Title != "" {
		t.Errorf("segments = %+v, want titles preserved", got)
	}
}

func TestSceneLoopPresetRowReadsLegacySegments(t *testing.T) {
	row := sceneLoopPresetRow{Segments: `[{"start":1,"end":2}]`}

	got := row.resolve().Segments
	if len(got) != 1 || got[0].Start != 1 || got[0].End != 2 || got[0].Title != "" {
		t.Errorf("segments = %+v, want legacy segment without title", got)
	}
}
