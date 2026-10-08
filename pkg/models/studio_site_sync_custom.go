package models

// CUSTOM: Studio site sync task data.

// SiteSyncSceneCustom is a studio scene as the site sync task sees it, with
// its primary file. Empty strings stand for NULL columns.
type SiteSyncSceneCustom struct {
	ID         int    `db:"id"`
	Title      string `db:"title"`
	Code       string `db:"code"`
	Date       string `db:"date"`
	Details    string `db:"details"`
	Basename   string `db:"basename"`
	Size       int64  `db:"size"`
	HasGallery bool   `db:"has_gallery"`
	// Postponed scenes carry a tag named "postpone" and are left alone.
	Postponed bool `db:"postponed"`
	URLs      []string
}
