package paths

// CUSTOM: generated O screenshot paths.

import (
	"path/filepath"
	"strconv"
)

func (gp *generatedPaths) GetOScreenshotDir() string {
	return filepath.Join(filepath.Dir(gp.Screenshots), "o_screenshots")
}

func (gp *generatedPaths) GetOScreenshotPath(sceneHash string, oID int) string {
	return filepath.Join(gp.GetOScreenshotDir(), sceneHash, strconv.Itoa(oID)+".jpg")
}
