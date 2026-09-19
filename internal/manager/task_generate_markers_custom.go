package manager

// CUSTOM: Simple marker preview exclusion helpers.

import (
	"context"
	"os"
	"strconv"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/fsutil"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
)

// prepareSimpleMarkerPreviewExclusions loads the configured primary tag IDs and
// secondary marker tags used to skip generating video/webp previews for plain
// sex/oral/solo/custom skip-list markers. Screenshot generation is unaffected.
func (t *GenerateMarkersTask) prepareSimpleMarkerPreviewExclusions(ctx context.Context, markers []*models.SceneMarker) {
	t.simpleMarkerPreviewExclusionsReady = true
	t.simpleMarkerPreviewTagIDs = nil
	t.simpleMarkerSecondaryTagIDs = nil

	if !t.VideoPreview && !t.ImagePreview && !t.DeleteSimpleMarkerPreviews {
		return
	}

	tagIDs := getSimpleMarkerPreviewTagIDs()
	if len(tagIDs) == 0 {
		return
	}

	markerIDs := make([]int, 0, len(markers))
	for _, marker := range markers {
		if marker != nil {
			markerIDs = append(markerIDs, marker.ID)
		}
	}

	secondaryTagIDs, err := t.repository.SceneMarker.GetTagIDsForMarkers(ctx, markerIDs)
	if err != nil {
		logger.Warnf("[generator] failed to inspect marker tags for simple marker preview exclusion: %v", err)
		return
	}

	t.simpleMarkerPreviewTagIDs = tagIDs
	t.simpleMarkerSecondaryTagIDs = secondaryTagIDs
}

func getSimpleMarkerPreviewTagIDs() map[int]struct{} {
	ret := make(map[int]struct{})
	uiConfig := config.GetInstance().GetUIConfiguration()
	roleTagIDs, _ := uiConfig["roleTagIds"].(map[string]interface{})
	for _, key := range []string{"sexTagId", "oralTagId", "soloTagId"} {
		if id := simpleMarkerTagIDFromConfigValue(roleTagIDs[key]); id > 0 {
			ret[id] = struct{}{}
		}
	}
	for _, id := range simpleMarkerTagIDsFromConfigValue(uiConfig["simpleMarkerPreviewExcludedTagIds"]) {
		ret[id] = struct{}{}
	}

	return ret
}

func simpleMarkerTagIDsFromConfigValue(value interface{}) []int {
	switch v := value.(type) {
	case []interface{}:
		ret := make([]int, 0, len(v))
		for _, item := range v {
			if id := simpleMarkerTagIDFromConfigValue(item); id > 0 {
				ret = append(ret, id)
			}
		}
		return ret
	case []string:
		ret := make([]int, 0, len(v))
		for _, item := range v {
			if id := simpleMarkerTagIDFromConfigValue(item); id > 0 {
				ret = append(ret, id)
			}
		}
		return ret
	case []int:
		ret := make([]int, 0, len(v))
		for _, item := range v {
			if item > 0 {
				ret = append(ret, item)
			}
		}
		return ret
	default:
		return nil
	}
}

func simpleMarkerTagIDFromConfigValue(value interface{}) int {
	switch v := value.(type) {
	case string:
		id, _ := strconv.Atoi(v)
		return id
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func (t *GenerateMarkersTask) shouldSkipSimpleMarkerPreviews(marker *models.SceneMarker) bool {
	if !t.simpleMarkerPreviewExclusionsReady || marker == nil {
		return false
	}
	if len(t.simpleMarkerPreviewTagIDs) == 0 {
		return false
	}
	if _, ok := t.simpleMarkerPreviewTagIDs[marker.PrimaryTagID]; !ok {
		return false
	}

	return len(t.simpleMarkerSecondaryTagIDs[marker.ID]) == 0
}

func (t *GenerateMarkersTask) simpleMarkerNeedsWork(sceneHash string, seconds int) bool {
	if t.DeleteSimpleMarkerPreviews && t.simpleMarkerPreviewExists(sceneHash, seconds) {
		return true
	}

	return t.Screenshot && (t.Overwrite || !t.screenshotExists(sceneHash, seconds))
}

func (t *GenerateMarkersTask) simpleMarkerPreviewExists(sceneHash string, seconds int) bool {
	return t.videoExists(sceneHash, seconds) || t.imageExists(sceneHash, seconds)
}

func (t *GenerateMarkersTask) deleteSimpleMarkerPreviewFiles(sceneHash string, seconds int) {
	t.deleteSimpleMarkerPreviewFile(instance.Paths.SceneMarkers.GetVideoPreviewPath(sceneHash, seconds), "video")
	t.deleteSimpleMarkerPreviewFile(instance.Paths.SceneMarkers.GetWebpPreviewPath(sceneHash, seconds), "webp")
}

func (t *GenerateMarkersTask) deleteSimpleMarkerPreviewFile(path string, fileType string) {
	if exists, _ := fsutil.FileExists(path); !exists {
		return
	}

	if err := os.Remove(path); err != nil {
		logger.Warnf("[generator] failed to remove simple marker %s preview at %s: %v", fileType, path, err)
	} else {
		logger.Debugf("[generator] removed simple marker %s preview: %s", fileType, path)
	}
}
