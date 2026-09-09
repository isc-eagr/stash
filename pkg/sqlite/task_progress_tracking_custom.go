package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
	_ "time/tzdata"
)

const taskProgressTrackerEventTableCustom = "task_progress_tracker_events"

type taskProgressTagSetCustom map[int]struct{}

var taskProgressTimezoneCustom = func() *time.Location {
	location, err := time.LoadLocation("America/Mexico_City")
	if err != nil {
		return time.FixedZone("America/Mexico_City", -6*60*60)
	}
	return location
}()

func taskProgressItemLabelCustom(ctx context.Context, itemType string, itemID int) (string, error) {
	var tableName, labelColumn, fallbackPrefix string
	switch itemType {
	case "scene":
		tableName, labelColumn, fallbackPrefix = "scenes", "title", "Scene"
	case "scene_marker":
		tableName, labelColumn, fallbackPrefix = "scene_markers", "title", "Marker"
	case "image":
		tableName, labelColumn, fallbackPrefix = "images", "title", "Image"
	case "gallery":
		tableName, labelColumn, fallbackPrefix = "galleries", "title", "Gallery"
	case "performer":
		tableName, labelColumn, fallbackPrefix = "performers", "name", "Performer"
	case "studio":
		tableName, labelColumn, fallbackPrefix = "studios", "name", "Studio"
	case "group":
		tableName, labelColumn, fallbackPrefix = "groups", "name", "Group"
	default:
		return "", fmt.Errorf("unsupported task progress item type %q", itemType)
	}

	fallback := fmt.Sprintf("%s #%d", fallbackPrefix, itemID)
	query := fmt.Sprintf("SELECT COALESCE(NULLIF(%s, ''), ?) FROM %s WHERE id = ?", labelColumn, tableName)
	var label string
	if err := dbWrapper.Get(ctx, &label, query, fallback, itemID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fallback, nil
		}
		return "", fmt.Errorf("getting %s %d task progress label: %w", itemType, itemID, err)
	}
	return label, nil
}

func taskProgressTagSnapshotCustom(ctx context.Context, itemType string, itemID int) (taskProgressTagSetCustom, error) {
	var (
		tagIDs []int
		err    error
	)

	switch itemType {
	case "scene":
		tagIDs, err = scenesTagsTableMgr.get(ctx, itemID)
	case "scene_marker":
		const query = `
SELECT primary_tag_id AS id FROM scene_markers WHERE id = ?
UNION
SELECT tag_id AS id FROM scene_markers_tags WHERE scene_marker_id = ?`
		tagIDs, err = sceneMarkerRepository.runIdsQuery(ctx, query, []interface{}{itemID, itemID})
	case "image":
		tagIDs, err = imagesTagsTableMgr.get(ctx, itemID)
	case "gallery":
		tagIDs, err = galleriesTagsTableMgr.get(ctx, itemID)
	case "performer":
		tagIDs, err = performersTagsTableMgr.get(ctx, itemID)
	case "studio":
		tagIDs, err = studiosTagsTableMgr.get(ctx, itemID)
	case "group":
		tagIDs, err = groupsTagsTableMgr.get(ctx, itemID)
	default:
		return nil, fmt.Errorf("unsupported task progress item type %q", itemType)
	}
	if err != nil {
		return nil, fmt.Errorf("getting %s %d task progress tags: %w", itemType, itemID, err)
	}

	ret := make(taskProgressTagSetCustom, len(tagIDs))
	for _, tagID := range tagIDs {
		ret[tagID] = struct{}{}
	}
	return ret, nil
}

func recordTaskProgressTagDiffCustom(ctx context.Context, itemType string, itemID int, before, after taskProgressTagSetCustom, preservedLabel ...string) error {
	completed := make([]int, 0)
	incoming := make([]int, 0)
	for tagID := range before {
		if _, found := after[tagID]; !found {
			completed = append(completed, tagID)
		}
	}
	for tagID := range after {
		if _, found := before[tagID]; !found {
			incoming = append(incoming, tagID)
		}
	}
	if len(completed) == 0 && len(incoming) == 0 {
		return nil
	}

	itemLabel := ""
	if len(preservedLabel) > 0 {
		itemLabel = preservedLabel[0]
	} else {
		var err error
		itemLabel, err = taskProgressItemLabelCustom(ctx, itemType, itemID)
		if err != nil {
			return err
		}
	}

	for _, tagID := range completed {
		if err := recordTaskProgressEventCustom(ctx, "COMPLETED", itemType, itemID, itemLabel, tagID); err != nil {
			return err
		}
	}

	for _, tagID := range incoming {
		if err := recordTaskProgressEventCustom(ctx, "INCOMING", itemType, itemID, itemLabel, tagID); err != nil {
			return err
		}
	}

	return nil
}

func recordTaskProgressEventCustom(ctx context.Context, eventType, itemType string, itemID int, itemLabel string, tagID int) error {
	now := time.Now().UTC()
	requiredMemberState := "PENDING"
	memberStateAfter := "COMPLETED"
	if eventType == "INCOMING" {
		requiredMemberState = "COMPLETED"
		memberStateAfter = "PENDING"
	}

	const query = `
INSERT INTO task_progress_tracker_events (
  tracker_id, event_type, item_type, item_id, item_label, occurred_on, occurred_at, baseline_count, tag_id
)
SELECT id, ?, ?, ?, ?, ?, ?, 0, ?
FROM task_progress_trackers
WHERE tag_id = ?
  AND status != 'ARCHIVED'
  AND instr(',' || item_types || ',', ',' || ? || ',') > 0
  AND (
    mode = 'BACKLOG'
    OR (
      mode = 'FIXED'
      AND EXISTS (
        SELECT 1
        FROM task_progress_tracker_members
        WHERE tracker_id = task_progress_trackers.id
          AND item_type = ?
          AND item_id = ?
          AND state = ?
      )
    )
  )`

	if _, err := dbWrapper.Exec(ctx, query,
		eventType,
		itemType,
		itemID,
		itemLabel,
		now.In(taskProgressTimezoneCustom).Format("2006-01-02"),
		now,
		tagID,
		tagID,
		itemType,
		itemType,
		itemID,
		requiredMemberState,
	); err != nil {
		if taskProgressTablesMissingCustom(err) {
			return nil
		}
		return fmt.Errorf("recording %s task progress event for %s %d: %w", eventType, itemType, itemID, err)
	}

	const updateMemberQuery = `
UPDATE task_progress_tracker_members
SET state = ?
WHERE item_type = ?
  AND item_id = ?
  AND state = ?
  AND tracker_id IN (
    SELECT id
    FROM task_progress_trackers
    WHERE tag_id = ?
      AND mode = 'FIXED'
      AND status != 'ARCHIVED'
      AND instr(',' || item_types || ',', ',' || ? || ',') > 0
  )`
	if _, err := dbWrapper.Exec(ctx, updateMemberQuery,
		memberStateAfter,
		itemType,
		itemID,
		requiredMemberState,
		tagID,
		itemType,
	); err != nil {
		if taskProgressTablesMissingCustom(err) {
			return nil
		}
		return fmt.Errorf("updating fixed task progress membership for %s %d: %w", itemType, itemID, err)
	}

	if eventType == "INCOMING" {
		const reactivateQuery = `
UPDATE task_progress_trackers
SET status = 'ACTIVE', version = version + 1, updated_at = ?
WHERE tag_id = ?
  AND status = 'COMPLETED'
  AND instr(',' || item_types || ',', ',' || ? || ',') > 0
  AND (
    mode = 'BACKLOG'
    OR EXISTS (
      SELECT 1
      FROM task_progress_tracker_members
      WHERE tracker_id = task_progress_trackers.id
        AND item_type = ?
        AND item_id = ?
        AND state = 'PENDING'
    )
  )`
		if _, err := dbWrapper.Exec(ctx, reactivateQuery, now, tagID, itemType, itemType, itemID); err != nil {
			if taskProgressTablesMissingCustom(err) {
				return nil
			}
			return fmt.Errorf("reactivating task progress trackers for %s %d: %w", itemType, itemID, err)
		}
	}

	return nil
}

func taskProgressTablesMissingCustom(err error) bool {
	message := err.Error()
	return strings.Contains(message, "no such table: task_progress_trackers") ||
		strings.Contains(message, "no such table: "+taskProgressTrackerEventTableCustom)
}
