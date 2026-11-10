package api

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/stashapp/stash/pkg/models"
)

type releaseFinderFakeCustom struct {
	models.SceneReleaseReaderWriter
	releases map[int]*models.SceneRelease
}

func (f releaseFinderFakeCustom) Find(_ context.Context, id int) (*models.SceneRelease, error) {
	return f.releases[id], nil
}

func TestGuardReleaseMarkerSceneCustom(t *testing.T) {
	r := &mutationResolver{Resolver: &Resolver{repository: models.Repository{
		SceneRelease: releaseFinderFakeCustom{releases: map[int]*models.SceneRelease{9: {ID: 9, SceneID: 5}}},
	}}}
	releaseID := 9
	releaseMarker := &models.SceneMarker{ID: 1, ReleaseID: &releaseID}
	ctx := context.Background()

	// the scene form always sends scene_id; the parent scene is a no-op
	partial := models.SceneMarkerPartial{SceneID: models.NewOptionalInt(5)}
	assert.NoError(t, r.guardReleaseMarkerSceneCustom(ctx, releaseMarker, &partial))
	assert.False(t, partial.SceneID.Set)

	partial = models.SceneMarkerPartial{SceneID: models.NewOptionalInt(6)}
	assert.Error(t, r.guardReleaseMarkerSceneCustom(ctx, releaseMarker, &partial))

	// scene markers keep their scene change
	partial = models.SceneMarkerPartial{SceneID: models.NewOptionalInt(6)}
	assert.NoError(t, r.guardReleaseMarkerSceneCustom(ctx, &models.SceneMarker{ID: 2, SceneID: 5}, &partial))
	assert.True(t, partial.SceneID.Set)
}
