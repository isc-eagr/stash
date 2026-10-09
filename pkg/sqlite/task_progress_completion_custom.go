package sqlite

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

// Complete empty active/paused trackers, including existing trackers at startup.
// FIXED batches use pending members; backlogs use all selected direct tag joins.
func completeTaskProgressTrackersCustom(ctx context.Context, tagID int) error {
	var pending []string
	for _, itemType := range models.TaskProgressItemTypes {
		pending = append(pending, "(instr(',' || item_types || ',', ',"+itemType+",') > 0 AND EXISTS (SELECT 1 FROM ("+taskProgressMembershipSQLCustom(itemType)+") items WHERE items.tag_id = task_progress_trackers.tag_id))")
	}
	query := `UPDATE task_progress_trackers
 SET status = 'COMPLETED', is_working_on = 0, version = version + 1, updated_at = ?
 WHERE status IN ('ACTIVE', 'PAUSED') AND tag_id IS NOT NULL AND (? = 0 OR tag_id = ?)
 AND (
  (mode = 'FIXED' AND NOT EXISTS (
   SELECT 1 FROM task_progress_tracker_members
   WHERE tracker_id = task_progress_trackers.id AND state = 'PENDING'
  )) OR (mode = 'BACKLOG' AND NOT (` + strings.Join(pending, " OR ") + `))
 )`
	if _, err := dbWrapper.Exec(ctx, query, time.Now().UTC(), tagID, tagID); err != nil {
		return fmt.Errorf("completing task progress trackers: %w", err)
	}
	return nil
}
