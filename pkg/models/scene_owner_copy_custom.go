package models

// SceneOwnerCustom names the scene or the release that owns markers, skip
// ranges, and loop presets. Exactly one ID is set.
type SceneOwnerCustom struct {
	SceneID   int
	ReleaseID int
}

// SceneOwnerCopyKindsCustom chooses what a copy between owners includes.
type SceneOwnerCopyKindsCustom struct {
	Markers         bool
	NegativeMarkers bool
	LoopPresets     bool
}

// SceneOwnerCopyResultCustom counts the new rows on the target.
type SceneOwnerCopyResultCustom struct {
	Markers         int
	NegativeMarkers int
	LoopPresets     int
}
