package models

import (
	"context"
	"time"
)

// SceneRelease represents an alternate release of a scene (e.g., from a different studio).
type SceneRelease struct {
	ID        int    `json:"id"`
	SceneID   int    `json:"scene_id"`
	Title     string `json:"title"`
	Code      string `json:"code"`
	Details   string `json:"details"`
	Director  string `json:"director"`
	URL       string `json:"url"`
	Date      *Date  `json:"date"`
	StudioID  *int   `json:"studio_id"`
	PlayOrder int    `json:"play_order"`

	// transient - not persisted
	Files         RelatedVideoFiles
	PrimaryFileID *FileID

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	GalleryIDs RelatedIDs `json:"gallery_ids"`
}

func NewSceneRelease() SceneRelease {
	currentTime := time.Now()
	return SceneRelease{
		CreatedAt: currentTime,
		UpdatedAt: currentTime,
	}
}

// SceneReleasePartial represents part of a SceneRelease object.
// It is used to update the database entry. Only non-nil fields will be updated.
type SceneReleasePartial struct {
	Title     OptionalString
	Code      OptionalString
	Details   OptionalString
	Director  OptionalString
	URL       OptionalString
	Date      OptionalDate
	StudioID  OptionalInt
	PlayOrder OptionalInt
	CreatedAt OptionalTime
	UpdatedAt OptionalTime

	GalleryIDs    *UpdateIDs
	PrimaryFileID *FileID
}

func NewSceneReleasePartial() SceneReleasePartial {
	currentTime := time.Now()
	return SceneReleasePartial{
		UpdatedAt: NewOptionalTime(currentTime),
	}
}

func (r *SceneRelease) LoadFiles(ctx context.Context, l VideoFileLoader) error {
	return r.Files.load(func() ([]*VideoFile, error) {
		return l.GetFiles(ctx, r.ID)
	})
}

func (r *SceneRelease) LoadPrimaryFile(ctx context.Context, l FileGetter) error {
	return r.Files.loadPrimary(func() (*VideoFile, error) {
		if r.PrimaryFileID == nil {
			return nil, nil
		}

		f, err := l.Find(ctx, *r.PrimaryFileID)
		if err != nil {
			return nil, err
		}

		if len(f) > 0 {
			if vf, ok := f[0].(*VideoFile); ok {
				return vf, nil
			}
		}
		return nil, nil
	})
}

func (r *SceneRelease) LoadGalleryIDs(ctx context.Context, l GalleryIDLoader) error {
	return r.GalleryIDs.load(func() ([]int, error) {
		return l.GetGalleryIDs(ctx, r.ID)
	})
}

// SceneReleaseGetter provides methods to get scene releases by ID.
type SceneReleaseGetter interface {
	Find(ctx context.Context, id int) (*SceneRelease, error)
	FindMany(ctx context.Context, ids []int) ([]*SceneRelease, error)
}

// SceneReleaseFinder provides methods to find scene releases.
type SceneReleaseFinder interface {
	SceneReleaseGetter
	FindBySceneID(ctx context.Context, sceneID int) ([]*SceneRelease, error)
}

// SceneReleaseCreator provides methods to create scene releases.
type SceneReleaseCreator interface {
	Create(ctx context.Context, newRelease *SceneRelease, fileIDs []FileID) error
}

// SceneReleaseUpdater provides methods to update scene releases.
type SceneReleaseUpdater interface {
	Update(ctx context.Context, updatedRelease *SceneRelease) error
	UpdatePartial(ctx context.Context, id int, updatedRelease SceneReleasePartial) (*SceneRelease, error)
	UpdateCover(ctx context.Context, releaseID int, cover []byte) error
}

// SceneReleaseDestroyer provides methods to destroy scene releases.
type SceneReleaseDestroyer interface {
	Destroy(ctx context.Context, id int) error
}

// SceneReleaseFileHandler provides methods to manage files for releases.
type SceneReleaseFileHandler interface {
	GetFileIDs(ctx context.Context, releaseID int) ([]FileID, error)
	GetFiles(ctx context.Context, releaseID int) ([]*VideoFile, error)
	AddFileID(ctx context.Context, releaseID int, fileID FileID) error
	AssignFilesToScene(ctx context.Context, releaseID int, sceneID int) error
	FileExistsInSceneReleases(ctx context.Context, sceneID int, fileID FileID) (bool, error)
}

// SceneReleaseGalleryHandler provides methods to manage galleries for releases.
type SceneReleaseGalleryHandler interface {
	GetGalleryIDs(ctx context.Context, releaseID int) ([]int, error)
}

// SceneReleaseReader provides all methods to read scene releases.
type SceneReleaseReader interface {
	SceneReleaseFinder
	SceneReleaseFileHandler
	SceneReleaseGalleryHandler
	GetCover(ctx context.Context, releaseID int) ([]byte, error)
	HasCover(ctx context.Context, releaseID int) (bool, error)
}

// SceneReleaseWriter provides all methods to modify scene releases.
type SceneReleaseWriter interface {
	SceneReleaseCreator
	SceneReleaseUpdater
	SceneReleaseDestroyer
	SceneReleaseFileHandler
}

// SceneReleaseReaderWriter provides all scene release methods.
type SceneReleaseReaderWriter interface {
	SceneReleaseReader
	SceneReleaseWriter
}
