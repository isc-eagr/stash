package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/models"
)

const (
	performerImagesTable = "performer_images"
)

type performerImageRow struct {
	ID          int    `db:"id" goqu:"skipinsert"`
	PerformerID int    `db:"performer_id"`
	ImageBlob   string `db:"image_blob"`
	Position    int    `db:"position"`
}

func (r *performerImageRow) resolve() *models.PerformerImage {
	ret := &models.PerformerImage{
		ID:          r.ID,
		PerformerID: r.PerformerID,
		ImageBlob:   r.ImageBlob,
		Position:    r.Position,
	}
	return ret
}

type PerformerImageStore struct {
	blobJoinQueryBuilder
}

func NewPerformerImageStore(blobStore *BlobStore) *PerformerImageStore {
	return &PerformerImageStore{
		blobJoinQueryBuilder: blobJoinQueryBuilder{
			blobStore: blobStore,
		},
	}
}

func (qb *PerformerImageStore) table() exp.IdentifierExpression {
	return goqu.I(performerImagesTable)
}

func (qb *PerformerImageStore) selectDataset() *goqu.SelectDataset {
	return dialect.From(qb.table()).Select(qb.table().All())
}

func (qb *PerformerImageStore) get(ctx context.Context, q *goqu.SelectDataset) (*models.PerformerImage, error) {
	ret, err := qb.getMany(ctx, q)
	if err != nil {
		return nil, err
	}

	if len(ret) == 0 {
		return nil, sql.ErrNoRows
	}

	return ret[0], nil
}

func (qb *PerformerImageStore) getMany(ctx context.Context, q *goqu.SelectDataset) ([]*models.PerformerImage, error) {
	const single = false
	var ret []*models.PerformerImage
	if err := queryFunc(ctx, q, single, func(rows *sqlx.Rows) error {
		var f performerImageRow
		if err := rows.StructScan(&f); err != nil {
			return err
		}

		ret = append(ret, f.resolve())

		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (qb *PerformerImageStore) Get(ctx context.Context, id int) (*models.PerformerImage, error) {
	q := qb.selectDataset().Where(qb.table().Col("id").Eq(id))
	return qb.get(ctx, q)
}

func (qb *PerformerImageStore) GetByPerformerID(ctx context.Context, performerID int) ([]*models.PerformerImage, error) {
	q := qb.selectDataset().Where(
		qb.table().Col("performer_id").Eq(performerID),
	).Order(qb.table().Col("position").Asc())
	return qb.getMany(ctx, q)
}

func (qb *PerformerImageStore) Create(ctx context.Context, performerID int, imageBlob string) (*models.PerformerImage, error) {
	// Get the next position for this performer
	posQuery := dialect.From(qb.table()).
		Select(goqu.L("COALESCE(MAX(position), 0) + 1")).
		Where(goqu.C("performer_id").Eq(performerID))

	var position int
	if err := querySimple(ctx, posQuery, &position); err != nil {
		return nil, fmt.Errorf("getting next position: %w", err)
	}

	ret := &models.PerformerImage{
		PerformerID: performerID,
		ImageBlob:   imageBlob,
		Position:    position,
	}

	row := performerImageRow{
		PerformerID: ret.PerformerID,
		ImageBlob:   ret.ImageBlob,
		Position:    ret.Position,
	}

	q := dialect.Insert(qb.table()).Rows(row)
	result, err := exec(ctx, q)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	ret.ID = int(id)
	return ret, nil
}

func (qb *PerformerImageStore) Destroy(ctx context.Context, id int) error {
	q := dialect.Delete(qb.table()).Where(qb.table().Col("id").Eq(id))
	_, err := exec(ctx, q)
	return err
}

func (qb *PerformerImageStore) UpdateBlob(ctx context.Context, id int, imageBlob string) error {
	q := dialect.Update(qb.table()).Set(goqu.Record{"image_blob": imageBlob}).Where(qb.table().Col("id").Eq(id))
	_, err := exec(ctx, q)
	return err
}
