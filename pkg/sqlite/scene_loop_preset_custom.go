package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/jmoiron/sqlx"

	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
)

const sceneLoopPresetTable = "scene_multi_segment_loop_presets"

type sceneLoopPresetRow struct {
	ID                  int       `db:"id" goqu:"skipinsert"`
	SceneID             int       `db:"scene_id"`
	Name                string    `db:"name"`
	Segments            string    `db:"segments"`
	Enabled             bool      `db:"enabled"`
	CurrentSegmentIndex int       `db:"current_segment_index"`
	CreatedAt           time.Time `db:"created_at"`
	UpdatedAt           time.Time `db:"updated_at"`
}

func (r *sceneLoopPresetRow) fromModel(p models.SceneLoopPreset) {
	r.ID = p.ID
	r.SceneID = p.SceneID
	r.Name = p.Name
	r.Enabled = p.Enabled
	r.CurrentSegmentIndex = p.CurrentSegmentIndex
	r.CreatedAt = p.CreatedAt
	r.UpdatedAt = p.UpdatedAt

	if len(p.Segments) > 0 {
		encoded, err := json.Marshal(p.Segments)
		if err != nil {
			logger.Errorf("error encoding scene loop segments: %v", err)
		} else {
			r.Segments = string(encoded)
		}
	}
}

func (r *sceneLoopPresetRow) resolve() *models.SceneLoopPreset {
	ret := &models.SceneLoopPreset{
		ID:                  r.ID,
		SceneID:             r.SceneID,
		Name:                r.Name,
		Enabled:             r.Enabled,
		CurrentSegmentIndex: r.CurrentSegmentIndex,
		CreatedAt:           r.CreatedAt,
		UpdatedAt:           r.UpdatedAt,
	}

	if r.Segments != "" {
		var segments []models.SceneLoopSegment
		if err := json.Unmarshal([]byte(r.Segments), &segments); err != nil {
			logger.Errorf("error decoding scene loop segments: %v", err)
		} else {
			ret.Segments = segments
		}
	}

	return ret
}

type SceneLoopPresetStore struct {
	repository
	tableMgr *table
}

func NewSceneLoopPresetStore() *SceneLoopPresetStore {
	return &SceneLoopPresetStore{
		repository: repository{
			tableName: sceneLoopPresetTable,
			idColumn:  idColumn,
		},
		tableMgr: &table{
			table:    goqu.T(sceneLoopPresetTable),
			idColumn: goqu.T(sceneLoopPresetTable).Col(idColumn),
		},
	}
}

func (s *SceneLoopPresetStore) table() exp.IdentifierExpression {
	return s.tableMgr.table
}

func (s *SceneLoopPresetStore) selectDataset() *goqu.SelectDataset {
	return dialect.From(s.table()).Select(s.table().All())
}

func (s *SceneLoopPresetStore) FindByScene(ctx context.Context, sceneID int) ([]*models.SceneLoopPreset, error) {
	q := s.selectDataset().Prepared(true).Where(s.table().Col("scene_id").Eq(sceneID)).Order(s.table().Col("name").Asc())
	return s.getMany(ctx, q)
}

func (s *SceneLoopPresetStore) FindBySceneAndName(ctx context.Context, sceneID int, name string) (*models.SceneLoopPreset, error) {
	q := s.selectDataset().Prepared(true).Where(
		s.table().Col("scene_id").Eq(sceneID),
		s.table().Col("name").Eq(name),
	)

	ret, err := s.get(ctx, q)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	return ret, err
}

func (s *SceneLoopPresetStore) find(ctx context.Context, id int) (*models.SceneLoopPreset, error) {
	q := s.selectDataset().Prepared(true).Where(s.tableMgr.byID(id))

	ret, err := s.get(ctx, q)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	return ret, err
}

func (s *SceneLoopPresetStore) Upsert(ctx context.Context, preset *models.SceneLoopPreset) error {
	now := time.Now()
	if preset.CreatedAt.IsZero() {
		preset.CreatedAt = now
	}
	preset.UpdatedAt = now

	existing, err := s.FindBySceneAndName(ctx, preset.SceneID, preset.Name)
	if err != nil {
		return err
	}

	row := sceneLoopPresetRow{}
	row.fromModel(*preset)

	if existing != nil {
		preset.ID = existing.ID
		row.ID = existing.ID
		row.CreatedAt = existing.CreatedAt

		if err := s.tableMgr.updateByID(ctx, existing.ID, row); err != nil {
			return err
		}

		return nil
	}

	id, err := s.tableMgr.insertID(ctx, row)
	if err != nil {
		return err
	}

	updated, err := s.find(ctx, id)
	if err != nil {
		return fmt.Errorf("finding after insert: %w", err)
	}

	*preset = *updated
	return nil
}

func (s *SceneLoopPresetStore) DeleteBySceneAndName(ctx context.Context, sceneID int, name string) error {
	q := dialect.Delete(s.table()).Prepared(true).Where(
		s.table().Col("scene_id").Eq(sceneID),
		s.table().Col("name").Eq(name),
	)

	if _, err := exec(ctx, q); err != nil {
		return fmt.Errorf("deleting scene loop preset: %w", err)
	}

	return nil
}

func (s *SceneLoopPresetStore) get(ctx context.Context, q *goqu.SelectDataset) (*models.SceneLoopPreset, error) {
	ret, err := s.getMany(ctx, q)
	if err != nil {
		return nil, err
	}

	if len(ret) == 0 {
		return nil, sql.ErrNoRows
	}

	return ret[0], nil
}

func (s *SceneLoopPresetStore) getMany(ctx context.Context, q *goqu.SelectDataset) ([]*models.SceneLoopPreset, error) {
	var ret []*models.SceneLoopPreset
	const single = false

	if err := queryFunc(ctx, q, single, func(rows *sqlx.Rows) error {
		var row sceneLoopPresetRow
		if err := rows.Scan(
			&row.ID,
			&row.SceneID,
			&row.Name,
			&row.Segments,
			&row.Enabled,
			&row.CurrentSegmentIndex,
			&row.CreatedAt,
			&row.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scanning %s: %w", sceneLoopPresetTable, err)
		}

		ret = append(ret, row.resolve())
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}
