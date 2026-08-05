package api

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSceneStatsSceneScopeCustom(t *testing.T) {
	globalSQL, globalArgs, err := sceneStatsSceneScopeCustom(nil, nil)
	require.NoError(t, err)
	require.Contains(t, globalSQL, "SELECT id FROM scenes")
	require.Empty(t, globalArgs)

	studioID := "38"
	depth := -1
	studioSQL, studioArgs, err := sceneStatsSceneScopeCustom(&studioID, &depth)
	require.NoError(t, err)
	require.Contains(t, studioSQL, "WITH RECURSIVE selected_studios")
	require.Contains(t, studioSQL, "studio_id IN (SELECT id FROM selected_studios)")
	require.Equal(t, 3, strings.Count(studioSQL, "?"))
	require.Equal(t, []interface{}{38, -1, -1}, studioArgs)
}

func TestSceneStatsSceneScopeCustomRejectsInvalidStudio(t *testing.T) {
	studioID := "nope"
	_, _, err := sceneStatsSceneScopeCustom(&studioID, nil)
	require.EqualError(t, err, "invalid studio ID: nope")
}
