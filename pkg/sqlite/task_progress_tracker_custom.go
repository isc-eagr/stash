package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/jmoiron/sqlx"

	"github.com/stashapp/stash/pkg/models"
)

const taskProgressTrackerTable = "task_progress_trackers"

type taskProgressTrackerRow struct {
	ID               int       `db:"id" goqu:"skipinsert,skipupdate"`
	Title            string    `db:"title"`
	Description      string    `db:"description"`
	Goal             int       `db:"goal"`
	GoalPerDay       *int      `db:"goal_per_day"`
	TagID            int       `db:"tag_id"`
	Position         int       `db:"position"`
	IsWorkingOn      bool      `db:"is_working_on"`
	StartedOn        string    `db:"started_on"`
	Status           string    `db:"status"`
	Mode             string    `db:"mode"`
	Version          int       `db:"version"`
	HistoryStartedOn string    `db:"history_started_on"`
	ItemTypes        string    `db:"item_types"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
	TagName          string    `db:"tag_name" goqu:"skipinsert,skipupdate"`
}

func (r *taskProgressTrackerRow) fromModel(tracker models.TaskProgressTracker) {
	r.ID = tracker.ID
	r.Title = tracker.Title
	r.Description = tracker.Description
	r.Goal = tracker.Goal
	r.GoalPerDay = tracker.GoalPerDay
	r.TagID = tracker.TagID
	r.Position = tracker.Position
	r.IsWorkingOn = tracker.IsWorkingOn
	r.StartedOn = tracker.StartedOn
	r.Status = tracker.Status
	r.Mode, r.Version, r.HistoryStartedOn = tracker.Mode, tracker.Version, tracker.HistoryStartedOn
	r.ItemTypes = strings.Join(tracker.ItemTypes, ",")
	r.CreatedAt = tracker.CreatedAt
	r.UpdatedAt = tracker.UpdatedAt
}

func (r *taskProgressTrackerRow) resolve() *models.TaskProgressTracker {
	return &models.TaskProgressTracker{
		ID:          r.ID,
		Title:       r.Title,
		Description: r.Description,
		Goal:        r.Goal,
		GoalPerDay:  r.GoalPerDay,
		TagID:       r.TagID,
		TagName:     r.TagName,
		Position:    r.Position,
		IsWorkingOn: r.IsWorkingOn,
		StartedOn:   r.StartedOn,
		Status:      r.Status,
		Mode:        r.Mode, Version: r.Version, HistoryStartedOn: r.HistoryStartedOn,
		ItemTypes: taskProgressItemTypesCustom(r.ItemTypes),
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
}

type TaskProgressTrackerStore struct {
	repository
	tableMgr *table
}

func NewTaskProgressTrackerStore() *TaskProgressTrackerStore {
	return &TaskProgressTrackerStore{
		repository: repository{
			tableName: taskProgressTrackerTable,
			idColumn:  idColumn,
		},
		tableMgr: &table{
			table:    goqu.T(taskProgressTrackerTable),
			idColumn: goqu.T(taskProgressTrackerTable).Col(idColumn),
		},
	}
}

func (s *TaskProgressTrackerStore) table() exp.IdentifierExpression {
	return s.tableMgr.table
}

func (s *TaskProgressTrackerStore) selectDataset() *goqu.SelectDataset {
	table := s.table()
	tags := goqu.T(tagTable)
	return dialect.From(table).
		InnerJoin(tags, goqu.On(tags.Col(idColumn).Eq(table.Col("tag_id")))).
		Select(
			table.Col("id"),
			table.Col("title"),
			table.Col("description"),
			table.Col("goal"),
			table.Col("goal_per_day"),
			table.Col("tag_id"),
			table.Col("position"),
			table.Col("is_working_on"),
			table.Col("started_on"),
			table.Col("status"),
			table.Col("mode"), table.Col("version"), table.Col("history_started_on"),
			table.Col("item_types"),
			table.Col("created_at"),
			table.Col("updated_at"),
			tags.Col("name"),
		)
}

func (s *TaskProgressTrackerStore) Find(ctx context.Context, id int) (*models.TaskProgressTracker, error) {
	query := s.selectDataset().Prepared(true).Where(s.tableMgr.byID(id))
	tracker, err := s.get(ctx, query)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return tracker, err
}

func (s *TaskProgressTrackerStore) FindAll(ctx context.Context) ([]*models.TaskProgressTracker, error) {
	query := s.selectDataset().Where(s.table().Col("status").Neq("DELETED")).Order(
		s.table().Col("position").Asc(),
		s.table().Col("id").Asc(),
	)
	return s.getMany(ctx, query)
}

func (s *TaskProgressTrackerStore) CountDirectlyTaggedItems(ctx context.Context, tagID int, itemTypes []string) (int, error) {
	counts, err := taskProgressCountsForTagCustom(ctx, tagID)
	if err != nil {
		return 0, err
	}

	var count int
	for _, itemType := range taskProgressItemTypesCustom(strings.Join(itemTypes, ",")) {
		count += counts[itemType]
	}
	return count, nil
}

func (s *TaskProgressTrackerStore) Create(ctx context.Context, tracker *models.TaskProgressTracker) error {
	now := time.Now()
	if tracker.CreatedAt.IsZero() {
		tracker.CreatedAt = now
	}
	if tracker.StartedOn == "" {
		tracker.StartedOn = models.TaskProgressReportingDate(now)
	}
	if tracker.Status == "" {
		tracker.Status = models.TaskProgressTrackerStatusActive
	}
	if tracker.Mode == "" {
		tracker.Mode = "BACKLOG"
	}
	tracker.Version = 1
	if tracker.HistoryStartedOn == "" {
		tracker.HistoryStartedOn = models.TaskProgressReportingDate(now)
	}
	tracker.ItemTypes = taskProgressItemTypesCustom(strings.Join(tracker.ItemTypes, ","))
	tracker.UpdatedAt = now

	if tracker.Position < 0 {
		tracker.Position = 0
	}
	if tracker.Position == 0 {
		query := dialect.From(s.table()).Select(goqu.L("COALESCE(MAX(position), -1) + 1"))
		if err := querySimple(ctx, query, &tracker.Position); err != nil {
			return fmt.Errorf("finding next task progress tracker position: %w", err)
		}
	}

	row := taskProgressTrackerRow{}
	row.fromModel(*tracker)
	id, err := s.tableMgr.insertID(ctx, row)
	if err != nil {
		return fmt.Errorf("creating task progress tracker: %w", err)
	}

	created, err := s.Find(ctx, id)
	if err != nil {
		return fmt.Errorf("finding task progress tracker after insert: %w", err)
	}
	*tracker = *created
	return nil
}

func (s *TaskProgressTrackerStore) CreateBaseline(ctx context.Context, tracker *models.TaskProgressTracker) error {
	if _, err := dbWrapper.Exec(ctx, "DELETE FROM task_progress_tracker_members WHERE tracker_id = ?", tracker.ID); err != nil {
		return err
	}
	if tracker.Mode == "FIXED" {
		for _, itemType := range tracker.ItemTypes {
			query := taskProgressMembershipSQLCustom(itemType)
			if _, err := dbWrapper.Exec(ctx, "INSERT INTO task_progress_tracker_members(tracker_id,item_type,item_id,state) SELECT ?, ?, item_id, 'PENDING' FROM ("+query+") WHERE tag_id = ?", tracker.ID, itemType, tracker.TagID); err != nil {
				return err
			}
		}
	}
	const query = `
INSERT INTO task_progress_tracker_events
  (tracker_id, event_type, occurred_on, occurred_at, baseline_count, tag_id)
VALUES (?, ?, ?, ?, ?, ?)`
	// An imported legacy tracker starts at the agreed history epoch; subsequent
	// baseline resets always use the day the reset actually happened.
	day := models.TaskProgressReportingDate(time.Now())
	var hasHistory bool
	if err := dbWrapper.Get(ctx, &hasHistory, "SELECT EXISTS(SELECT 1 FROM task_progress_tracker_events WHERE tracker_id = ?)", tracker.ID); err != nil {
		return err
	}
	if !hasHistory && tracker.HistoryStartedOn != "" {
		day = tracker.HistoryStartedOn
	}
	if _, err := dbWrapper.Exec(ctx, query, tracker.ID, models.TaskProgressEventBaseline, day, time.Now().UTC(), tracker.Goal, tracker.TagID); err != nil {
		return fmt.Errorf("creating task progress tracker baseline: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) Update(ctx context.Context, tracker *models.TaskProgressTracker) error {
	tracker.Version++
	tracker.UpdatedAt = time.Now()
	row := taskProgressTrackerRow{}
	row.fromModel(*tracker)
	if err := s.tableMgr.updateByID(ctx, tracker.ID, row); err != nil {
		return fmt.Errorf("updating task progress tracker: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) Delete(ctx context.Context, id int) error {
	query := dialect.Update(s.table()).Prepared(true).Set(goqu.Record{"status": "DELETED", "is_working_on": false, "version": goqu.L("version + 1"), "updated_at": time.Now()}).Where(s.tableMgr.byID(id))
	if _, err := exec(ctx, query); err != nil {
		return fmt.Errorf("deleting task progress tracker: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) Reorder(ctx context.Context, ids []int) error {
	for position, id := range ids {
		query := dialect.Update(s.table()).Prepared(true).
			Set(goqu.Record{"position": position, "version": goqu.L("version + 1"), "updated_at": time.Now()}).
			Where(s.tableMgr.byID(id))
		if _, err := exec(ctx, query); err != nil {
			return fmt.Errorf("reordering task progress tracker %d: %w", id, err)
		}
	}
	return nil
}

func (s *TaskProgressTrackerStore) get(ctx context.Context, query *goqu.SelectDataset) (*models.TaskProgressTracker, error) {
	trackers, err := s.getMany(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(trackers) == 0 {
		return nil, sql.ErrNoRows
	}
	return trackers[0], nil
}

func (s *TaskProgressTrackerStore) getMany(ctx context.Context, query *goqu.SelectDataset) ([]*models.TaskProgressTracker, error) {
	var trackers []*models.TaskProgressTracker
	if err := queryFunc(ctx, query, false, func(rows *sqlx.Rows) error {
		var row taskProgressTrackerRow
		if err := rows.Scan(
			&row.ID,
			&row.Title,
			&row.Description,
			&row.Goal,
			&row.GoalPerDay,
			&row.TagID,
			&row.Position,
			&row.IsWorkingOn,
			&row.StartedOn,
			&row.Status,
			&row.Mode, &row.Version, &row.HistoryStartedOn,
			&row.ItemTypes,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.TagName,
		); err != nil {
			return fmt.Errorf("scanning %s: %w", taskProgressTrackerTable, err)
		}
		trackers = append(trackers, row.resolve())
		return nil
	}); err != nil {
		return nil, err
	}
	if err := loadTaskProgressMetricsCustom(ctx, trackers); err != nil {
		return nil, err
	}
	return trackers, nil
}

func taskProgressItemTypesCustom(value string) []string {
	allowed := make(map[string]struct{}, len(models.TaskProgressItemTypes))
	for _, itemType := range models.TaskProgressItemTypes {
		allowed[itemType] = struct{}{}
	}

	seen := make(map[string]struct{})
	for _, itemType := range strings.Split(value, ",") {
		itemType = strings.TrimSpace(itemType)
		if _, ok := allowed[itemType]; ok {
			seen[itemType] = struct{}{}
		}
	}
	if len(seen) == 0 {
		return append([]string(nil), models.TaskProgressItemTypes...)
	}

	ret := make([]string, 0, len(seen))
	for _, itemType := range models.TaskProgressItemTypes {
		if _, ok := seen[itemType]; ok {
			ret = append(ret, itemType)
		}
	}
	return ret
}

func taskProgressCountsForTagCustom(ctx context.Context, tagID int) (map[string]int, error) {
	queries := map[string]string{
		"scene": "SELECT COUNT(DISTINCT scene_id) FROM scenes_tags WHERE tag_id = ?",
		"scene_marker": `SELECT COUNT(*) FROM scene_markers WHERE primary_tag_id = ?
OR id IN (SELECT scene_marker_id FROM scene_markers_tags WHERE tag_id = ?)`,
		"image":     "SELECT COUNT(DISTINCT image_id) FROM images_tags WHERE tag_id = ?",
		"gallery":   "SELECT COUNT(DISTINCT gallery_id) FROM galleries_tags WHERE tag_id = ?",
		"performer": "SELECT COUNT(DISTINCT performer_id) FROM performers_tags WHERE tag_id = ?",
		"studio":    "SELECT COUNT(DISTINCT studio_id) FROM studios_tags WHERE tag_id = ?",
		"group":     "SELECT COUNT(DISTINCT group_id) FROM groups_tags WHERE tag_id = ?",
	}

	ret := make(map[string]int, len(queries))
	for itemType, query := range queries {
		args := []interface{}{tagID}
		if itemType == "scene_marker" {
			args = append(args, tagID)
		}
		var count int
		if err := dbWrapper.Get(ctx, &count, query, args...); err != nil {
			return nil, fmt.Errorf("counting directly tagged %s task progress items: %w", itemType, err)
		}
		ret[itemType] = count
	}
	return ret, nil
}
