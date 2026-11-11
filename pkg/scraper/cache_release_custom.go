package scraper

// CUSTOM: scrape a scene the caller built, such as a release's own metadata
// and files, instead of loading a stored scene by ID.

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/pkg/models"
)

// ScrapeSceneCustom runs the scraper's scene-by-ID path against scene.
func (c Cache) ScrapeSceneCustom(ctx context.Context, scraperID string, scene *models.Scene) (ScrapedContent, error) {
	s := c.findScraper(scraperID)
	if s == nil {
		return nil, fmt.Errorf("%w: id %s", ErrNotFound, scraperID)
	}
	if !s.supports(ScrapeContentTypeScene) {
		return nil, fmt.Errorf("%w: cannot use scraper %s to scrape %v content", ErrNotSupported, scraperID, ScrapeContentTypeScene)
	}
	ss, ok := s.(sceneScraper)
	if !ok {
		return nil, fmt.Errorf("%w: cannot use scraper %s as a scene scraper", ErrNotSupported, scraperID)
	}

	scraped, err := ss.viaScene(ctx, c.client, scene)
	if err != nil {
		return nil, fmt.Errorf("scraper %s: %w", scraperID, err)
	}
	// don't assign nil concrete pointer to the interface
	var ret ScrapedContent
	if scraped != nil {
		ret = scraped
	}
	return c.postScrapeSingle(ctx, ret)
}
