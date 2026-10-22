package manager

// CUSTOM: Public metadata never depends on having a local pictures folder.

import (
	"errors"
	"fmt"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/sitesync"
)

func (t *studioSiteSyncTaskCustom) preparePublicPictures() {
	if _, ok := t.site.(sitesync.PublicSceneSite); !ok {
		return
	}
	t.steps.Pictures = false
	if !t.steps.Galleries {
		return
	}
	var err error
	if t.picsPath == "" {
		err = errors.New("no pictures folder is set in Settings > Custom")
	} else if site, ok := t.site.(sitesync.FolderCoder); ok {
		t.folders, err = sitesync.FoldersByCode(site, t.picsPath)
	}
	if err != nil {
		t.steps.Galleries = false
		t.report.update(func(r *models.StudioSiteSyncReport) {
			r.Warnings = append(r.Warnings, fmt.Sprintf("Galleries skipped: %v. Public metadata can still be filled.", err))
		})
	}
}
