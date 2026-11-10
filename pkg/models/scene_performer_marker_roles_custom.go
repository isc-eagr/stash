package models

// ScenePerformerMarkerRoles contains all scene-marker role labels for one performer.
type ScenePerformerMarkerRoles struct {
	PerformerID int      `json:"performer_id"`
	Roles       []string `json:"roles"`
}
