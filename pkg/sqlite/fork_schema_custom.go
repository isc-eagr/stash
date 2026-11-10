package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"

	"github.com/stashapp/stash/pkg/logger"
)

// CUSTOM: Fork-owned tables and the fork's changes to upstream tables, installed
// at startup outside the upstream migration chain. Every step reads the current
// layout first, so an up-to-date database is left untouched. Rebuilds copy rows
// (and rowids where files are named by them) into the new layout.

const performerImagesSchemaCustom = `
CREATE TABLE IF NOT EXISTS performer_images (
  id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  performer_id integer NOT NULL,
  image_blob varchar(255) NOT NULL REFERENCES blobs(checksum),
  position integer NOT NULL DEFAULT 0,
  FOREIGN KEY (performer_id) REFERENCES performers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_performer_images_on_performer_id ON performer_images (performer_id);
CREATE INDEX IF NOT EXISTS index_performer_images_on_position ON performer_images (performer_id, position);
`

const markerPlaylistsSchemaCustom = `
CREATE TABLE IF NOT EXISTS marker_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  marker_ids TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marker_playlists_name ON marker_playlists(name);
`

// Each row is one performer in one role; a performer can be both top and
// bottom on the same marker.
const sceneMarkerPerformersSchemaCustom = `
CREATE TABLE IF NOT EXISTS scene_marker_performers (
  id integer PRIMARY KEY AUTOINCREMENT,
  scene_marker_id integer NOT NULL,
  performer_id integer NOT NULL,
  role text NOT NULL DEFAULT 'top',
  FOREIGN KEY (scene_marker_id) REFERENCES scene_markers (id) ON DELETE CASCADE,
  FOREIGN KEY (performer_id) REFERENCES performers (id) ON DELETE CASCADE,
  UNIQUE(scene_marker_id, performer_id, role)
);
CREATE INDEX IF NOT EXISTS idx_scene_marker_performers_performer ON scene_marker_performers (performer_id);
CREATE INDEX IF NOT EXISTS idx_scene_marker_performers_marker ON scene_marker_performers (scene_marker_id);
CREATE INDEX IF NOT EXISTS idx_scene_marker_performers_role ON scene_marker_performers (role);
CREATE INDEX IF NOT EXISTS idx_scene_marker_performers_performer_role ON scene_marker_performers (performer_id, role);
`

const sceneReleasesSchemaCustom = `
CREATE TABLE IF NOT EXISTS scene_releases (
  id integer primary key autoincrement NOT NULL,
  scene_id integer NOT NULL,
  title varchar(255),
  code varchar(255),
  details text,
  director varchar(255),
  url varchar(255),
  date date,
  date_precision tinyint,
  studio_id integer,
  cover_blob varchar(255) REFERENCES blobs(checksum),
  play_order integer NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  FOREIGN KEY(scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
  FOREIGN KEY(studio_id) REFERENCES studios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_scene_releases_scene_id ON scene_releases(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_releases_studio_id ON scene_releases(studio_id);
CREATE INDEX IF NOT EXISTS idx_scene_releases_date ON scene_releases(date);

CREATE TABLE IF NOT EXISTS scene_release_files (
  release_id integer NOT NULL,
  file_id integer NOT NULL,
  "primary" boolean NOT NULL DEFAULT 0,
  PRIMARY KEY(release_id, file_id),
  FOREIGN KEY(release_id) REFERENCES scene_releases(id) ON DELETE CASCADE,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scene_release_files_file_id ON scene_release_files(file_id);

CREATE TABLE IF NOT EXISTS scene_release_galleries (
  release_id integer NOT NULL,
  gallery_id integer NOT NULL,
  PRIMARY KEY(release_id, gallery_id),
  FOREIGN KEY(release_id) REFERENCES scene_releases(id) ON DELETE CASCADE,
  FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scene_release_galleries_gallery_id ON scene_release_galleries(gallery_id);
`

// Release-owned copies of the scene metadata, histories, and conversion
// request IDs, plus the combined scene/release gallery view.
const sceneReleaseMetadataSchemaCustom = `
CREATE VIEW IF NOT EXISTS scene_all_galleries_custom AS
SELECT scene_id, gallery_id FROM scenes_galleries
UNION
SELECT sr.scene_id, srg.gallery_id FROM scene_release_galleries srg
JOIN scene_releases sr ON sr.id = srg.release_id;

CREATE TABLE IF NOT EXISTS scene_release_metadata (
  release_id INTEGER PRIMARY KEY REFERENCES scene_releases(id) ON DELETE CASCADE,
  rating INTEGER,
  organized BOOLEAN NOT NULL DEFAULT 0,
  resume_time REAL NOT NULL DEFAULT 0,
  play_duration REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scene_release_urls (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY(release_id, position, url)
);
CREATE TABLE IF NOT EXISTS scene_release_performers (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  PRIMARY KEY(release_id, performer_id)
);
CREATE TABLE IF NOT EXISTS scene_release_tags (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(release_id, tag_id)
);
CREATE TABLE IF NOT EXISTS scene_release_groups (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  scene_index TEXT,
  PRIMARY KEY(release_id, group_id)
);
CREATE TABLE IF NOT EXISTS scene_release_stash_ids (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  endpoint TEXT,
  stash_id TEXT,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY(release_id, endpoint, stash_id)
);
CREATE TABLE IF NOT EXISTS scene_release_custom_fields (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value BLOB NOT NULL,
  PRIMARY KEY(release_id, field)
);
CREATE TABLE IF NOT EXISTS scene_release_view_dates (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  view_date DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS scene_release_o_dates (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  o_date DATETIME,
  video_timestamp REAL
);
CREATE TABLE IF NOT EXISTS scene_release_conversion_requests (
  request_id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK(direction IN ('scene_to_release','release_to_scene')),
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  result_id INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scene_release_performers_performer ON scene_release_performers(performer_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_tags_tag ON scene_release_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_groups_group ON scene_release_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_view_dates_release ON scene_release_view_dates(release_id);
CREATE INDEX IF NOT EXISTS idx_scene_release_o_dates_release ON scene_release_o_dates(release_id);
`

// Table layouts that can need a rebuild. %[1]s is the table name.

// o_date is nullable for retroactive O's.
const sceneODatesLayoutCustom = `
CREATE TABLE %[1]s (
  scene_id integer not null,
  o_date datetime,
  video_timestamp REAL,
  foreign key(scene_id) references scenes(id) on delete CASCADE
)`

const releaseODatesLayoutCustom = `
CREATE TABLE %[1]s (
  release_id INTEGER NOT NULL REFERENCES scene_releases(id) ON DELETE CASCADE,
  o_date DATETIME,
  video_timestamp REAL
)`

// Markers, skip ranges, and loop presets belong to a scene or to a release.
const sceneMarkersLayoutCustom = `
CREATE TABLE %[1]s (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(255) NOT NULL,
  seconds FLOAT NOT NULL,
  primary_tag_id INTEGER NOT NULL REFERENCES tags(id),
  scene_id INTEGER REFERENCES scenes(id),
  release_id INTEGER REFERENCES scene_releases(id) ON DELETE CASCADE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  end_seconds FLOAT,
  CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL))
)`

const sceneNegativeMarkersLayoutCustom = `
CREATE TABLE %[1]s (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
  release_id INTEGER REFERENCES scene_releases(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  start_seconds FLOAT NOT NULL,
  end_seconds FLOAT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(end_seconds > start_seconds),
  CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL))
)`

const sceneLoopPresetsLayoutCustom = `
CREATE TABLE %[1]s (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
  release_id INTEGER REFERENCES scene_releases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segments TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT 0,
  current_segment_index INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((scene_id IS NOT NULL) != (release_id IS NOT NULL))
)`

const releaseActivityIndexesCustom = `
CREATE INDEX IF NOT EXISTS index_scene_markers_on_scene_id ON scene_markers(scene_id);
CREATE INDEX IF NOT EXISTS index_scene_markers_on_primary_tag_id ON scene_markers(primary_tag_id);
CREATE INDEX IF NOT EXISTS idx_scene_markers_release_id ON scene_markers(release_id);
CREATE INDEX IF NOT EXISTS idx_scene_negative_markers_scene_id ON scene_negative_markers(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_negative_markers_release_id ON scene_negative_markers(release_id);
CREATE INDEX IF NOT EXISTS idx_scene_multi_segment_loop_presets_scene_id ON scene_multi_segment_loop_presets(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_multi_segment_loop_presets_release_id ON scene_multi_segment_loop_presets(release_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_loop_presets_scene_name ON scene_multi_segment_loop_presets(scene_id,name) WHERE scene_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_loop_presets_release_name ON scene_multi_segment_loop_presets(release_id,name) WHERE release_id IS NOT NULL;
`

const ratingScoresLayoutCustom = `
CREATE TABLE %[1]s (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('scene','scene_release','performer')),
  entity_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  raw_value REAL NOT NULL DEFAULT 0,
  weighted_value REAL NOT NULL DEFAULT 0,
  label TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type,entity_id,key)
)`

const ratingScoresColumnsCustom = "id,entity_type,entity_id,key,raw_value,weighted_value,label,created_at,updated_at"

// Generic entity references cannot use one conventional foreign key, so
// triggers enforce existence and cascade cleanup. %[1]s is the table, %[2]s the
// noun used in the error.
const ratingScoresEntityTriggersCustom = `
CREATE TRIGGER IF NOT EXISTS %[1]s_entity_insert_custom
BEFORE INSERT ON %[1]s
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating %[2]s entity does not exist'); END;
CREATE TRIGGER IF NOT EXISTS %[1]s_entity_update_custom
BEFORE UPDATE OF entity_type,entity_id ON %[1]s
WHEN (NEW.entity_type='scene' AND NOT EXISTS(SELECT 1 FROM scenes WHERE id=NEW.entity_id))
  OR (NEW.entity_type='scene_release' AND NOT EXISTS(SELECT 1 FROM scene_releases WHERE id=NEW.entity_id))
  OR (NEW.entity_type='performer' AND NOT EXISTS(SELECT 1 FROM performers WHERE id=NEW.entity_id))
  OR NEW.entity_type NOT IN ('scene','scene_release','performer')
BEGIN SELECT RAISE(ABORT,'rating %[2]s entity does not exist'); END;
`

const ratingScoresDeleteTriggersCustom = `
CREATE TRIGGER IF NOT EXISTS rating_scores_release_delete_custom AFTER DELETE ON scene_releases
BEGIN
 DELETE FROM rating_criteria_scores WHERE entity_type='scene_release' AND entity_id=OLD.id;
 DELETE FROM rating_bonus_scores WHERE entity_type='scene_release' AND entity_id=OLD.id;
 DELETE FROM rating_penalty_scores WHERE entity_type='scene_release' AND entity_id=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS rating_scores_scene_delete_custom AFTER DELETE ON scenes
BEGIN
 DELETE FROM rating_criteria_scores WHERE entity_type='scene' AND entity_id=OLD.id;
 DELETE FROM rating_bonus_scores WHERE entity_type='scene' AND entity_id=OLD.id;
 DELETE FROM rating_penalty_scores WHERE entity_type='scene' AND entity_id=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS rating_scores_performer_delete_custom AFTER DELETE ON performers
BEGIN
 DELETE FROM rating_criteria_scores WHERE entity_type='performer' AND entity_id=OLD.id;
 DELETE FROM rating_bonus_scores WHERE entity_type='performer' AND entity_id=OLD.id;
 DELETE FROM rating_penalty_scores WHERE entity_type='performer' AND entity_id=OLD.id;
END;
`

var ratingScoreTablesCustom = []struct{ table, noun string }{
	{ratingCriteriaScoresTable, "criterion"},
	{ratingBonusScoresTable, "bonus"},
	{ratingPenaltyScoresTable, "penalty"},
}

// Rebuilt tables lose their planner statistics; marker-role queries are very
// slow without them.
var forkSchemaAnalyzeTablesCustom = []string{
	"scenes_o_dates", "scene_release_o_dates", "scene_markers", "scene_negative_markers",
	"scene_multi_segment_loop_presets", ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable,
}

// ensureForkSchemaCustom runs before the connection pools open, on its own
// connection with foreign keys off: dropping a rebuilt parent table with them
// on would cascade-delete its children (marker tags and performers).
func (db *Database) ensureForkSchemaCustom(ctx context.Context) error {
	pool, err := db.open(true, true)
	if err != nil {
		return err
	}
	defer pool.Close()
	pool.SetMaxOpenConns(1)

	conn, err := pool.Connx(ctx)
	if err != nil {
		return fmt.Errorf("opening fork schema connection: %w", err)
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, "PRAGMA foreign_keys = OFF"); err != nil {
		return err
	}

	tx, err := conn.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("starting fork schema bootstrap: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	rebuilt, err := applyForkSchemaCustom(ctx, tx)
	if err != nil {
		return fmt.Errorf("installing fork schema: %w", err)
	}
	if len(rebuilt) > 0 {
		for _, table := range forkSchemaAnalyzeTablesCustom {
			if _, err := tx.ExecContext(ctx, "ANALYZE "+table); err != nil {
				return fmt.Errorf("analyzing %s: %w", table, err)
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing fork schema bootstrap: %w", err)
	}
	if len(rebuilt) == 0 {
		return nil
	}

	logger.Infof("Upgraded custom database tables: %s", strings.Join(rebuilt, ", "))
	var violations int
	if err := conn.GetContext(ctx, &violations, "SELECT COUNT(*) FROM pragma_foreign_key_check"); err != nil {
		return err
	}
	if violations > 0 {
		logger.Warnf("Database has %d foreign key violations after the custom table upgrade", violations)
	}
	return nil
}

// applyForkSchemaCustom returns the tables it rebuilt.
func applyForkSchemaCustom(ctx context.Context, tx sqlx.ExtContext) ([]string, error) {
	var rebuilt []string
	for _, step := range []func(context.Context, sqlx.ExtContext) ([]string, error){
		ensureSceneODatesCustom,
		execForkSchemaCustom(performerImagesSchemaCustom, markerPlaylistsSchemaCustom,
			sceneMarkerPerformersSchemaCustom, sceneReleasesSchemaCustom, sceneReleaseMetadataSchemaCustom),
		ensureReleaseODatesCustom,
		ensureReleaseActivitySchemaCustom,
		ensureRatingScoreSchemaCustom,
		// Leftovers of the manual release upgrades, which wrote them as done markers.
		execForkSchemaCustom(`DROP TABLE IF EXISTS scene_release_activity_upgrade_guard;
DROP TABLE IF EXISTS scene_release_rating_upgrade_guard;`),
	} {
		tables, err := step(ctx, tx)
		if err != nil {
			return nil, err
		}
		rebuilt = append(rebuilt, tables...)
	}
	return rebuilt, nil
}

func execForkSchemaCustom(schemas ...string) func(context.Context, sqlx.ExtContext) ([]string, error) {
	return func(ctx context.Context, tx sqlx.ExtContext) ([]string, error) {
		for _, schema := range schemas {
			if _, err := tx.ExecContext(ctx, schema); err != nil {
				return nil, err
			}
		}
		return nil, nil
	}
}

// ensureSceneODatesCustom adds the O video timestamp and makes o_date
// nullable. The rebuild keeps rowids, which name the O screenshot files.
func ensureSceneODatesCustom(ctx context.Context, tx sqlx.ExtContext) ([]string, error) {
	columns, err := tableColumnsCustom(ctx, tx, "scenes_o_dates")
	if err != nil {
		return nil, err
	}
	if _, ok := columns["video_timestamp"]; !ok {
		if _, err := tx.ExecContext(ctx, "ALTER TABLE scenes_o_dates ADD COLUMN video_timestamp REAL"); err != nil {
			return nil, err
		}
	}
	if !columns["o_date"] {
		return nil, nil
	}
	if err := rebuildTableCustom(ctx, tx, "scenes_o_dates", sceneODatesLayoutCustom, "rowid,scene_id,o_date,video_timestamp"); err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, "CREATE INDEX IF NOT EXISTS index_scenes_o_dates ON scenes_o_dates (scene_id)")
	return []string{"scenes_o_dates"}, err
}

// ensureReleaseODatesCustom makes release o_date nullable so converted
// retroactive O's keep their rows.
func ensureReleaseODatesCustom(ctx context.Context, tx sqlx.ExtContext) ([]string, error) {
	columns, err := tableColumnsCustom(ctx, tx, "scene_release_o_dates")
	if err != nil || !columns["o_date"] {
		return nil, err
	}
	if err := rebuildTableCustom(ctx, tx, "scene_release_o_dates", releaseODatesLayoutCustom, "rowid,release_id,o_date,video_timestamp"); err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, "CREATE INDEX IF NOT EXISTS idx_scene_release_o_dates_release ON scene_release_o_dates(release_id)")
	return []string{"scene_release_o_dates"}, err
}

// ensureReleaseActivitySchemaCustom gives markers, skip ranges, and loop
// presets a release owner, keeping their IDs.
func ensureReleaseActivitySchemaCustom(ctx context.Context, tx sqlx.ExtContext) ([]string, error) {
	var rebuilt []string
	for _, entry := range []struct{ table, layout, columns string }{
		{"scene_markers", sceneMarkersLayoutCustom, "id,title,seconds,primary_tag_id,scene_id,created_at,updated_at,end_seconds"},
		{"scene_negative_markers", sceneNegativeMarkersLayoutCustom, "id,scene_id,name,start_seconds,end_seconds,created_at,updated_at"},
		{"scene_multi_segment_loop_presets", sceneLoopPresetsLayoutCustom, "id,scene_id,name,segments,enabled,current_segment_index,created_at,updated_at"},
	} {
		columns, err := tableColumnsCustom(ctx, tx, entry.table)
		if err != nil {
			return nil, err
		}
		if len(columns) == 0 {
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(entry.layout, entry.table)); err != nil {
				return nil, err
			}
			continue
		}
		if _, ok := columns["release_id"]; ok {
			continue
		}
		if err := rebuildTableCustom(ctx, tx, entry.table, entry.layout, entry.columns); err != nil {
			return nil, err
		}
		rebuilt = append(rebuilt, entry.table)
	}
	if _, err := tx.ExecContext(ctx, releaseActivityIndexesCustom); err != nil {
		return nil, err
	}
	return rebuilt, nil
}

// ensureRatingScoreSchemaCustom installs the Rating Advisor score tables with
// release support. Older tables without it are rebuilt, keeping their IDs.
func ensureRatingScoreSchemaCustom(ctx context.Context, tx sqlx.ExtContext) ([]string, error) {
	var missing, outdated []string
	for _, entry := range ratingScoreTablesCustom {
		var layouts []string
		if err := sqlx.SelectContext(ctx, tx, &layouts, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, entry.table); err != nil {
			return nil, err
		}
		switch {
		case len(layouts) == 0:
			missing = append(missing, entry.table)
		case !strings.Contains(layouts[0], "'scene_release'"):
			outdated = append(outdated, entry.table)
		}
	}
	for _, table := range missing {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(ratingScoresLayoutCustom, table)); err != nil {
			return nil, err
		}
	}
	for _, table := range outdated {
		if err := rebuildTableCustom(ctx, tx, table, ratingScoresLayoutCustom, ratingScoresColumnsCustom); err != nil {
			return nil, err
		}
	}
	for _, entry := range ratingScoreTablesCustom {
		schema := fmt.Sprintf("CREATE INDEX IF NOT EXISTS idx_%[1]s_entity ON %[1]s(entity_type,entity_id);", entry.table) +
			fmt.Sprintf(ratingScoresEntityTriggersCustom, entry.table, entry.noun)
		if _, err := tx.ExecContext(ctx, schema); err != nil {
			return nil, err
		}
	}
	if _, err := tx.ExecContext(ctx, ratingScoresDeleteTriggersCustom); err != nil {
		return nil, err
	}
	return outdated, nil
}

// tableColumnsCustom maps each column to whether it is NOT NULL. It is empty
// when the table does not exist.
func tableColumnsCustom(ctx context.Context, tx sqlx.ExtContext, table string) (map[string]bool, error) {
	var rows []struct {
		Name    string `db:"name"`
		NotNull bool   `db:"notnull"`
	}
	if err := sqlx.SelectContext(ctx, tx, &rows, `SELECT name, "notnull" FROM pragma_table_info(?)`, table); err != nil {
		return nil, err
	}
	columns := make(map[string]bool, len(rows))
	for _, row := range rows {
		columns[row.Name] = row.NotNull
	}
	return columns, nil
}

// rebuildTableCustom swaps table for one built from layout, copying columns
// (the old table's, which the new layout must accept). Indexes and the table's
// own triggers go with the old table, so callers recreate them. The legacy
// rename skips revalidating views and triggers that name the table while it
// is briefly missing; they resolve to the new table by name.
func rebuildTableCustom(ctx context.Context, tx sqlx.ExtContext, table, layout, columns string) error {
	next := table + "_rebuild_custom"
	query := fmt.Sprintf(layout, next) + fmt.Sprintf(`;
INSERT INTO %[1]s (%[3]s) SELECT %[3]s FROM %[2]s;
DROP TABLE %[2]s;
PRAGMA legacy_alter_table = ON;
ALTER TABLE %[1]s RENAME TO %[2]s;
PRAGMA legacy_alter_table = OFF;`, next, table, columns)
	if _, err := tx.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("rebuilding %s: %w", table, err)
	}
	return nil
}
