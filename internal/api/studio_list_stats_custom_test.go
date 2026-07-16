package api

import (
	"math"
	"testing"
)

func TestApplyStudioListRoleRowsCustom(t *testing.T) {
	statsByID := map[int]*StudioListStats{
		10: {
			StudioID:         "10",
			StudioRoleCounts: &StudioRoleCounts{},
		},
	}

	applyStudioListRoleRowsCustom([][]interface{}{
		{int64(10), int64(8), int64(5), int64(3), int64(2)},
		{int64(99), int64(1), int64(1), int64(1), int64(1)},
		{int64(10)},
	}, statsByID)

	got := statsByID[10].StudioRoleCounts
	if got.SexSceneCount != 8 || got.OralSceneCount != 5 || got.SoloSceneCount != 3 || got.FacialSceneCount != 2 {
		t.Fatalf("unexpected role counts: %+v", got)
	}
}

func TestCalculateStudioListActivityStatsCustom(t *testing.T) {
	sceneDurations := map[int]float64{1: 100, 2: 50}
	markers := []studioListActivityMarkerCustom{
		{sceneID: 1, start: 0, end: 20, primaryTagID: 11},
		{sceneID: 1, start: 20, end: 30, primaryTagID: 22},
		{sceneID: 1, start: 40, end: 50, primaryTagID: 99},
		{sceneID: 2, start: -5, end: 10, primaryTagID: 33},
	}
	negativeMarkers := []studioListNegativeMarkerCustom{
		{sceneID: 1, start: 60, end: 70},
		{sceneID: 2, start: 55, end: 70},
	}

	got := calculateStudioListActivityStatsCustom(
		sceneDurations,
		markers,
		negativeMarkers,
		11,
		22,
		33,
	)

	assertStudioListFloatCustom(t, "total seconds", got.TotalSeconds, 150)
	assertStudioListFloatCustom(t, "sex seconds", got.SexSeconds, 20)
	assertStudioListFloatCustom(t, "oral seconds", got.OralSeconds, 10)
	assertStudioListFloatCustom(t, "solo seconds", got.SoloSeconds, 10)
	assertStudioListFloatCustom(t, "unusable seconds", got.UnusableSeconds, 10)
	assertStudioListFloatCustom(t, "outstanding seconds", got.OutstandingSeconds, 10)
	if got.SexSceneCount != 1 || got.OralSceneCount != 1 || got.SoloSceneCount != 1 {
		t.Fatalf("unexpected activity scene counts: sex=%d oral=%d solo=%d", got.SexSceneCount, got.OralSceneCount, got.SoloSceneCount)
	}
}

func TestStudioListClampedIntervalCustom(t *testing.T) {
	got, ok := studioListClampedIntervalCustom(7, -5, 120, 100)
	if !ok || got.sceneID != 7 || got.start != 0 || got.end != 100 {
		t.Fatalf("unexpected clamped interval: %+v, ok=%v", got, ok)
	}

	if _, ok := studioListClampedIntervalCustom(7, 100, 100, 100); ok {
		t.Fatal("expected an empty interval to be rejected")
	}
}

func assertStudioListFloatCustom(t *testing.T, name string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 0.0001 {
		t.Fatalf("%s: got %f, want %f", name, got, want)
	}
}
