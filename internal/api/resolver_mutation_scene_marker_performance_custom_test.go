package api

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/stashapp/stash/pkg/models"
)

func TestEqualSceneMarkerIDSetsCustom(t *testing.T) {
	assert.True(t, equalSceneMarkerIDSetsCustom([]int{3, 1, 2}, []int{1, 2, 3}))
	assert.True(t, equalSceneMarkerIDSetsCustom(nil, []int{}))
	assert.False(t, equalSceneMarkerIDSetsCustom([]int{1, 1}, []int{1, 2}))
	assert.False(t, equalSceneMarkerIDSetsCustom([]int{1}, []int{1, 2}))
}

func TestMarkerPerformerIDsForRoleCustom(t *testing.T) {
	performers := []*models.MarkerPerformer{
		{PerformerID: 1, Role: "top"},
		{PerformerID: 2, Role: "bottom"},
		{PerformerID: 3, Role: "top"},
	}

	assert.Equal(t, []int{1, 3}, markerPerformerIDsForRoleCustom(performers, "top"))
	assert.Equal(t, []int{2}, markerPerformerIDsForRoleCustom(performers, "bottom"))
}
