package api

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func sceneStatsActivityMatrixEndCustom(value float64) *float64 {
	return &value
}

func TestAggregateSceneStatsActivityMatrixCustomKeepsFeetAndGoatCompanions(t *testing.T) {
	tags := map[int]sceneStatsActivityMatrixTagCustom{
		30: {id: 30, name: "Feet"},
		40: {id: 40, name: "GOAT"},
		70: {id: 70, name: "Body"},
	}
	families := sceneStatsActivityMatrixFamiliesCustom{
		activity:     map[int]struct{}{},
		event:        map[int]struct{}{},
		feet:         map[int]struct{}{30: {}},
		qualifier:    map[int]struct{}{40: {}, 60: {}},
		secondCamera: map[int]struct{}{60: {}},
	}
	markers := []*sceneStatsActivityMatrixMarkerCustom{
		{sceneID: 1, markerID: 1, seconds: 0, endSeconds: sceneStatsActivityMatrixEndCustom(30), sceneDuration: 100, tagIDs: map[int]struct{}{70: {}}},
		{sceneID: 1, markerID: 2, seconds: 20, endSeconds: sceneStatsActivityMatrixEndCustom(50), sceneDuration: 100, tagIDs: map[int]struct{}{70: {}}},
		// Only the GOAT tag is excluded. Body and Feet on the same marker remain evidence.
		{sceneID: 2, markerID: 3, seconds: 0, endSeconds: sceneStatsActivityMatrixEndCustom(20), sceneDuration: 100, tagIDs: map[int]struct{}{30: {}, 40: {}, 70: {}}},
		// A second-camera marker remains excluded as a whole.
		{sceneID: 2, markerID: 4, seconds: 20, endSeconds: sceneStatsActivityMatrixEndCustom(90), sceneDuration: 100, tagIDs: map[int]struct{}{60: {}, 70: {}}},
	}

	values := aggregateSceneStatsActivityMatrixCustom(markers, tags, families, 200, nil, false)
	require.Len(t, values, 2)
	assert.Equal(t, "Body", values[0].tagName)
	assert.InDelta(t, 70, values[0].duration, 0.001)
	assert.Equal(t, 3, values[0].markerCount)
	assert.InDelta(t, 35, values[0].percent, 0.001)
	assert.Equal(t, "Feet", values[1].tagName)
	assert.InDelta(t, 20, values[1].duration, 0.001)
	assert.Equal(t, 1, values[1].markerCount)
	assert.NotContains(t, []string{values[0].tagName, values[1].tagName}, "GOAT")
}

func TestAggregateSceneStatsActivityMatrixCustomRollsDescendantsIntoParents(t *testing.T) {
	tags := map[int]sceneStatsActivityMatrixTagCustom{
		70: {id: 70, name: "Pito"},
		71: {id: 71, name: "Closeup"},
	}
	markers := []*sceneStatsActivityMatrixMarkerCustom{
		{sceneID: 1, markerID: 1, seconds: 0, endSeconds: sceneStatsActivityMatrixEndCustom(20), sceneDuration: 100, tagIDs: map[int]struct{}{70: {}}},
		{sceneID: 1, markerID: 2, seconds: 30, endSeconds: sceneStatsActivityMatrixEndCustom(60), sceneDuration: 100, tagIDs: map[int]struct{}{71: {}}},
		// A marker carrying both parent and child still counts once in the parent row.
		{sceneID: 1, markerID: 3, seconds: 70, endSeconds: sceneStatsActivityMatrixEndCustom(80), sceneDuration: 100, tagIDs: map[int]struct{}{70: {}, 71: {}}},
	}
	families := sceneStatsActivityMatrixFamiliesCustom{}
	parents := map[int][]int{71: {70}}

	direct := aggregateSceneStatsActivityMatrixCustom(markers, tags, families, 100, parents, false)
	rolledUp := aggregateSceneStatsActivityMatrixCustom(markers, tags, families, 100, parents, true)

	require.Len(t, direct, 2)
	assert.Equal(t, 2, direct[0].markerCount)
	require.Len(t, rolledUp, 2)
	assert.Equal(t, "Pito", rolledUp[0].tagName)
	assert.Equal(t, 3, rolledUp[0].markerCount)
	assert.InDelta(t, 60, rolledUp[0].duration, 0.001)
}

func TestSceneStatsActivityMatrixDescendantsCustom(t *testing.T) {
	descendants := sceneStatsActivityMatrixDescendantsCustom(1, map[int][]int{
		1: {2},
		2: {3},
		3: {1},
	})

	assert.Equal(t, map[int]struct{}{1: {}, 2: {}, 3: {}}, descendants)
}

func TestSceneStatsActivityMatrixPerformerScopeCustom(t *testing.T) {
	performerID := "47"
	scope, args, markerPerformerID, err := sceneStatsActivityMatrixScopeCustom(nil, nil, &performerID)
	require.NoError(t, err)
	require.NotNil(t, markerPerformerID)
	assert.Equal(t, 47, *markerPerformerID)
	assert.Contains(t, scope, "FROM performers_scenes WHERE performer_id = ?")
	assert.Equal(t, []interface{}{47}, args)

	markerQuery := sceneStatsActivityMatrixMarkerQueryCustom(scope, markerPerformerID)
	assert.Equal(t, 2, strings.Count(markerQuery, "smp.performer_id = ?"))
}

func TestSceneStatsActivityMatrixPerformerScopeCustomRejectsMixedScope(t *testing.T) {
	studioID := "6"
	performerID := "47"
	_, _, _, err := sceneStatsActivityMatrixScopeCustom(&studioID, nil, &performerID)
	assert.EqualError(t, err, "performer_id cannot be combined with studio_id")
}
