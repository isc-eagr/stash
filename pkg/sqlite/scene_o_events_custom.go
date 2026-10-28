package sqlite

// CUSTOM: O events from scenes and their releases as one row source, so O
// counts, dates, and stats count both. Each release O credits its own studio,
// cast, and markers; everything else comes from the parent scene.

import (
	"context"
	"sync/atomic"
)

var releaseOEventsReadyCustom atomic.Bool

// SetReleaseOEventsReadyCustom records whether release O history exists. The
// database sets it at startup, after installing the release tables.
func SetReleaseOEventsReadyCustom(ready bool) {
	releaseOEventsReadyCustom.Store(ready)
}

func (db *Database) detectReleaseOEventsCustom(ctx context.Context) error {
	ready := true
	// The StashDB Matches schema runs first and adds scene_release_stashdb_matches.
	for _, table := range []string{
		"scene_releases", "scene_release_o_dates", "scene_release_performers", "scene_release_groups",
		"scene_release_stashdb_matches",
	} {
		var count int
		if err := db.writeDB.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, table).Scan(&count); err != nil {
			return err
		}
		ready = ready && count == 1
	}
	SetReleaseOEventsReadyCustom(ready)
	return nil
}

// SceneOEventsSQLCustom is a parenthesized row source for O events. Columns:
// rowid (scene O rowid, or the negated release O rowid so IDs stay unique),
// scene_id (the parent scene), release_id (NULL for scene O's), owner_key
// ('s<scene>' or 'r<release>', for SceneOEventCastSQLCustom), o_date,
// video_timestamp, and studio_id (the owner's own studio).
func SceneOEventsSQLCustom() string {
	query := `(SELECT sod.rowid AS rowid, sod.scene_id AS scene_id, NULL AS release_id,
  's' || sod.scene_id AS owner_key, sod.o_date AS o_date, sod.video_timestamp AS video_timestamp,
  sc.studio_id AS studio_id
FROM scenes_o_dates sod JOIN scenes sc ON sc.id = sod.scene_id`
	if releaseOEventsReadyCustom.Load() {
		query += `
UNION ALL
SELECT -rod.rowid, rel.scene_id, rod.release_id, 'r' || rod.release_id, rod.o_date, rod.video_timestamp, rel.studio_id
FROM scene_release_o_dates rod JOIN scene_releases rel ON rel.id = rod.release_id`
	}
	return query + ")"
}

// SceneOEventCastSQLCustom is a parenthesized row source of (owner_key,
// performer_id): a scene O's cast is the scene's, a release O's the release's.
func SceneOEventCastSQLCustom() string {
	query := `(SELECT 's' || scene_id AS owner_key, performer_id FROM performers_scenes`
	if releaseOEventsReadyCustom.Load() {
		query += `
UNION ALL
SELECT 'r' || release_id, performer_id FROM scene_release_performers`
	}
	return query + ")"
}

// SceneOEventMarkerJoinCustom matches markers on an O event's own owner:
// scene markers for scene O's, release markers for release O's.
func SceneOEventMarkerJoinCustom(markerAlias, eventAlias string) string {
	return "((" + eventAlias + ".release_id IS NULL AND " + markerAlias + ".scene_id = " + eventAlias + ".scene_id) OR " +
		markerAlias + ".release_id = " + eventAlias + ".release_id)"
}

// sceneTotalOCountSQLCustom counts a scene's O's plus its releases', for
// sorting and filtering by the O count scene pages show.
func sceneTotalOCountSQLCustom(sceneRef string) string {
	expr := "(SELECT COUNT(*) FROM scenes_o_dates sod WHERE sod.scene_id = " + sceneRef + ")"
	if releaseOEventsReadyCustom.Load() {
		expr += ` + (SELECT COUNT(*) FROM scene_release_o_dates rod
  JOIN scene_releases rel ON rel.id = rod.release_id WHERE rel.scene_id = ` + sceneRef + ")"
	}
	return "(" + expr + ")"
}

// sceneLastOSQLCustom is the latest dated O on a scene or its releases.
func sceneLastOSQLCustom(sceneRef string) string {
	sceneLast := "(SELECT MAX(sod.o_date) FROM scenes_o_dates sod WHERE sod.scene_id = " + sceneRef + ")"
	if !releaseOEventsReadyCustom.Load() {
		return sceneLast
	}
	releaseLast := `(SELECT MAX(rod.o_date) FROM scene_release_o_dates rod
  JOIN scene_releases rel ON rel.id = rod.release_id WHERE rel.scene_id = ` + sceneRef + ")"
	return "NULLIF(MAX(COALESCE(" + sceneLast + ", ''), COALESCE(" + releaseLast + ", '')), '')"
}

// SceneTotalStashDBMatchesSQLCustom sums the scene's StashDB Matches and its
// releases'; NULL while neither has a count.
func SceneTotalStashDBMatchesSQLCustom(sceneRef string) string {
	sceneMatches := "(SELECT matches FROM scene_stashdb_matches WHERE scene_id = " + sceneRef + ")"
	if !releaseOEventsReadyCustom.Load() {
		return sceneMatches
	}
	releaseMatches := `(SELECT SUM(m.matches) FROM scene_release_stashdb_matches m
  JOIN scene_releases rel ON rel.id = m.release_id WHERE rel.scene_id = ` + sceneRef + ")"
	return "(CASE WHEN " + sceneMatches + " IS NULL AND " + releaseMatches + " IS NULL THEN NULL ELSE COALESCE(" +
		sceneMatches + ", 0) + COALESCE(" + releaseMatches + ", 0) END)"
}

// groupTotalOCountSQLCustom adds O's on releases assigned to the group to the
// group's scene O's.
func groupTotalOCountSQLCustom() string {
	expr := "(" + selectGroupOCountSQL + ")"
	if releaseOEventsReadyCustom.Load() {
		expr += ` + (SELECT COUNT(*) FROM scene_release_o_dates rod
  JOIN scene_release_groups rg ON rg.release_id = rod.release_id WHERE rg.group_id = groups.id)`
	}
	return "(" + expr + ")"
}

// releaseOCountByGroupCustom counts O's on releases assigned to the group.
func releaseOCountByGroupCustom(ctx context.Context, groupID int) (int, error) {
	if !releaseOEventsReadyCustom.Load() {
		return 0, nil
	}
	var count int
	err := dbWrapper.Get(ctx, &count, `SELECT COUNT(*) FROM scene_release_o_dates rod
  JOIN scene_release_groups rg ON rg.release_id = rod.release_id WHERE rg.group_id = ?`, groupID)
	return count, err
}
