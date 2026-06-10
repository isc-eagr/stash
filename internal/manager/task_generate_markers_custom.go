package manager

// CUSTOM: Quality-aware marker generation helpers.
// This file adds methods to GenerateMarkersTask to detect and correct
// marker files that were generated at the wrong quality level.
// See CUSTOM_FEATURES.md for documentation.

import (
	"image"
	"os"

	// Register WebP decoder for image.DecodeConfig
	_ "golang.org/x/image/webp"

	"github.com/stashapp/stash/pkg/fsutil"
	"github.com/stashapp/stash/pkg/logger"
)

// lowQualityMarkerWidth is the width (pixels) used when generating markers
// in low quality mode. Matches markerPreviewWidth in pkg/scene/generate.
const lowQualityMarkerWidth = 640

// markerQualityMismatch returns true if existing marker files for the given
// scene+timestamp were generated at a different quality than the current setting.
func (t *GenerateMarkersTask) markerQualityMismatch(sceneHash string, seconds int, sourceWidth int, sourceHeight int) bool {
	// Check webp quality first (cheapest - uses image header decode)
	if t.ImagePreview {
		webpPath := instance.Paths.SceneMarkers.GetWebpPreviewPath(sceneHash, seconds)
		if exists, _ := fsutil.FileExists(webpPath); exists {
			if t.webpWidthMismatch(webpPath, sourceWidth, sourceHeight) {
				return true
			}
		}
	}

	// Check mp4 video quality only when ImagePreview is not requested
	// (when both are generated together, the webp check above is sufficient)
	if t.VideoPreview && !t.ImagePreview {
		videoPath := instance.Paths.SceneMarkers.GetVideoPreviewPath(sceneHash, seconds)
		if exists, _ := fsutil.FileExists(videoPath); exists {
			if t.videoWidthMismatch(videoPath, sourceWidth, sourceHeight) {
				return true
			}
		}
	}

	return false
}

// deleteQualityMismatchedFiles removes marker files that were generated at the wrong
// quality level so the generator will recreate them at the correct quality.
func (t *GenerateMarkersTask) deleteQualityMismatchedFiles(sceneHash string, seconds int, sourceWidth int, sourceHeight int) {
	if t.ImagePreview {
		webpPath := instance.Paths.SceneMarkers.GetWebpPreviewPath(sceneHash, seconds)
		if exists, _ := fsutil.FileExists(webpPath); exists {
			if t.webpWidthMismatch(webpPath, sourceWidth, sourceHeight) {
				if err := os.Remove(webpPath); err != nil {
					logger.Warnf("[generator] failed to remove quality-mismatched marker webp at %s: %v", webpPath, err)
				} else {
					logger.Debugf("[generator] removed quality-mismatched marker webp: %s", webpPath)
				}
			}
		}
	}

	if t.VideoPreview {
		videoPath := instance.Paths.SceneMarkers.GetVideoPreviewPath(sceneHash, seconds)
		if exists, _ := fsutil.FileExists(videoPath); exists {
			if t.videoWidthMismatch(videoPath, sourceWidth, sourceHeight) {
				if err := os.Remove(videoPath); err != nil {
					logger.Warnf("[generator] failed to remove quality-mismatched marker video at %s: %v", videoPath, err)
				} else {
					logger.Debugf("[generator] removed quality-mismatched marker video: %s", videoPath)
				}
			}
		}
	}
}

// webpWidthMismatch returns true if the WebP file at path was generated at a
// different width than expected for the current quality setting.
func (t *GenerateMarkersTask) webpWidthMismatch(path string, sourceWidth int, sourceHeight int) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		// Can't decode - don't assume mismatch
		return false
	}

	actualWidth := cfg.Width
	if t.HighQualityMarkers {
		return !sourceQualityWidthMatches(actualWidth, sourceWidth, sourceHeight)
	}
	return !widthMatches(actualWidth, lowQualityMarkerWidth)
}

// videoWidthMismatch returns true if the MP4 marker preview file at path was generated
// at a different width than expected for the current quality setting.
// Uses ffprobe to determine dimensions.
func (t *GenerateMarkersTask) videoWidthMismatch(path string, sourceWidth int, sourceHeight int) bool {
	ffprobe := instance.FFProbe
	if ffprobe == nil {
		return false
	}

	vf, err := ffprobe.NewVideoFile(path)
	if err != nil {
		return false
	}

	actualWidth := vf.Width
	if t.HighQualityMarkers {
		return !sourceQualityWidthMatches(actualWidth, sourceWidth, sourceHeight)
	}
	return !widthMatches(actualWidth, lowQualityMarkerWidth)
}

func sourceQualityWidthMatches(actual int, sourceWidth int, sourceHeight int) bool {
	if widthMatches(actual, sourceWidth) {
		return true
	}

	// ffmpeg can apply rotation metadata during generation, producing an output
	// whose width matches the source height. This is still source quality.
	return sourceHeight > 0 && widthMatches(actual, sourceHeight)
}

func widthMatches(actual int, expected int) bool {
	if expected <= 0 {
		return false
	}

	const tolerance = 4
	delta := actual - expected
	if delta < 0 {
		delta = -delta
	}

	return delta <= tolerance
}
