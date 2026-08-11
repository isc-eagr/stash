package api

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestCalculateCoPerformerRoleStatsCustom(t *testing.T) {
	end10 := 10.0
	end15 := 15.0
	markers := []*models.SceneMarker{
		{ID: 1, SceneID: 100, Seconds: 0, EndSeconds: &end10},
		{ID: 2, SceneID: 100, Seconds: 5, EndSeconds: &end15},
		{ID: 3, SceneID: 200, Seconds: 20},
		{ID: 4, SceneID: 300, Seconds: 0, EndSeconds: &end10},
	}
	performersByMarker := map[int][]*models.MarkerPerformer{
		1: {{PerformerID: 2, Role: "bottom"}},
		2: {{PerformerID: 2, Role: "bottom"}},
		3: {
			{PerformerID: 2, Role: "bottom"},
			{PerformerID: 4, Role: "bottom"},
		},
		4: {
			{PerformerID: 1, Role: "bottom"},
			{PerformerID: 3, Role: "top"},
		},
	}

	stats := calculateCoPerformerRoleStatsCustom(
		1,
		"bottom",
		markers,
		performersByMarker,
	)

	assert.Equal(t, 2, stats[2].sceneCount)
	assert.Equal(t, 15.0, stats[2].durationSeconds)
	assert.Equal(t, 1, stats[4].sceneCount)
	assert.Zero(t, stats[4].durationSeconds)
	_, hasWrongRolePartner := stats[3]
	assert.False(t, hasWrongRolePartner)
}
