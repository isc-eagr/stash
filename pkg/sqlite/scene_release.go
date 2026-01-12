package sqlite

import (
	"context"
	"errors"
	"slices"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/jmoiron/sqlx"
	"gopkg.in/guregu/null.v4"
	"gopkg.in/guregu/null.v4/zero"

	"github.com/stashapp/stash/pkg/models"
)

const (
	sceneReleaseTable           = "scene_releases"
	sceneReleaseIDColumn        = "release_id"
	sceneReleaseFilesTable      = "scene_release_files"
	sceneReleaseGalleriesTable  = "scene_release_galleries"
	sceneReleaseCoverBlobColumn = "cover_blob"
)

var (
	sceneReleaseTableMgr = &table{
		table:    goqu.T(sceneReleaseTable),
		idColumn: goqu.T(sceneReleaseTable).Col(idColumn),
	}

	sceneReleaseFilesJoinTable     = goqu.T(sceneReleaseFilesTable)
	sceneReleaseGalleriesJoinTable = goqu.T(sceneReleaseGalleriesTable)

	sceneReleaseFilesTableMgr = &relatedFilesTable{
		table: table{
			table:    sceneReleaseFilesJoinTable,
			idColumn: sceneReleaseFilesJoinTable.Col(sceneReleaseIDColumn),
		},
	}

	sceneReleaseGalleriesTableMgr = &joinTable{
		table: table{
			table:    sceneReleaseGalleriesJoinTable,
			idColumn: sceneReleaseGalleriesJoinTable.Col(sceneReleaseIDColumn),
		},
		fkColumn: sceneReleaseGalleriesJoinTable.Col(galleryIDColumn),
	}
)

type sceneReleaseRow struct {
	ID            int         `db:"id" goqu:"skipinsert"`
	SceneID       int         `db:"scene_id"`
	Title         zero.String `db:"title"`
	Code          zero.String `db:"code"`
	Details       zero.String `db:"details"`
	Director      zero.String `db:"director"`
	URL           zero.String `db:"url"`
	Date          NullDate    `db:"date"`
	DatePrecision null.Int    `db:"date_precision"`
	StudioID      null.Int    `db:"studio_id,omitempty"`
	PlayOrder     int         `db:"play_order"`
	CreatedAt     Timestamp   `db:"created_at"`
	UpdatedAt     Timestamp   `db:"updated_at"`

	// not used in resolutions or updates
	CoverBlob zero.String `db:"cover_blob"`
}

func (r *sceneReleaseRow) fromSceneRelease(o models.SceneRelease) {
	r.ID = o.ID
	r.SceneID = o.SceneID
	r.Title = zero.StringFrom(o.Title)
	r.Code = zero.StringFrom(o.Code)
	r.Details = zero.StringFrom(o.Details)
	r.Director = zero.StringFrom(o.Director)
	r.URL = zero.StringFrom(o.URL)
	r.Date = NullDateFromDatePtr(o.Date)
	r.DatePrecision = datePrecisionFromDatePtr(o.Date)
	r.StudioID = intFromPtr(o.StudioID)
	r.PlayOrder = o.PlayOrder
	r.CreatedAt = Timestamp{Timestamp: o.CreatedAt}
	r.UpdatedAt = Timestamp{Timestamp: o.UpdatedAt}
}

type sceneReleaseQueryRow struct {
	sceneReleaseRow
	PrimaryFileID         null.Int    `db:"primary_file_id"`
	PrimaryFileFolderPath zero.String `db:"primary_file_folder_path"`
	PrimaryFileBasename   zero.String `db:"primary_file_basename"`
}

func (r *sceneReleaseQueryRow) resolve() *models.SceneRelease {
	ret := &models.SceneRelease{
		ID:        r.ID,
		SceneID:   r.SceneID,
		Title:     r.Title.String,
		Code:      r.Code.String,
		Details:   r.Details.String,
		Director:  r.Director.String,
		URL:       r.URL.String,
		Date:      r.Date.DatePtr(r.DatePrecision),
		StudioID:  nullIntPtr(r.StudioID),
		PlayOrder: r.PlayOrder,

		PrimaryFileID: nullIntFileIDPtr(r.PrimaryFileID),

		CreatedAt: r.CreatedAt.Timestamp,
		UpdatedAt: r.UpdatedAt.Timestamp,
	}

	return ret
}

type sceneReleaseRowRecord struct {
	updateRecord
}

func (r *sceneReleaseRowRecord) fromPartial(o models.SceneReleasePartial) {
	r.setNullString("title", o.Title)
	r.setNullString("code", o.Code)
	r.setNullString("details", o.Details)
	r.setNullString("director", o.Director)
	r.setNullString("url", o.URL)
	r.setNullDate("date", "date_precision", o.Date)
	r.setNullInt("studio_id", o.StudioID)
	r.setNullInt("play_order", o.PlayOrder)
	r.setTimestamp("created_at", o.CreatedAt)
	r.setTimestamp("updated_at", o.UpdatedAt)
}

type SceneReleaseStore struct {
	blobJoinQueryBuilder

	tableMgr *table
	repo     *storeRepository
}

func NewSceneReleaseStore(r *storeRepository, blobStore *BlobStore) *SceneReleaseStore {
	return &SceneReleaseStore{
		blobJoinQueryBuilder: blobJoinQueryBuilder{
			blobStore: blobStore,
			joinTable: sceneReleaseTable,
		},
		tableMgr: sceneReleaseTableMgr,
		repo:     r,
	}
}

func (qb *SceneReleaseStore) table() exp.IdentifierExpression {
	return qb.tableMgr.table
}

func (qb *SceneReleaseStore) selectDataset() *goqu.SelectDataset {
	table := qb.table()
	files := fileTableMgr.table
	folders := folderTableMgr.table

	return dialect.From(table).LeftJoin(
		sceneReleaseFilesJoinTable,
		goqu.On(
			sceneReleaseFilesJoinTable.Col(sceneReleaseIDColumn).Eq(table.Col(idColumn)),
			sceneReleaseFilesJoinTable.Col("primary").Eq(1),
		),
	).LeftJoin(
		files,
		goqu.On(files.Col(idColumn).Eq(sceneReleaseFilesJoinTable.Col(fileIDColumn))),
	).LeftJoin(
		folders,
		goqu.On(folders.Col(idColumn).Eq(files.Col("parent_folder_id"))),
	).Select(
		qb.table().All(),
		sceneReleaseFilesJoinTable.Col(fileIDColumn).As("primary_file_id"),
		folders.Col("path").As("primary_file_folder_path"),
		files.Col("basename").As("primary_file_basename"),
	)
}

func (qb *SceneReleaseStore) Create(ctx context.Context, newObject *models.SceneRelease, fileIDs []models.FileID) error {
	var r sceneReleaseRow
	r.fromSceneRelease(*newObject)

	id, err := qb.tableMgr.insertID(ctx, r)
	if err != nil {
		return err
	}

	if len(fileIDs) > 0 {
		const firstPrimary = true
		if err := sceneReleaseFilesTableMgr.insertJoins(ctx, id, firstPrimary, fileIDs); err != nil {
			return err
		}
	}

	if newObject.GalleryIDs.Loaded() {
		if err := sceneReleaseGalleriesTableMgr.insertJoins(ctx, id, newObject.GalleryIDs.List()); err != nil {
			return err
		}
	}

	newObject.ID = id
	return nil
}

func (qb *SceneReleaseStore) Update(ctx context.Context, updatedObject *models.SceneRelease) error {
	var r sceneReleaseRow
	r.fromSceneRelease(*updatedObject)

	if err := qb.tableMgr.updateByID(ctx, updatedObject.ID, r); err != nil {
		return err
	}

	return nil
}

func (qb *SceneReleaseStore) UpdatePartial(ctx context.Context, id int, partial models.SceneReleasePartial) (*models.SceneRelease, error) {
	r := sceneReleaseRowRecord{
		updateRecord{
			Record: make(exp.Record),
		},
	}

	r.fromPartial(partial)

	if len(r.Record) > 0 {
		if err := qb.tableMgr.updateByID(ctx, id, r.Record); err != nil {
			return nil, err
		}
	}

	if partial.GalleryIDs != nil {
		if err := sceneReleaseGalleriesTableMgr.modifyJoins(ctx, id, partial.GalleryIDs.IDs, partial.GalleryIDs.Mode); err != nil {
			return nil, err
		}
	}

	if partial.PrimaryFileID != nil {
		if err := sceneReleaseFilesTableMgr.setPrimary(ctx, id, *partial.PrimaryFileID); err != nil {
			return nil, err
		}
	}

	return qb.Find(ctx, id)
}

func (qb *SceneReleaseStore) Destroy(ctx context.Context, id int) error {
	return qb.tableMgr.destroyExisting(ctx, []int{id})
}

func (qb *SceneReleaseStore) Find(ctx context.Context, id int) (*models.SceneRelease, error) {
	ret, err := qb.FindMany(ctx, []int{id})
	if err != nil {
		return nil, err
	}

	if len(ret) == 0 {
		return nil, nil
	}

	return ret[0], nil
}

func (qb *SceneReleaseStore) FindMany(ctx context.Context, ids []int) ([]*models.SceneRelease, error) {
	ret := make([]*models.SceneRelease, len(ids))

	table := qb.table()
	if err := batchExec(ids, defaultBatchSize, func(batch []int) error {
		q := qb.selectDataset().Prepared(true).Where(table.Col(idColumn).In(batch))
		unsorted, err := qb.getMany(ctx, q)
		if err != nil {
			return err
		}

		for _, s := range unsorted {
			i := slices.Index(ids, s.ID)
			ret[i] = s
		}

		return nil
	}); err != nil {
		return nil, err
	}

	for i := range ret {
		if ret[i] == nil {
			return nil, errors.New("release not found")
		}
	}

	return ret, nil
}

func (qb *SceneReleaseStore) getMany(ctx context.Context, q *goqu.SelectDataset) ([]*models.SceneRelease, error) {
	const single = false
	var ret []*models.SceneRelease
	if err := queryFunc(ctx, q, single, func(r *sqlx.Rows) error {
		var f sceneReleaseQueryRow
		if err := r.StructScan(&f); err != nil {
			return err
		}

		s := f.resolve()
		ret = append(ret, s)
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (qb *SceneReleaseStore) FindBySceneID(ctx context.Context, sceneID int) ([]*models.SceneRelease, error) {
	table := qb.table()
	q := qb.selectDataset().Where(table.Col(sceneIDColumn).Eq(sceneID)).Order(table.Col("date").Asc())

	return qb.getMany(ctx, q)
}

func (qb *SceneReleaseStore) GetFileIDs(ctx context.Context, releaseID int) ([]models.FileID, error) {
	joinTable := sceneReleaseFilesJoinTable

	q := dialect.From(joinTable).Select(joinTable.Col(fileIDColumn)).Where(joinTable.Col(sceneReleaseIDColumn).Eq(releaseID))

	const single = false
	var ret []models.FileID
	if err := queryFunc(ctx, q, single, func(rows *sqlx.Rows) error {
		var id models.FileID
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ret = append(ret, id)
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (qb *SceneReleaseStore) AddFileID(ctx context.Context, releaseID int, fileID models.FileID) error {
	const firstPrimary = false
	return sceneReleaseFilesTableMgr.insertJoins(ctx, releaseID, firstPrimary, []models.FileID{fileID})
}

// FileExistsInSceneReleases checks if a file belongs to any release of the given scene
func (qb *SceneReleaseStore) FileExistsInSceneReleases(ctx context.Context, sceneID int, fileID models.FileID) (bool, error) {
	query := `
		SELECT COUNT(*)
		FROM scene_release_files srf
		INNER JOIN scene_releases sr ON srf.release_id = sr.id
		WHERE sr.scene_id = ? AND srf.file_id = ?
	`

	var count int
	if err := dbWrapper.Get(ctx, &count, query, sceneID, fileID); err != nil {
		return false, err
	}

	return count > 0, nil
}

func (qb *SceneReleaseStore) GetGalleryIDs(ctx context.Context, releaseID int) ([]int, error) {
	return sceneReleaseGalleriesTableMgr.get(ctx, releaseID)
}

func (qb *SceneReleaseStore) GetCover(ctx context.Context, releaseID int) ([]byte, error) {
	return qb.GetImage(ctx, releaseID, sceneReleaseCoverBlobColumn)
}

func (qb *SceneReleaseStore) HasCover(ctx context.Context, releaseID int) (bool, error) {
	return qb.HasImage(ctx, releaseID, sceneReleaseCoverBlobColumn)
}

func (qb *SceneReleaseStore) UpdateCover(ctx context.Context, releaseID int, image []byte) error {
	return qb.UpdateImage(ctx, releaseID, sceneReleaseCoverBlobColumn, image)
}

func (qb *SceneReleaseStore) destroyCover(ctx context.Context, releaseID int) error {
	return qb.DestroyImage(ctx, releaseID, sceneReleaseCoverBlobColumn)
}

// GetFiles returns the video files for a release
func (qb *SceneReleaseStore) GetFiles(ctx context.Context, releaseID int) ([]*models.VideoFile, error) {
	fileIDs, err := qb.GetFileIDs(ctx, releaseID)
	if err != nil {
		return nil, err
	}

	files, err := qb.repo.File.Find(ctx, fileIDs...)
	if err != nil {
		return nil, err
	}

	ret := make([]*models.VideoFile, len(files))
	for i, f := range files {
		var ok bool
		ret[i], ok = f.(*models.VideoFile)
		if !ok {
			return nil, errors.New("not a video file")
		}
	}

	return ret, nil
}

// AssignFilesToScene moves all files from a release to the parent scene
func (qb *SceneReleaseStore) AssignFilesToScene(ctx context.Context, releaseID int, sceneID int) error {
	fileIDs, err := qb.GetFileIDs(ctx, releaseID)
	if err != nil {
		return err
	}

	if len(fileIDs) == 0 {
		return nil
	}

	// Delete file associations from this release
	q := dialect.Delete(sceneReleaseFilesJoinTable).Where(
		sceneReleaseFilesJoinTable.Col(sceneReleaseIDColumn).Eq(releaseID),
	)
	if _, err := exec(ctx, q); err != nil {
		return err
	}

	// Add files to the scene (non-primary since scene should already have files)
	// Only add if not already associated with the scene
	for _, fileID := range fileIDs {
		// Check if already exists
		existsQuery := dialect.Select(goqu.COUNT("*")).From(scenesFilesJoinTable).Where(
			scenesFilesJoinTable.Col(sceneIDColumn).Eq(sceneID),
			scenesFilesJoinTable.Col(fileIDColumn).Eq(fileID),
		)
		existingCount, err := count(ctx, existsQuery)
		if err != nil {
			return err
		}
		if existingCount > 0 {
			// Already associated, skip
			continue
		}

		const firstPrimary = false
		if err := scenesFilesTableMgr.insertJoins(ctx, sceneID, firstPrimary, []models.FileID{fileID}); err != nil {
			return err
		}
	}

	return nil
}
