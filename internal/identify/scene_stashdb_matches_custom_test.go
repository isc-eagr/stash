package identify

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestModifySceneStashDBMatchesCustom(t *testing.T) {
	const sceneID = 7
	matches := 4
	boolFalse := false

	tests := []struct {
		name     string
		scraped  *int
		strategy FieldStrategy
		wantSet  bool
	}{
		{"default strategy refreshes without other changes", &matches, "", true},
		{"merge refreshes an existing count", &matches, FieldStrategyMerge, true},
		{"ignore keeps the stored count", &matches, FieldStrategyIgnore, false},
		{"non-StashDB results leave it alone", nil, "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := mocks.NewDatabase()
			options := &MetadataOptions{SetOrganized: &boolFalse, SetCoverImage: &boolFalse}
			if tt.strategy != "" {
				options.FieldOptions = []*FieldOptions{{Field: "stashdb_matches", Strategy: tt.strategy}}
			}
			if tt.wantSet {
				db.Scene.On("SetStashDBMatchesCustom", mock.Anything, sceneID, &matches).Return(nil).Once()
			}

			identifier := &SceneIdentifier{
				TxnManager:         db,
				SceneReaderUpdater: db.Scene,
				StudioReaderWriter: db.Studio,
				PerformerCreator:   db.Performer,
				TagFinderCreator:   db.Tag,
				DefaultOptions:     options,
			}
			scene := &models.Scene{
				ID:           sceneID,
				URLs:         models.NewRelatedStrings([]string{}),
				PerformerIDs: models.NewRelatedIDs([]int{}),
				TagIDs:       models.NewRelatedIDs([]int{}),
				StashIDs:     models.NewRelatedStashIDs([]models.StashID{}),
			}
			result := &scrapeResult{result: &models.ScrapedScene{StashDBMatches: tt.scraped}}

			require.NoError(t, identifier.modifyScene(testCtx, scene, result))
			db.AssertExpectations(t)
			if !tt.wantSet {
				db.Scene.AssertNotCalled(t, "SetStashDBMatchesCustom", mock.Anything, mock.Anything, mock.Anything)
			}
		})
	}
}
