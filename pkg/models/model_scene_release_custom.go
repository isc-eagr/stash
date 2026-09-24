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

type SceneReleaseMetadataCustom struct {
	Rating       *int
	Organized    bool
	ResumeTime   float64
	PlayDuration float64
}

type SceneReleaseExtendedUpdateCustom struct {
	RatingSet       bool
	Rating          *int
	OrganizedSet    bool
	Organized       bool
	URLsSet         bool
	URLs            []string
	PerformerIDsSet bool
	PerformerIDs    []int
	TagIDsSet       bool
	TagIDs          []int
	GroupsSet       bool
	Groups          []GroupsScenes
	StashIDsSet     bool
	StashIDs        []StashID
	CustomFields    *CustomFieldsInput
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
	MoveFileToReleaseCustom(ctx context.Context, releaseID int, fileID FileID) error
	RemoveFileID(ctx context.Context, releaseID int, fileID FileID) error
	AssignFilesToScene(ctx context.Context, releaseID int, sceneID int) error
	FileExistsInSceneReleases(ctx context.Context, sceneID int, fileID FileID) (bool, error)
	CountOtherFileOwnersCustom(ctx context.Context, releaseID int, fileID FileID) (int, error)
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
	GetMetadataCustom(ctx context.Context, releaseID int) (SceneReleaseMetadataCustom, error)
	GetURLsCustom(ctx context.Context, releaseID int) ([]string, error)
	GetPerformerIDsCustom(ctx context.Context, releaseID int) ([]int, error)
	GetTagIDsCustom(ctx context.Context, releaseID int) ([]int, error)
	GetGroupsCustom(ctx context.Context, releaseID int) ([]GroupsScenes, error)
	GetStashIDsCustom(ctx context.Context, releaseID int) ([]StashID, error)
	GetCustomFieldsCustom(ctx context.Context, releaseID int) (map[string]interface{}, error)
	GetViewHistoryCustom(ctx context.Context, releaseID int) ([]time.Time, error)
	GetOHistoryCustom(ctx context.Context, releaseID int) ([]time.Time, error)
	GetOVideoTimestampsCustom(ctx context.Context, releaseID int) ([]*float64, error)
	GetMarkersCustom(ctx context.Context, releaseID int) ([]*SceneMarker, error)
	GetNegativeMarkersCustom(ctx context.Context, releaseID int) ([]*SceneNegativeMarker, error)
	GetLoopPresetsCustom(ctx context.Context, releaseID int) ([]*SceneLoopPreset, error)
}

// SceneReleaseWriter provides all methods to modify scene releases.
type SceneReleaseWriter interface {
	SceneReleaseCreator
	SceneReleaseUpdater
	SceneReleaseDestroyer
	SceneReleaseFileHandler
	TransferSceneMetadataToReleaseCustom(ctx context.Context, sceneID, releaseID int) error
	CheckConversionFileConflictsCustom(ctx context.Context, sourceSceneID, targetSceneID int) error
	TransferReleaseMetadataToSceneCustom(ctx context.Context, releaseID, sceneID int) error
	DetachCoverForConversionCustom(ctx context.Context, releaseID int) error
	UpdateExtendedCustom(ctx context.Context, releaseID int, update SceneReleaseExtendedUpdateCustom) error
	SaveActivityCustom(ctx context.Context, releaseID int, resumeTime, playDuration *float64) error
	AddPlayCustom(ctx context.Context, releaseID int) (int, error)
	AddOAtTimestampCustom(ctx context.Context, releaseID int, videoTimestamp float64) (int, error)
	EditHistoryCustom(ctx context.Context, releaseID int, kind, action string, at *time.Time) error
	ResetActivityCustom(ctx context.Context, releaseID int, resetResume, resetDuration bool) error
	MoveMarkerToReleaseCustom(ctx context.Context, markerID, releaseID int) error
	SaveNegativeMarkerCustom(ctx context.Context, releaseID int, marker *SceneNegativeMarker) error
	DeleteNegativeMarkerCustom(ctx context.Context, releaseID, markerID int) error
	SaveLoopPresetCustom(ctx context.Context, releaseID int, preset *SceneLoopPreset) error
	DeleteLoopPresetCustom(ctx context.Context, releaseID int, name string) error
	FindConversionRequestCustom(ctx context.Context, requestID, direction string, sourceID, targetID int) (int, bool, error)
	SaveConversionRequestCustom(ctx context.Context, requestID, direction string, sourceID, targetID, resultID int) error
}

// SceneReleaseReaderWriter provides all scene release methods.
type SceneReleaseReaderWriter interface {
	SceneReleaseReader
	SceneReleaseWriter
}
