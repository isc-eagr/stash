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

// StudioSiteSync names the site a studio syncs from.
type StudioSiteSync struct {
	Name string
	// Pictures is true when the site downloads members pictures; other sites
	// use folders added by hand.
	Pictures bool
}

// StudioSiteSyncReport is what one site sync run changed and found. Only the
// latest run per studio is kept, in memory.
type StudioSiteSyncReport struct {
	JobID     int `gqlgen:"job_id"`
	Site      string
	Finished  bool
	Cancelled bool
	Error     *string
	// Checked counts the studio's scenes the run looked at; postponed ones
	// are left out and counted apart.
	Checked   int
	Postponed int
	// NoPictures counts scenes the site has no pictures for (or, for sites
	// without downloads, no folder added by hand).
	NoPictures     int `gqlgen:"no_pictures"`
	ScannedFolders int `gqlgen:"scanned_folders"`
	Warnings       []string
	Scenes         []*StudioSiteSyncSceneChange
}

// StudioSiteSyncSceneChange lists what a run did to one scene and what still
// needs a manual fix.
type StudioSiteSyncSceneChange struct {
	SceneID int `gqlgen:"scene_id"`
	// Title and Code are the values after the run; empty when unset.
	Title    string
	Basename string
	Code     string
	// Filled names the fields the run wrote: code, title, date, details,
	// urls, cover.
	Filled    []string
	Pictures  bool
	GalleryID *int `gqlgen:"gallery_id"`
	Issues    []string
}
