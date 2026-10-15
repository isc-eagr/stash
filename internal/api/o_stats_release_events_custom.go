package api

// CUSTOM: O Stats events include release O's. Their event ID is the negated
// scene_release_o_dates rowid (see sqlite.SceneOEventsSQLCustom).

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
)

// sceneOEventReleaseRowIDCustom returns the release O rowid an event ID
// encodes, or 0 for a scene O.
func sceneOEventReleaseRowIDCustom(eventID string) int {
	id, err := strconv.Atoi(eventID)
	if err != nil || id >= 0 {
		return 0
	}
	return -id
}

// populateSceneOEventOwnersCustom sets each event's release and screenshot path.
func populateSceneOEventOwnersCustom(ctx context.Context, events []*SceneOEvent) error {
	releaseRowIDs := make([]int, 0)
	for _, event := range events {
		if rowID := sceneOEventReleaseRowIDCustom(event.ID); rowID > 0 {
			releaseRowIDs = append(releaseRowIDs, rowID)
		}
	}
	releaseByRowID := make(map[int]string, len(releaseRowIDs))
	db := manager.GetInstance().Database
	for start := 0; start < len(releaseRowIDs); start += 450 {
		placeholders, args := sceneOEventIDPlaceholders(sceneOEventIDChunk(releaseRowIDs, start, 450))
		_, rows, err := db.QuerySQL(ctx, `SELECT rowid, release_id FROM scene_release_o_dates WHERE rowid IN (`+placeholders+`)`, args)
		if err != nil {
			return err
		}
		for _, row := range rows {
			if len(row) >= 2 {
				releaseByRowID[customIntValue(row[0])] = fmt.Sprint(row[1])
			}
		}
	}

	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	for _, event := range events {
		rowID := sceneOEventReleaseRowIDCustom(event.ID)
		if rowID > 0 {
			if releaseID, ok := releaseByRowID[rowID]; ok {
				event.ReleaseID = &releaseID
			}
		}
		if event.VideoTimestamp == nil {
			continue
		}
		path := fmt.Sprintf("%s/scene/%s/o/%s/screenshot", baseURL, event.SceneID, event.ID)
		if event.ReleaseID != nil {
			path = fmt.Sprintf("%s/scene-release/%s/o/%d/screenshot", baseURL, *event.ReleaseID, rowID)
		}
		event.ScreenshotPath = &path
	}
	return nil
}
