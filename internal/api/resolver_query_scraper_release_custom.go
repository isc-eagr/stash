package api

// CUSTOM: scrape a release. Stash-box uses the release's file fingerprints and
// scrapers read the release's own metadata, never the parent scene's.

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scraper"
)

// releaseScrapeSceneCustom builds the scene a scraper sees for a release. Its
// ID is the parent scene's, since scrapers treat it as a scene ID.
func releaseScrapeSceneCustom(ctx context.Context, qb models.SceneReleaseReader, releaseID int) (*models.Scene, error) {
	release, err := qb.Find(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	if release == nil {
		return nil, fmt.Errorf("release with id %d not found", releaseID)
	}
	urls, err := qb.GetURLsCustom(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	if len(urls) == 0 && release.URL != "" {
		urls = []string{release.URL}
	}
	files, err := qb.GetFiles(ctx, releaseID)
	if err != nil {
		return nil, err
	}

	ret := &models.Scene{
		ID:       release.SceneID,
		Title:    release.Title,
		Code:     release.Code,
		Details:  release.Details,
		Director: release.Director,
		Date:     release.Date,
		StudioID: release.StudioID,
		URLs:     models.NewRelatedStrings(urls),
		Files:    models.NewRelatedVideoFiles(files),
	}
	if len(files) > 0 {
		primary := files[0]
		ret.PrimaryFileID = &primary.ID
		ret.Path = primary.Path
		ret.OSHash = primary.Fingerprints.GetString(models.FingerprintTypeOshash)
		ret.Checksum = primary.Fingerprints.GetString(models.FingerprintTypeMD5)
	}
	return ret, nil
}

// releaseFingerprintsCustom returns the fingerprints of every release file.
// A release without files has nothing to match on stash-box.
func releaseFingerprintsCustom(ctx context.Context, qb models.SceneReleaseReader, releaseID int) (models.Fingerprints, error) {
	release, err := qb.Find(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	if release == nil {
		return nil, fmt.Errorf("release with id %d not found", releaseID)
	}
	files, err := qb.GetFiles(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	var ret models.Fingerprints
	for _, f := range files {
		ret = append(ret, f.Fingerprints...)
	}
	if len(ret) == 0 {
		return nil, fmt.Errorf("%w: release %d has no file fingerprints to look up", ErrInput, releaseID)
	}
	return ret, nil
}

func parseScrapeReleaseIDCustom(input ScrapeSingleSceneInput) (int, error) {
	if input.SceneID != nil {
		return 0, fmt.Errorf("%w: set scene_id or release_id, not both", ErrInput)
	}
	releaseID, err := strconv.Atoi(*input.ReleaseID)
	if err != nil {
		return 0, fmt.Errorf("%w: release_id is not an integer: '%s'", ErrInput, *input.ReleaseID)
	}
	return releaseID, nil
}

// scrapeReleaseWithScraperCustom is the release form of the scraper scene_id path.
func (r *queryResolver) scrapeReleaseWithScraperCustom(ctx context.Context, scraperID string, input ScrapeSingleSceneInput) ([]scraper.ScrapedContent, error) {
	releaseID, err := parseScrapeReleaseIDCustom(input)
	if err != nil {
		return nil, err
	}
	var scene *models.Scene
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		scene, err = releaseScrapeSceneCustom(ctx, r.repository.SceneRelease, releaseID)
		return err
	}); err != nil {
		return nil, err
	}
	c, err := r.scraperCache().ScrapeSceneCustom(ctx, scraperID, scene)
	if err != nil || c == nil {
		return nil, err
	}
	return []scraper.ScrapedContent{c}, nil
}

// releaseStashBoxFingerprintsCustom is the release form of the stash-box scene_id path.
func (r *queryResolver) releaseStashBoxFingerprintsCustom(ctx context.Context, input ScrapeSingleSceneInput) (models.Fingerprints, error) {
	releaseID, err := parseScrapeReleaseIDCustom(input)
	if err != nil {
		return nil, err
	}
	var ret models.Fingerprints
	err = r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = releaseFingerprintsCustom(ctx, r.repository.SceneRelease, releaseID)
		return err
	})
	return ret, err
}
