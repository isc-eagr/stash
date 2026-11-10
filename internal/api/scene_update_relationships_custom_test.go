package api

import (
	"context"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
)

func TestSceneRelationshipEqualityCustom(t *testing.T) {
	if !equalSceneStringsCustom([]string{"b", "a"}, []string{"a", "b"}) {
		t.Fatal("URL sets with different ordering should be equal")
	}

	index := 2
	if !equalSceneGroupsCustom(
		[]models.GroupsScenes{{GroupID: 1, SceneIndex: &index}},
		[]models.GroupsScenes{{GroupID: 1, SceneIndex: &index}},
	) {
		t.Fatal("identical group relationships should be equal")
	}

	now := time.Now().UTC()
	if !equalSceneStashIDsCustom(
		[]models.StashID{{Endpoint: "box", StashID: "abc", UpdatedAt: now}},
		[]models.StashID{{Endpoint: "box", StashID: "abc", UpdatedAt: now}},
	) {
		t.Fatal("identical stash IDs should be equal")
	}
}

func TestSuppressUnchangedScenePerformerRelationshipCustom(t *testing.T) {
	db := mocks.NewDatabase()
	db.Scene.On("GetPerformerIDs", context.Background(), 7).Return([]int{3, 2}, nil).Once()
	partial := models.NewScenePartial()
	partial.PerformerIDs = &models.UpdateIDs{
		IDs:  []int{2, 3},
		Mode: models.RelationshipUpdateModeSet,
	}

	previous, err := suppressUnchangedSceneRelationshipsCustom(context.Background(), db.Scene, 7, &partial)
	if err != nil {
		t.Fatal(err)
	}
	if partial.PerformerIDs != nil || previous != nil {
		t.Fatal("unchanged performer relationship was not suppressed")
	}
	db.AssertExpectations(t)
}
