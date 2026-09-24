package urlbuilders

import (
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

type SceneMarkerURLBuilder struct {
	BaseURL  string
	OwnerPath string // CUSTOM
	SceneID  string
	MarkerID string
}

func NewSceneMarkerURLBuilder(baseURL string, sceneMarker *models.SceneMarker) SceneMarkerURLBuilder {
	// CUSTOM: release markers have their own primary video and generated media.
	if sceneMarker.ReleaseID != nil { // CUSTOM
		return SceneMarkerURLBuilder{ // CUSTOM
			BaseURL:  baseURL, // CUSTOM
			OwnerPath: "scene-release", // CUSTOM
			SceneID:  strconv.Itoa(*sceneMarker.ReleaseID), // CUSTOM
			MarkerID: strconv.Itoa(sceneMarker.ID), // CUSTOM
		} // CUSTOM
	} // CUSTOM
	return SceneMarkerURLBuilder{
		BaseURL:  baseURL,
		OwnerPath: "scene", // CUSTOM
		SceneID:  strconv.Itoa(sceneMarker.SceneID),
		MarkerID: strconv.Itoa(sceneMarker.ID),
	}
}

func (b SceneMarkerURLBuilder) GetStreamURL() string {
	return b.BaseURL + "/" + b.OwnerPath + "/" + b.SceneID + "/scene_marker/" + b.MarkerID + "/stream" // CUSTOM
}

func (b SceneMarkerURLBuilder) GetPreviewURL() string {
	return b.BaseURL + "/" + b.OwnerPath + "/" + b.SceneID + "/scene_marker/" + b.MarkerID + "/preview" // CUSTOM
}

func (b SceneMarkerURLBuilder) GetScreenshotURL() string {
	return b.BaseURL + "/" + b.OwnerPath + "/" + b.SceneID + "/scene_marker/" + b.MarkerID + "/screenshot" // CUSTOM
}
