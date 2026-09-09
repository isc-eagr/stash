package scene

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

// Preserve import field semantics while applying both forms of tag membership
// together. PostImport can safely replace the same tags again without events.
func (i *MarkerImporter) updateMarkerWithTagsCustom(ctx context.Context, id int) error {
	marker := i.marker
	partial := models.SceneMarkerPartial{
		Title:        models.NewOptionalString(marker.Title),
		Seconds:      models.NewOptionalFloat64(marker.Seconds),
		EndSeconds:   models.OptionalFloat64{Set: true, Null: marker.EndSeconds == nil},
		PrimaryTagID: models.NewOptionalInt(marker.PrimaryTagID),
		SceneID:      models.NewOptionalInt(marker.SceneID),
		CreatedAt:    models.NewOptionalTime(marker.CreatedAt),
		UpdatedAt:    models.NewOptionalTime(marker.UpdatedAt),
	}
	if marker.EndSeconds != nil {
		partial.EndSeconds.Value = *marker.EndSeconds
	}
	if len(i.tags) > 0 {
		ids := make([]int, 0, len(i.tags))
		for _, tag := range i.tags {
			ids = append(ids, tag.ID)
		}
		partial.TagIDs = &models.UpdateIDs{IDs: ids, Mode: models.RelationshipUpdateModeSet}
	}
	_, err := i.ReaderWriter.UpdatePartial(ctx, id, partial)
	return err
}
