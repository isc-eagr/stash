package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestActivityStatsDurationCustom(t *testing.T) {
	tests := []struct {
		name      string
		intervals []activityIntervalCustom
		want      float64
	}{
		{
			name: "empty",
			want: 0,
		},
		{
			name: "merges overlapping intervals per scene",
			intervals: []activityIntervalCustom{
				{sceneID: 1, start: 10, end: 20},
				{sceneID: 1, start: 15, end: 30},
				{sceneID: 1, start: 40, end: 45},
			},
			want: 25,
		},
		{
			name: "keeps scenes separate",
			intervals: []activityIntervalCustom{
				{sceneID: 2, start: 0, end: 10},
				{sceneID: 1, start: 0, end: 10},
				{sceneID: 1, start: 5, end: 15},
				{sceneID: 2, start: 5, end: 15},
			},
			want: 30,
		},
		{
			name: "handles unsorted intervals",
			intervals: []activityIntervalCustom{
				{sceneID: 1, start: 20, end: 25},
				{sceneID: 1, start: 0, end: 10},
				{sceneID: 1, start: 8, end: 15},
			},
			want: 20,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, activityStatsDurationCustom(tt.intervals))
		})
	}
}

func TestActivityStatsPercentCustom(t *testing.T) {
	assert.Equal(t, 0.0, activityStatsPercentCustom(10, 0))
	assert.Equal(t, 0.0, activityStatsPercentCustom(10, -1))
	assert.Equal(t, 25.0, activityStatsPercentCustom(15, 60))
}

func TestActivityStatsOtherSecondsCustom(t *testing.T) {
	activityIntervals := []activityIntervalCustom{
		{sceneID: 1, start: 0, end: 30},
		{sceneID: 1, start: 20, end: 45},
	}
	unusableIntervals := []activityIntervalCustom{
		{sceneID: 1, start: 40, end: 55},
		{sceneID: 1, start: 50, end: 60},
	}

	assert.Equal(t, 40.0, activityStatsOtherSecondsCustom(100, activityIntervals, unusableIntervals))
	assert.Equal(t, 0.0, activityStatsOtherSecondsCustom(50, activityIntervals, unusableIntervals))
}

func TestActivityStatsOtherSecondsCustomMergesAnyCoveredMarkerType(t *testing.T) {
	activityIntervals := []activityIntervalCustom{
		{sceneID: 1, start: 0, end: 20},
		{sceneID: 1, start: 10, end: 30},
		{sceneID: 1, start: 50, end: 70},
	}
	unusableIntervals := []activityIntervalCustom{
		{sceneID: 1, start: 25, end: 60},
		{sceneID: 1, start: 80, end: 90},
	}

	assert.Equal(t, 20.0, activityStatsOtherSecondsCustom(100, activityIntervals, unusableIntervals))
}

func TestActivityStatsCategoryCustom(t *testing.T) {
	category, ok := activityStatsCategoryCustom(10, 10, 20, 30)
	assert.True(t, ok)
	assert.Equal(t, activitySexCustom, category)

	category, ok = activityStatsCategoryCustom(20, 10, 20, 30)
	assert.True(t, ok)
	assert.Equal(t, activityOralCustom, category)

	category, ok = activityStatsCategoryCustom(30, 10, 20, 30)
	assert.True(t, ok)
	assert.Equal(t, activitySoloCustom, category)

	category, ok = activityStatsCategoryCustom(10, 0, 20, 30)
	assert.False(t, ok)
	assert.Empty(t, category)
}

func TestActivityStatsValueConversionsCustom(t *testing.T) {
	assert.Equal(t, 12, activityStatsIntCustom(12))
	assert.Equal(t, 13, activityStatsIntCustom(int64(13)))
	assert.Equal(t, 14, activityStatsIntCustom(float64(14.9)))
	assert.Equal(t, 15, activityStatsIntCustom([]byte("15")))
	assert.Equal(t, 16, activityStatsIntCustom("16"))

	assert.Equal(t, 12.5, activityStatsFloatCustom(12.5))
	assert.Equal(t, 13.5, activityStatsFloatCustom(float32(13.5)))
	assert.Equal(t, 14.0, activityStatsFloatCustom(14))
	assert.Equal(t, 15.25, activityStatsFloatCustom([]byte("15.25")))
	assert.Equal(t, 16.75, activityStatsFloatCustom("16.75"))

	assert.False(t, activityStatsBoolCustom(0))
	assert.True(t, activityStatsBoolCustom(1))
	assert.True(t, activityStatsBoolCustom([]byte("1")))
}
