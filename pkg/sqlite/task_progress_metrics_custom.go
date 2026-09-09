package sqlite

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

// All SQL identifiers are selected from this closed list, never from user input.
func taskProgressMembershipSQLCustom(itemType string) string {
	if itemType == "scene_marker" {
		return "SELECT primary_tag_id AS tag_id, id AS item_id FROM scene_markers UNION SELECT tag_id, scene_marker_id AS item_id FROM scene_markers_tags"
	}
	joins := map[string]string{"scene": "scenes_tags", "image": "images_tags", "gallery": "galleries_tags", "performer": "performers_tags", "studio": "studios_tags", "group": "groups_tags"}
	table, ok := joins[itemType]
	if !ok {
		return "SELECT 0 AS tag_id, 0 AS item_id WHERE 0"
	}
	return "SELECT DISTINCT tag_id, " + itemType + "_id AS item_id FROM " + table
}

// The number of count queries depends on supported entity types, not tracker count.
func loadTaskProgressMetricsCustom(ctx context.Context, trackers []*models.TaskProgressTracker) error {
	if len(trackers) == 0 {
		return nil
	}
	byID := make(map[int]*models.TaskProgressTracker)
	ids := make([]int, 0, len(trackers))
	tagIDs := make([]int, 0, len(trackers))
	seenTags := make(map[int]bool)
	for _, t := range trackers {
		byID[t.ID] = t
		ids = append(ids, t.ID)
		if !seenTags[t.TagID] {
			tagIDs = append(tagIDs, t.TagID)
			seenTags[t.TagID] = true
		}
		t.CurrentCount = 0
		t.CompletedCount = 0
		t.IncomingCount = 0
		t.ItemCounts = []*models.TaskProgressItemCount{}
		t.History = []*models.TaskProgressDay{}
	}
	counts := map[int]map[string]int{}
	for _, typ := range models.TaskProgressItemTypes {
		q := "SELECT tag_id, COUNT(*) FROM (" + taskProgressMembershipSQLCustom(typ) + ") WHERE tag_id IN " + getInBinding(len(tagIDs)) + " GROUP BY tag_id"
		args := make([]interface{}, len(tagIDs))
		for i, id := range tagIDs {
			args[i] = id
		}
		rows, err := dbWrapper.QueryxContext(ctx, q, args...)
		if err != nil {
			return err
		}
		for rows.Next() {
			var id, n int
			if err := rows.Scan(&id, &n); err != nil {
				rows.Close()
				return err
			}
			if counts[id] == nil {
				counts[id] = map[string]int{}
			}
			counts[id][typ] = n
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
	}
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	fixed := map[int]map[string]int{}
	rows, err := dbWrapper.QueryxContext(ctx, "SELECT tracker_id,item_type,COUNT(*) FROM task_progress_tracker_members WHERE state='PENDING' AND tracker_id IN "+getInBinding(len(ids))+" GROUP BY tracker_id,item_type", args...)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, n int
		var typ string
		if err := rows.Scan(&id, &typ, &n); err != nil {
			rows.Close()
			return err
		}
		if fixed[id] == nil {
			fixed[id] = map[string]int{}
		}
		fixed[id][typ] = n
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, t := range trackers {
		for _, typ := range t.ItemTypes {
			n := counts[t.TagID][typ]
			if t.Mode == "FIXED" {
				n = fixed[t.ID][typ]
			}
			t.CurrentCount += n
			t.ItemCounts = append(t.ItemCounts, &models.TaskProgressItemCount{ItemType: typ, Count: n})
		}
	}
	// Aggregate events in SQLite; only one row per tracker/day crosses into Go.
	q := `WITH daily AS (
 SELECT tracker_id,occurred_on,
 SUM(event_type='COMPLETED') AS completed, SUM(event_type='INCOMING') AS incoming,
 MAX(CASE WHEN event_type='BASELINE' THEN id END) AS baseline_id
 FROM task_progress_tracker_events WHERE tracker_id IN ` + getInBinding(len(ids)) + `
 GROUP BY tracker_id,occurred_on
)
SELECT d.tracker_id,d.occurred_on,d.completed,d.incoming,b.baseline_count,
CASE WHEN d.baseline_id IS NULL THEN d.incoming-d.completed ELSE
 COALESCE((SELECT SUM(CASE e.event_type WHEN 'INCOMING' THEN 1 WHEN 'COMPLETED' THEN -1 ELSE 0 END)
 FROM task_progress_tracker_events e WHERE e.tracker_id=d.tracker_id AND e.occurred_on=d.occurred_on AND e.id>d.baseline_id),0) END
FROM daily d LEFT JOIN task_progress_tracker_events b ON b.id=d.baseline_id
ORDER BY d.tracker_id,d.occurred_on`
	rows, err = dbWrapper.QueryxContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("loading task progress daily history: %w", err)
	}
	defer rows.Close()
	remaining := map[int]int{}
	for rows.Next() {
		var id, delta int
		d := &models.TaskProgressDay{}
		if err := rows.Scan(&id, &d.Date, &d.Completed, &d.Incoming, &d.BaselineCount, &delta); err != nil {
			return err
		}
		t := byID[id]
		if t == nil {
			continue
		}
		if d.BaselineCount != nil {
			remaining[id] = *d.BaselineCount
		}
		remaining[id] += delta
		if remaining[id] < 0 {
			remaining[id] = 0
		}
		d.Remaining = remaining[id]
		t.CompletedCount += d.Completed
		t.IncomingCount += d.Incoming
		t.History = append(t.History, d)
	}
	return rows.Err()
}

func (s *TaskProgressTrackerStore) Events(ctx context.Context, trackerID int, date string, afterID int) (*models.TaskProgressEventPage, error) {
	const limit = 100
	q := `SELECT id,event_type,COALESCE(item_type,''),COALESCE(item_id,0),item_label,occurred_on,occurred_at
FROM task_progress_tracker_events WHERE tracker_id=? AND occurred_on=? AND id>? ORDER BY id LIMIT 101`
	rows, err := dbWrapper.QueryxContext(ctx, q, trackerID, date, afterID)
	if err != nil {
		return nil, err
	}
	ret := &models.TaskProgressEventPage{Events: []*models.TaskProgressEvent{}}
	for rows.Next() {
		e := &models.TaskProgressEvent{}
		if err := rows.Scan(&e.ID, &e.EventType, &e.ItemType, &e.ItemID, &e.ItemLabel, &e.OccurredOn, &e.OccurredAt); err != nil {
			rows.Close()
			return nil, err
		}
		ret.Events = append(ret.Events, e)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	if len(ret.Events) > limit {
		ret.HasMore = true
		ret.Events = ret.Events[:limit]
	}
	for _, e := range ret.Events {
		url, err := taskProgressEventURLCustom(ctx, e)
		if err != nil {
			return nil, err
		}
		e.URL = url
	}
	return ret, nil
}

func taskProgressEventURLCustom(ctx context.Context, e *models.TaskProgressEvent) (string, error) {
	if e.ItemID == 0 {
		return "", nil
	}
	tables := map[string]string{"scene": "scenes", "image": "images", "gallery": "galleries", "performer": "performers", "studio": "studios", "group": "groups", "scene_marker": "scene_markers"}
	table, ok := tables[e.ItemType]
	if !ok {
		return "", nil
	}
	var exists bool
	if err := dbWrapper.Get(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM "+table+" WHERE id=?)", e.ItemID); err != nil {
		return "", err
	}
	if !exists {
		return "", nil
	}
	if e.ItemType == "scene_marker" {
		var sceneID int
		var seconds float64
		rows, err := dbWrapper.QueryxContext(ctx, "SELECT scene_id,seconds FROM scene_markers WHERE id=?", e.ItemID)
		if err != nil {
			return "", err
		}
		defer rows.Close()
		if rows.Next() {
			if err := rows.Scan(&sceneID, &seconds); err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("/scenes/%d?t=%s", sceneID, strconv.FormatFloat(seconds, 'f', -1, 64)), rows.Err()
	}
	return fmt.Sprintf("/%s/%d", table, e.ItemID), nil
}

func (s *TaskProgressTrackerStore) PendingItems(ctx context.Context, trackerID int, itemType string, offset int) (*models.TaskProgressEventPage, error) {
	ids := []int{}
	err := dbWrapper.Select(ctx, &ids, `SELECT item_id FROM task_progress_tracker_members WHERE tracker_id=? AND item_type=? AND state='PENDING' ORDER BY item_id LIMIT 51 OFFSET ?`, trackerID, itemType, offset)
	if err != nil {
		return nil, err
	}
	ret := &models.TaskProgressEventPage{Events: []*models.TaskProgressEvent{}, HasMore: len(ids) > 50}
	if ret.HasMore {
		ids = ids[:50]
	}
	for _, id := range ids {
		e := &models.TaskProgressEvent{ID: id, ItemID: id, ItemType: itemType}
		e.ItemLabel, err = taskProgressItemLabelCustom(ctx, itemType, id)
		if err != nil {
			return nil, err
		}
		e.URL, err = taskProgressEventURLCustom(ctx, e)
		if err != nil {
			return nil, err
		}
		ret.Events = append(ret.Events, e)
	}
	return ret, nil
}
