package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/jmoiron/sqlx"

	"github.com/stashapp/stash/pkg/models"
)

const taskProgressTrackerTable = "task_progress_trackers"

type taskProgressTrackerRow struct {
	ID          int       `db:"id" goqu:"skipinsert,skipupdate"`
	Title       string    `db:"title"`
	Description string    `db:"description"`
	Goal        int       `db:"goal"`
	TagID       int       `db:"tag_id"`
	Position    int       `db:"position"`
	IsWorkingOn bool      `db:"is_working_on"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
	TagName     string    `db:"tag_name" goqu:"skipinsert,skipupdate"`
}

func (r *taskProgressTrackerRow) fromModel(tracker models.TaskProgressTracker) {
	r.ID = tracker.ID
	r.Title = tracker.Title
	r.Description = tracker.Description
	r.Goal = tracker.Goal
	r.TagID = tracker.TagID
	r.Position = tracker.Position
	r.IsWorkingOn = tracker.IsWorkingOn
	r.CreatedAt = tracker.CreatedAt
	r.UpdatedAt = tracker.UpdatedAt
}

func (r *taskProgressTrackerRow) resolve() *models.TaskProgressTracker {
	return &models.TaskProgressTracker{
		ID:          r.ID,
		Title:       r.Title,
		Description: r.Description,
		Goal:        r.Goal,
		TagID:       r.TagID,
		TagName:     r.TagName,
		Position:    r.Position,
		IsWorkingOn: r.IsWorkingOn,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
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
			table.Col("tag_id"),
			table.Col("position"),
			table.Col("is_working_on"),
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
	query := s.selectDataset().Order(
		s.table().Col("position").Asc(),
		s.table().Col("id").Asc(),
	)
	return s.getMany(ctx, query)
}

func (s *TaskProgressTrackerStore) CountDirectlyTaggedItems(ctx context.Context, tagID int) (int, error) {
	const query = `
SELECT
  (SELECT COUNT(DISTINCT scene_id) FROM scenes_tags WHERE tag_id = ?) +
  (SELECT COUNT(*) FROM scene_markers
    WHERE primary_tag_id = ?
       OR id IN (SELECT scene_marker_id FROM scene_markers_tags WHERE tag_id = ?)) +
  (SELECT COUNT(DISTINCT image_id) FROM images_tags WHERE tag_id = ?) +
  (SELECT COUNT(DISTINCT gallery_id) FROM galleries_tags WHERE tag_id = ?) +
  (SELECT COUNT(DISTINCT performer_id) FROM performers_tags WHERE tag_id = ?) +
  (SELECT COUNT(DISTINCT studio_id) FROM studios_tags WHERE tag_id = ?) +
  (SELECT COUNT(DISTINCT group_id) FROM groups_tags WHERE tag_id = ?)`

	var count int
	if err := dbWrapper.Get(ctx, &count, query, tagID, tagID, tagID, tagID, tagID, tagID, tagID, tagID); err != nil {
		return 0, fmt.Errorf("counting directly tagged task progress items: %w", err)
	}
	return count, nil
}

func (s *TaskProgressTrackerStore) Create(ctx context.Context, tracker *models.TaskProgressTracker) error {
	now := time.Now()
	if tracker.CreatedAt.IsZero() {
		tracker.CreatedAt = now
	}
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

func (s *TaskProgressTrackerStore) Update(ctx context.Context, tracker *models.TaskProgressTracker) error {
	tracker.UpdatedAt = time.Now()
	row := taskProgressTrackerRow{}
	row.fromModel(*tracker)
	if err := s.tableMgr.updateByID(ctx, tracker.ID, row); err != nil {
		return fmt.Errorf("updating task progress tracker: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) Delete(ctx context.Context, id int) error {
	query := dialect.Delete(s.table()).Prepared(true).Where(s.tableMgr.byID(id))
	if _, err := exec(ctx, query); err != nil {
		return fmt.Errorf("deleting task progress tracker: %w", err)
	}
	return nil
}

func (s *TaskProgressTrackerStore) Reorder(ctx context.Context, ids []int) error {
	for position, id := range ids {
		query := dialect.Update(s.table()).Prepared(true).
			Set(goqu.Record{"position": position, "updated_at": time.Now()}).
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
			&row.TagID,
			&row.Position,
			&row.IsWorkingOn,
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
	return trackers, nil
}
