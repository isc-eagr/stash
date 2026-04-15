package models

import (
	"context"

	"github.com/stashapp/stash/pkg/txn"
)

type TxnManager interface {
	txn.Manager
	txn.DatabaseProvider
}

type Repository struct {
	TxnManager TxnManager

	Blob                BlobReader
	Blobs               BlobStoreWriter // CUSTOM
	File                FileReaderWriter
	Folder              FolderReaderWriter
	Gallery             GalleryReaderWriter
	GalleryChapter      GalleryChapterReaderWriter
	Image               ImageReaderWriter
	Group               GroupReaderWriter
	Performer           PerformerReaderWriter
	PerformerImage      PerformerImageReaderWriter // CUSTOM
	Scene               SceneReaderWriter
	SceneLoopPreset     SceneLoopPresetReaderWriter     // CUSTOM
	SceneNegativeMarker SceneNegativeMarkerReaderWriter // CUSTOM
	SceneMarker         SceneMarkerReaderWriter
	SceneRelease        SceneReleaseReaderWriter // CUSTOM
	Studio              StudioReaderWriter
	Tag                 TagReaderWriter
	SavedFilter         SavedFilterReaderWriter
}

func (r *Repository) WithTxn(ctx context.Context, fn txn.TxnFunc) error {
	return txn.WithTxn(ctx, r.TxnManager, fn)
}

func (r *Repository) WithReadTxn(ctx context.Context, fn txn.TxnFunc) error {
	return txn.WithReadTxn(ctx, r.TxnManager, fn)
}

func (r *Repository) WithDB(ctx context.Context, fn txn.TxnFunc) error {
	return txn.WithDatabase(ctx, r.TxnManager, fn)
}
