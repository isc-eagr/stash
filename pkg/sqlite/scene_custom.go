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

// EnsurePrimaryFileCustom repairs primary selection after a file is moved.
func (qb *SceneStore) EnsurePrimaryFileCustom(ctx context.Context, sceneID int) error {
	return ensurePrimaryFileCustom(ctx, scenesFilesTableMgr, sceneID)
}

// DetachCoverForConversionCustom keeps the blob while its reference moves to
// a release in the same transaction.
func (qb *SceneStore) DetachCoverForConversionCustom(ctx context.Context, sceneID int) error {
	_, err := dbWrapper.Exec(ctx, `UPDATE scenes SET cover_blob = NULL WHERE id = ?`, sceneID)
	return err
}
