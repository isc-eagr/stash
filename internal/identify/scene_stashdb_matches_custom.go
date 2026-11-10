package identify

// CUSTOM: Identify refreshes StashDB Matches from stashdb.org results.

import "context"

// The count is a remote statistic rather than curated metadata, so Merge and
// Overwrite both refresh it; only Ignore keeps the stored value.
func (t *SceneIdentifier) setStashDBMatchesCustom(ctx context.Context, sceneID int, result *scrapeResult) error {
	matches := result.result.StashDBMatches
	if matches == nil {
		return nil
	}

	var allOptions []MetadataOptions
	if result.source.Options != nil {
		allOptions = append(allOptions, *result.source.Options)
	}
	if t.DefaultOptions != nil {
		allOptions = append(allOptions, *t.DefaultOptions)
	}
	if getFieldStrategy(getFieldOptions(allOptions)["stashdb_matches"]) == FieldStrategyIgnore {
		return nil
	}

	return t.SceneReaderUpdater.SetStashDBMatchesCustom(ctx, sceneID, matches)
}
