package sqlite

// CUSTOM: Scene store methods for release file management.

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

// RemoveFileID removes a file from a scene's file associations
func (qb *SceneStore) RemoveFileID(ctx context.Context, sceneID int, fileID models.FileID) error {
	q := dialect.Delete(scenesFilesJoinTable).Where(
		scenesFilesJoinTable.Col(sceneIDColumn).Eq(sceneID),
		scenesFilesJoinTable.Col(fileIDColumn).Eq(fileID),
	)

	_, err := exec(ctx, q)
	return err
}
