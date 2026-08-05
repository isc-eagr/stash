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

const sceneNegativeMarkerTable = "scene_negative_markers"

type sceneNegativeMarkerRow struct {
	ID           int       `db:"id" goqu:"skipinsert"`
	SceneID      int       `db:"scene_id"`
	Name         string    `db:"name"`
	StartSeconds float64   `db:"start_seconds"`
	EndSeconds   float64   `db:"end_seconds"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}

func (r *sceneNegativeMarkerRow) fromModel(m models.SceneNegativeMarker) {
	r.ID = m.ID
	r.SceneID = m.SceneID
	r.Name = m.Name
	r.StartSeconds = m.StartSeconds
	r.EndSeconds = m.EndSeconds
	r.CreatedAt = m.CreatedAt
	r.UpdatedAt = m.UpdatedAt
}

func (r *sceneNegativeMarkerRow) resolve() *models.SceneNegativeMarker {
	return &models.SceneNegativeMarker{
		ID:           r.ID,
		SceneID:      r.SceneID,
		Name:         r.Name,
		StartSeconds: r.StartSeconds,
		EndSeconds:   r.EndSeconds,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

type SceneNegativeMarkerStore struct {
	repository
	tableMgr *table
}

func NewSceneNegativeMarkerStore() *SceneNegativeMarkerStore {
	return &SceneNegativeMarkerStore{
		repository: repository{
			tableName: sceneNegativeMarkerTable,
			idColumn:  idColumn,
		},
		tableMgr: &table{
			table:    goqu.T(sceneNegativeMarkerTable),
			idColumn: goqu.T(sceneNegativeMarkerTable).Col(idColumn),
		},
	}
}

func (s *SceneNegativeMarkerStore) table() exp.IdentifierExpression {
	return s.tableMgr.table
}

func (s *SceneNegativeMarkerStore) selectDataset() *goqu.SelectDataset {
	return dialect.From(s.table()).Select(s.table().All())
}

func (s *SceneNegativeMarkerStore) Find(ctx context.Context, id int) (*models.SceneNegativeMarker, error) {
	q := s.selectDataset().Prepared(true).Where(s.tableMgr.byID(id))

	ret, err := s.get(ctx, q)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	return ret, err
}

func (s *SceneNegativeMarkerStore) FindByScene(ctx context.Context, sceneID int) ([]*models.SceneNegativeMarker, error) {
	q := s.selectDataset().Prepared(true).Where(s.table().Col("scene_id").Eq(sceneID)).Order(s.table().Col("start_seconds").Asc())
	return s.getMany(ctx, q)
}

func (s *SceneNegativeMarkerStore) FindNames(ctx context.Context) ([]string, error) {
	const query = `
SELECT TRIM(marker.name) AS name
FROM scene_negative_markers marker
JOIN (
  SELECT MIN(id) AS id
  FROM scene_negative_markers
  WHERE TRIM(name) <> ''
  GROUP BY LOWER(TRIM(name))
) first_marker ON first_marker.id = marker.id
ORDER BY LOWER(TRIM(marker.name)), TRIM(marker.name)`

	rows, err := dbWrapper.Queryx(ctx, query)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	defer rows.Close()

	ret := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scanning negative marker name: %w", err)
		}
		ret = append(ret, name)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return ret, nil
}

func (s *SceneNegativeMarkerStore) Create(ctx context.Context, marker *models.SceneNegativeMarker) error {
	now := time.Now()
	if marker.CreatedAt.IsZero() {
		marker.CreatedAt = now
	}
	marker.UpdatedAt = now

	row := sceneNegativeMarkerRow{}
	row.fromModel(*marker)

	id, err := s.tableMgr.insertID(ctx, row)
	if err != nil {
		return fmt.Errorf("creating negative marker: %w", err)
	}

	updated, err := s.Find(ctx, id)
	if err != nil {
		return fmt.Errorf("finding after insert: %w", err)
	}

	*marker = *updated
	return nil
}

func (s *SceneNegativeMarkerStore) Update(ctx context.Context, marker *models.SceneNegativeMarker) error {
	marker.UpdatedAt = time.Now()

	row := sceneNegativeMarkerRow{}
	row.fromModel(*marker)

	if err := s.tableMgr.updateByID(ctx, marker.ID, row); err != nil {
		return fmt.Errorf("updating negative marker: %w", err)
	}

	return nil
}

func (s *SceneNegativeMarkerStore) Delete(ctx context.Context, id int) error {
	q := dialect.Delete(s.table()).Prepared(true).Where(s.tableMgr.byID(id))

	if _, err := exec(ctx, q); err != nil {
		return fmt.Errorf("deleting negative marker: %w", err)
	}

	return nil
}

func (s *SceneNegativeMarkerStore) get(ctx context.Context, q *goqu.SelectDataset) (*models.SceneNegativeMarker, error) {
	ret, err := s.getMany(ctx, q)
	if err != nil {
		return nil, err
	}

	if len(ret) == 0 {
		return nil, sql.ErrNoRows
	}

	return ret[0], nil
}

func (s *SceneNegativeMarkerStore) getMany(ctx context.Context, q *goqu.SelectDataset) ([]*models.SceneNegativeMarker, error) {
	var ret []*models.SceneNegativeMarker
	const single = false

	if err := queryFunc(ctx, q, single, func(rows *sqlx.Rows) error {
		var row sceneNegativeMarkerRow
		if err := rows.Scan(
			&row.ID,
			&row.SceneID,
			&row.Name,
			&row.StartSeconds,
			&row.EndSeconds,
			&row.CreatedAt,
			&row.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scanning %s: %w", sceneNegativeMarkerTable, err)
		}

		ret = append(ret, row.resolve())
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}
