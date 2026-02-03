package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/jmoiron/sqlx"
	"gopkg.in/guregu/null.v4"
	"gopkg.in/guregu/null.v4/zero"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/studio"
)

const (
	studioTable    = "studios"
	studioIDColumn = "studio_id"

	studioURLsTable = "studio_urls"
	studioURLColumn = "url"

	studioAliasesTable    = "studio_aliases"
	studioAliasColumn     = "alias"
	studioParentIDColumn  = "parent_id"
	studioNameColumn      = "name"
	studioImageBlobColumn = "image_blob"
	studiosTagsTable      = "studios_tags"
)

type studioRow struct {
	ID        int         `db:"id" goqu:"skipinsert"`
	Name      zero.String `db:"name"`
	ParentID  null.Int    `db:"parent_id,omitempty"`
	CreatedAt Timestamp   `db:"created_at"`
	UpdatedAt Timestamp   `db:"updated_at"`
	// expressed as 1-100
	Rating        null.Int    `db:"rating"`
	Favorite      bool        `db:"favorite"`
	Details       zero.String `db:"details"`
	IgnoreAutoTag bool        `db:"ignore_auto_tag"`

	// not used in resolutions or updates
	ImageBlob zero.String `db:"image_blob"`
}

func (r *studioRow) fromStudio(o models.Studio) {
	r.ID = o.ID
	r.Name = zero.StringFrom(o.Name)
	r.ParentID = intFromPtr(o.ParentID)
	r.CreatedAt = Timestamp{Timestamp: o.CreatedAt}
	r.UpdatedAt = Timestamp{Timestamp: o.UpdatedAt}
	r.Rating = intFromPtr(o.Rating)
	r.Favorite = o.Favorite
	r.Details = zero.StringFrom(o.Details)
	r.IgnoreAutoTag = o.IgnoreAutoTag
}

func (r *studioRow) resolve() *models.Studio {
	ret := &models.Studio{
		ID:            r.ID,
		Name:          r.Name.String,
		ParentID:      nullIntPtr(r.ParentID),
		CreatedAt:     r.CreatedAt.Timestamp,
		UpdatedAt:     r.UpdatedAt.Timestamp,
		Rating:        nullIntPtr(r.Rating),
		Favorite:      r.Favorite,
		Details:       r.Details.String,
		IgnoreAutoTag: r.IgnoreAutoTag,
	}

	return ret
}

type studioRowRecord struct {
	updateRecord
}

func (r *studioRowRecord) fromPartial(o models.StudioPartial) {
	r.setNullString("name", o.Name)
	r.setNullInt("parent_id", o.ParentID)
	r.setTimestamp("created_at", o.CreatedAt)
	r.setTimestamp("updated_at", o.UpdatedAt)
	r.setNullInt("rating", o.Rating)
	r.setBool("favorite", o.Favorite)
	r.setNullString("details", o.Details)
	r.setBool("ignore_auto_tag", o.IgnoreAutoTag)
}

type studioRepositoryType struct {
	repository

	stashIDs stashIDRepository
	tags     joinRepository

	scenes    repository
	images    repository
	galleries repository
}

var (
	studioRepository = studioRepositoryType{
		repository: repository{
			tableName: studioTable,
			idColumn:  idColumn,
		},
		stashIDs: stashIDRepository{
			repository{
				tableName: "studio_stash_ids",
				idColumn:  studioIDColumn,
			},
		},
		scenes: repository{
			tableName: sceneTable,
			idColumn:  studioIDColumn,
		},
		images: repository{
			tableName: imageTable,
			idColumn:  studioIDColumn,
		},
		galleries: repository{
			tableName: galleryTable,
			idColumn:  studioIDColumn,
		},
		tags: joinRepository{
			repository: repository{
				tableName: studiosTagsTable,
				idColumn:  studioIDColumn,
			},
			fkColumn:     tagIDColumn,
			foreignTable: tagTable,
			orderBy:      tagTableSortSQL,
		},
	}
)

type StudioStore struct {
	blobJoinQueryBuilder
	tagRelationshipStore

	tableMgr *table
}

func NewStudioStore(blobStore *BlobStore) *StudioStore {
	return &StudioStore{
		blobJoinQueryBuilder: blobJoinQueryBuilder{
			blobStore: blobStore,
			joinTable: studioTable,
		},
		tagRelationshipStore: tagRelationshipStore{
			idRelationshipStore: idRelationshipStore{
				joinTable: studiosTagsTableMgr,
			},
		},

		tableMgr: studioTableMgr,
	}
}

func (qb *StudioStore) table() exp.IdentifierExpression {
	return qb.tableMgr.table
}

func (qb *StudioStore) selectDataset() *goqu.SelectDataset {
	return dialect.From(qb.table()).Select(qb.table().All())
}

func (qb *StudioStore) Create(ctx context.Context, newObject *models.Studio) error {
	var err error

	var r studioRow
	r.fromStudio(*newObject)

	id, err := qb.tableMgr.insertID(ctx, r)
	if err != nil {
		return err
	}

	if newObject.Aliases.Loaded() {
		if err := studio.ValidateAliases(ctx, id, newObject.Aliases.List(), qb); err != nil {
			return err
		}

		if err := studiosAliasesTableMgr.insertJoins(ctx, id, newObject.Aliases.List()); err != nil {
			return err
		}
	}

	if newObject.URLs.Loaded() {
		const startPos = 0
		if err := studiosURLsTableMgr.insertJoins(ctx, id, startPos, newObject.URLs.List()); err != nil {
			return err
		}
	}

	if err := qb.tagRelationshipStore.createRelationships(ctx, id, newObject.TagIDs); err != nil {
		return err
	}

	if newObject.StashIDs.Loaded() {
		if err := studiosStashIDsTableMgr.insertJoins(ctx, id, newObject.StashIDs.List()); err != nil {
			return err
		}
	}

	updated, err := qb.find(ctx, id)
	if err != nil {
		return fmt.Errorf("finding after create: %w", err)
	}

	*newObject = *updated
	return nil
}

func (qb *StudioStore) UpdatePartial(ctx context.Context, input models.StudioPartial) (*models.Studio, error) {
	r := studioRowRecord{
		updateRecord{
			Record: make(exp.Record),
		},
	}

	r.fromPartial(input)

	if len(r.Record) > 0 {
		if err := qb.tableMgr.updateByID(ctx, input.ID, r.Record); err != nil {
			return nil, err
		}
	}

	if input.Aliases != nil {
		if err := studiosAliasesTableMgr.modifyJoins(ctx, input.ID, input.Aliases.Values, input.Aliases.Mode); err != nil {
			return nil, err
		}
	}

	if input.URLs != nil {
		if err := studiosURLsTableMgr.modifyJoins(ctx, input.ID, input.URLs.Values, input.URLs.Mode); err != nil {
			return nil, err
		}
	}

	if err := qb.tagRelationshipStore.modifyRelationships(ctx, input.ID, input.TagIDs); err != nil {
		return nil, err
	}

	if input.StashIDs != nil {
		if err := studiosStashIDsTableMgr.modifyJoins(ctx, input.ID, input.StashIDs.StashIDs, input.StashIDs.Mode); err != nil {
			return nil, err
		}
	}

	return qb.Find(ctx, input.ID)
}

// This is only used by the Import/Export functionality
func (qb *StudioStore) Update(ctx context.Context, updatedObject *models.Studio) error {
	var r studioRow
	r.fromStudio(*updatedObject)

	if err := qb.tableMgr.updateByID(ctx, updatedObject.ID, r); err != nil {
		return err
	}

	if updatedObject.Aliases.Loaded() {
		if err := studiosAliasesTableMgr.replaceJoins(ctx, updatedObject.ID, updatedObject.Aliases.List()); err != nil {
			return err
		}
	}

	if updatedObject.URLs.Loaded() {
		if err := studiosURLsTableMgr.replaceJoins(ctx, updatedObject.ID, updatedObject.URLs.List()); err != nil {
			return err
		}
	}

	if err := qb.tagRelationshipStore.replaceRelationships(ctx, updatedObject.ID, updatedObject.TagIDs); err != nil {
		return err
	}

	if updatedObject.StashIDs.Loaded() {
		if err := studiosStashIDsTableMgr.replaceJoins(ctx, updatedObject.ID, updatedObject.StashIDs.List()); err != nil {
			return err
		}
	}

	return nil
}

func (qb *StudioStore) Destroy(ctx context.Context, id int) error {
	// must handle image checksums manually
	if err := qb.destroyImage(ctx, id); err != nil {
		return err
	}

	return studioRepository.destroyExisting(ctx, []int{id})
}

// returns nil, nil if not found
func (qb *StudioStore) Find(ctx context.Context, id int) (*models.Studio, error) {
	ret, err := qb.find(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return ret, err
}

func (qb *StudioStore) FindMany(ctx context.Context, ids []int) ([]*models.Studio, error) {
	ret := make([]*models.Studio, len(ids))

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
			return nil, fmt.Errorf("studio with id %d not found", ids[i])
		}
	}

	return ret, nil
}

// returns nil, sql.ErrNoRows if not found
func (qb *StudioStore) find(ctx context.Context, id int) (*models.Studio, error) {
	q := qb.selectDataset().Where(qb.tableMgr.byID(id))

	ret, err := qb.get(ctx, q)
	if err != nil {
		return nil, err
	}

	return ret, nil
}

// returns nil, sql.ErrNoRows if not found
func (qb *StudioStore) get(ctx context.Context, q *goqu.SelectDataset) (*models.Studio, error) {
	ret, err := qb.getMany(ctx, q)
	if err != nil {
		return nil, err
	}

	if len(ret) == 0 {
		return nil, sql.ErrNoRows
	}

	return ret[0], nil
}

func (qb *StudioStore) getMany(ctx context.Context, q *goqu.SelectDataset) ([]*models.Studio, error) {
	const single = false
	var ret []*models.Studio
	if err := queryFunc(ctx, q, single, func(r *sqlx.Rows) error {
		var f studioRow
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

func (qb *StudioStore) findBySubquery(ctx context.Context, sq *goqu.SelectDataset) ([]*models.Studio, error) {
	table := qb.table()

	q := qb.selectDataset().Where(
		table.Col(idColumn).Eq(
			sq,
		),
	)

	return qb.getMany(ctx, q)
}

func (qb *StudioStore) FindChildren(ctx context.Context, id int) ([]*models.Studio, error) {
	// SELECT studios.* FROM studios WHERE studios.parent_id = ?
	table := qb.table()
	sq := qb.selectDataset().Where(table.Col(studioParentIDColumn).Eq(id))
	ret, err := qb.getMany(ctx, sq)

	if err != nil {
		return nil, err
	}

	return ret, nil
}

func (qb *StudioStore) FindBySceneID(ctx context.Context, sceneID int) (*models.Studio, error) {
	// SELECT studios.* FROM studios JOIN scenes ON studios.id = scenes.studio_id WHERE scenes.id = ? LIMIT 1
	table := qb.table()
	scenes := sceneTableMgr.table
	sq := qb.selectDataset().Join(
		scenes, goqu.On(table.Col(idColumn), scenes.Col(studioIDColumn)),
	).Where(
		scenes.Col(idColumn),
	).Limit(1)
	ret, err := qb.get(ctx, sq)

	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	return ret, nil
}

func (qb *StudioStore) FindByName(ctx context.Context, name string, nocase bool) (*models.Studio, error) {
	// query := "SELECT * FROM studios WHERE name = ?"
	// if nocase {
	// 	query += " COLLATE NOCASE"
	// }
	// query += " LIMIT 1"
	where := "name = ?"
	if nocase {
		where += " COLLATE NOCASE"
	}
	sq := qb.selectDataset().Prepared(true).Where(goqu.L(where, name)).Limit(1)
	ret, err := qb.get(ctx, sq)

	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	return ret, nil
}

func (qb *StudioStore) FindByStashID(ctx context.Context, stashID models.StashID) ([]*models.Studio, error) {
	sq := dialect.From(studiosStashIDsJoinTable).Select(studiosStashIDsJoinTable.Col(studioIDColumn)).Where(
		studiosStashIDsJoinTable.Col("stash_id").Eq(stashID.StashID),
		studiosStashIDsJoinTable.Col("endpoint").Eq(stashID.Endpoint),
	)
	ret, err := qb.findBySubquery(ctx, sq)

	if err != nil {
		return nil, fmt.Errorf("getting studios for stash ID %s: %w", stashID.StashID, err)
	}

	return ret, nil
}

func (qb *StudioStore) FindByStashIDStatus(ctx context.Context, hasStashID bool, stashboxEndpoint string) ([]*models.Studio, error) {
	table := qb.table()
	sq := dialect.From(table).LeftJoin(
		studiosStashIDsJoinTable,
		goqu.On(table.Col(idColumn).Eq(studiosStashIDsJoinTable.Col(studioIDColumn))),
	).Select(table.Col(idColumn))

	if hasStashID {
		sq = sq.Where(
			studiosStashIDsJoinTable.Col("stash_id").IsNotNull(),
			studiosStashIDsJoinTable.Col("endpoint").Eq(stashboxEndpoint),
		)
	} else {
		sq = sq.Where(
			studiosStashIDsJoinTable.Col("stash_id").IsNull(),
		)
	}

	ret, err := qb.findBySubquery(ctx, sq)

	if err != nil {
		return nil, fmt.Errorf("getting studios for stash-box endpoint %s: %w", stashboxEndpoint, err)
	}

	return ret, nil
}

func (qb *StudioStore) Count(ctx context.Context) (int, error) {
	q := dialect.Select(goqu.COUNT("*")).From(qb.table())
	return count(ctx, q)
}

func (qb *StudioStore) All(ctx context.Context) ([]*models.Studio, error) {
	table := qb.table()
	return qb.getMany(ctx, qb.selectDataset().Order(table.Col(studioNameColumn).Asc()))
}

func (qb *StudioStore) QueryForAutoTag(ctx context.Context, words []string) ([]*models.Studio, error) {
	// TODO - Query needs to be changed to support queries of this type, and
	// this method should be removed
	table := qb.table()
	sq := dialect.From(table).Select(table.Col(idColumn)).LeftJoin(
		studiosAliasesJoinTable,
		goqu.On(studiosAliasesJoinTable.Col(studioIDColumn).Eq(table.Col(idColumn))),
	)

	var whereClauses []exp.Expression

	for _, w := range words {
		whereClauses = append(whereClauses, table.Col(studioNameColumn).Like(w+"%"))
		whereClauses = append(whereClauses, studiosAliasesJoinTable.Col("alias").Like(w+"%"))
	}

	sq = sq.Where(
		goqu.Or(whereClauses...),
		table.Col("ignore_auto_tag").Eq(0),
	)

	ret, err := qb.findBySubquery(ctx, sq)

	if err != nil {
		return nil, fmt.Errorf("getting studios for autotag: %w", err)
	}

	return ret, nil
}

func (qb *StudioStore) makeQuery(ctx context.Context, studioFilter *models.StudioFilterType, findFilter *models.FindFilterType) (*queryBuilder, error) {
	if studioFilter == nil {
		studioFilter = &models.StudioFilterType{}
	}
	if findFilter == nil {
		findFilter = &models.FindFilterType{}
	}

	query := studioRepository.newQuery()
	distinctIDs(&query, studioTable)

	if q := findFilter.Q; q != nil && *q != "" {
		query.join(studioAliasesTable, "", "studio_aliases.studio_id = studios.id")
		searchColumns := []string{"studios.name", "studio_aliases.alias"}
		query.parseQueryString(searchColumns, *q)
	}

	filter := filterBuilderFromHandler(ctx, &studioFilterHandler{
		studioFilter: studioFilter,
	})

	if err := query.addFilter(filter); err != nil {
		return nil, err
	}

	var err error
	query.sortAndPagination, err = qb.getStudioSort(findFilter)
	if err != nil {
		return nil, err
	}
	query.sortAndPagination += getPagination(findFilter)

	return &query, nil
}

func (qb *StudioStore) Query(ctx context.Context, studioFilter *models.StudioFilterType, findFilter *models.FindFilterType) ([]*models.Studio, int, error) {
	query, err := qb.makeQuery(ctx, studioFilter, findFilter)
	if err != nil {
		return nil, 0, err
	}

	idsResult, countResult, err := query.executeFind(ctx)
	if err != nil {
		return nil, 0, err
	}

	studios, err := qb.FindMany(ctx, idsResult)
	if err != nil {
		return nil, 0, err
	}

	return studios, countResult, nil
}

func (qb *StudioStore) QueryCount(ctx context.Context, studioFilter *models.StudioFilterType, findFilter *models.FindFilterType) (int, error) {
	query, err := qb.makeQuery(ctx, studioFilter, findFilter)
	if err != nil {
		return 0, err
	}

	return query.executeCount(ctx)
}

func (qb *StudioStore) sortByScenesDuration(direction string) string {
	return fmt.Sprintf(` ORDER BY (
		SELECT COALESCE(SUM(video_files.duration), 0)
		FROM %s
		LEFT JOIN %s ON %s.%s = %s.id
		LEFT JOIN video_files ON video_files.file_id = %s.file_id
		WHERE %s.%s = %s.id
	) %s`, sceneTable, scenesFilesTable, scenesFilesTable, sceneIDColumn, sceneTable, scenesFilesTable, sceneTable, studioIDColumn, studioTable, getSortDirection(direction))
}

// sortByMarkerRoleSceneCount creates a sort query for counting distinct scenes
// that have scene markers with the specified tag (including ALL subtags recursively)
// Checks both primary_tag_id AND secondary tags in scene_markers_tags
func (qb *StudioStore) sortByMarkerRoleSceneCount(tagID int, direction string) string {
	if tagID == 0 {
		// If no tag is configured, sort as if count is 0
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	// Count distinct scenes for each studio that have markers with the tag or its descendants
	// Uses UNION ALL to check both primary tag and secondary tags (scene_markers_tags)
	// Using COALESCE to handle studios with no matching markers (count = 0)
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT s.id)
		FROM scenes s
		INNER JOIN scene_markers sm ON sm.scene_id = s.id
		WHERE s.studio_id = studios.id
		AND EXISTS (
			SELECT 1 FROM (
				SELECT sm.primary_tag_id AS tag_id
				UNION ALL
				SELECT smt.tag_id FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id
			) marker_tags
			WHERE marker_tags.tag_id = %[1]d
			   OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
		)
	), 0) %[2]s`, tagID, getSortDirection(direction))
}

// sortBySexSceneCount counts scenes with sex markers
func (qb *StudioStore) sortBySexSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	return qb.sortByMarkerRoleSceneCount(roleTagIDs.SexTagID, direction)
}

// sortByOralSceneCount counts scenes with oral markers but not sex markers
func (qb *StudioStore) sortByOralSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	if roleTagIDs.OralTagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	// Build sex tag exclusion - exclude scenes that have ANY sex marker
	// Checks both primary and secondary tags
	sexExclude := ""
	if roleTagIDs.SexTagID != 0 {
		sexExclude = fmt.Sprintf(`
			AND s.id NOT IN (
				SELECT DISTINCT sm_sex.scene_id
				FROM scene_markers sm_sex
				WHERE EXISTS (
					SELECT 1 FROM (
						SELECT sm_sex.primary_tag_id AS tag_id
						UNION ALL
						SELECT smt_sex.tag_id FROM scene_markers_tags smt_sex WHERE smt_sex.scene_marker_id = sm_sex.id
					) sex_marker_tags
					WHERE sex_marker_tags.tag_id = %[1]d
					   OR sex_marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
				)
			)`, roleTagIDs.SexTagID)
	}

	// Count scenes with oral markers (including all subtags) excluding those with sex markers
	// Checks both primary and secondary tags
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT s.id)
		FROM scenes s
		INNER JOIN scene_markers sm ON sm.scene_id = s.id
		WHERE s.studio_id = studios.id
		AND EXISTS (
			SELECT 1 FROM (
				SELECT sm.primary_tag_id AS tag_id
				UNION ALL
				SELECT smt.tag_id FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id
			) marker_tags
			WHERE marker_tags.tag_id = %[1]d
			   OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
		)
		%[2]s
	), 0) %[3]s`, roleTagIDs.OralTagID, sexExclude, getSortDirection(direction))
}

// sortBySoloSceneCount counts scenes with solo markers but not sex/oral markers
func (qb *StudioStore) sortBySoloSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	if roleTagIDs.SoloTagID == 0 {
		return fmt.Sprintf(" ORDER BY 0 %s", getSortDirection(direction))
	}

	// Build exclusion for sex markers - checks both primary and secondary tags
	excludeConditions := ""
	if roleTagIDs.SexTagID != 0 {
		excludeConditions += fmt.Sprintf(`
			AND s.id NOT IN (
				SELECT DISTINCT sm_sex.scene_id
				FROM scene_markers sm_sex
				WHERE EXISTS (
					SELECT 1 FROM (
						SELECT sm_sex.primary_tag_id AS tag_id
						UNION ALL
						SELECT smt_sex.tag_id FROM scene_markers_tags smt_sex WHERE smt_sex.scene_marker_id = sm_sex.id
					) sex_marker_tags
					WHERE sex_marker_tags.tag_id = %[1]d
					   OR sex_marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
					   OR sex_marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
				)
			)`, roleTagIDs.SexTagID)
	}
	// Build exclusion for oral markers - checks both primary and secondary tags
	if roleTagIDs.OralTagID != 0 {
		excludeConditions += fmt.Sprintf(`
			AND s.id NOT IN (
				SELECT DISTINCT sm_oral.scene_id
				FROM scene_markers sm_oral
				WHERE EXISTS (
					SELECT 1 FROM (
						SELECT sm_oral.primary_tag_id AS tag_id
						UNION ALL
						SELECT smt_oral.tag_id FROM scene_markers_tags smt_oral WHERE smt_oral.scene_marker_id = sm_oral.id
					) oral_marker_tags
					WHERE oral_marker_tags.tag_id = %[1]d
					   OR oral_marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
					   OR oral_marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
					   OR oral_marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
					   OR oral_marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
				)
			)`, roleTagIDs.OralTagID)
	}

	// Count scenes with solo markers (including all subtags) excluding those with sex/oral markers
	// Checks both primary and secondary tags
	return fmt.Sprintf(` ORDER BY COALESCE((
		SELECT COUNT(DISTINCT s.id)
		FROM scenes s
		INNER JOIN scene_markers sm ON sm.scene_id = s.id
		WHERE s.studio_id = studios.id
		AND EXISTS (
			SELECT 1 FROM (
				SELECT sm.primary_tag_id AS tag_id
				UNION ALL
				SELECT smt.tag_id FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id
			) marker_tags
			WHERE marker_tags.tag_id = %[1]d
			   OR marker_tags.tag_id IN (SELECT child_id FROM tags_relations WHERE parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr2.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr3.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id WHERE tr1.parent_id = %[1]d)
			   OR marker_tags.tag_id IN (SELECT tr4.child_id FROM tags_relations tr1 JOIN tags_relations tr2 ON tr2.parent_id = tr1.child_id JOIN tags_relations tr3 ON tr3.parent_id = tr2.child_id JOIN tags_relations tr4 ON tr4.parent_id = tr3.child_id WHERE tr1.parent_id = %[1]d)
		)
		%[2]s
	), 0) %[3]s`, roleTagIDs.SoloTagID, excludeConditions, getSortDirection(direction))
}

// sortByFacialSceneCount counts scenes with facial markers (independent of other markers)
func (qb *StudioStore) sortByFacialSceneCount(direction string) string {
	roleTagIDs := GetRoleTagIDs()
	return qb.sortByMarkerRoleSceneCount(roleTagIDs.FacialTagID, direction)
}

// sortByUniquePerformerCount counts performers who have exactly 1 scene in the database
// and that scene belongs to this studio
func (qb *StudioStore) sortByUniquePerformerCount(direction string) string {
	// Count performers who:
	// 1. Have scenes with this studio
	// 2. Have exactly 1 scene total in the database
	return fmt.Sprintf(` ORDER BY (
		SELECT COUNT(DISTINCT p.id)
		FROM performers p
		INNER JOIN performers_scenes ps ON ps.performer_id = p.id
		INNER JOIN scenes s ON s.id = ps.scene_id
		WHERE s.studio_id = studios.id
		AND (
			SELECT COUNT(*) FROM performers_scenes ps2 WHERE ps2.performer_id = p.id
		) = 1
	) %s`, getSortDirection(direction))
}

var studioSortOptions = sortOptions{
	"child_count",
	"created_at",
	"galleries_count",
	"id",
	"images_count",
	"name",
	"scenes_count",
	"scenes_duration",
	"sex_scenes_count",
	"oral_scenes_count",
	"solo_scenes_count",
	"facial_scenes_count",
	"unique_performers_count",
	"random",
	"rating",
	"tag_count",
	"updated_at",
}

func (qb *StudioStore) getStudioSort(findFilter *models.FindFilterType) (string, error) {
	var sort string
	var direction string
	if findFilter == nil {
		sort = "name"
		direction = "ASC"
	} else {
		sort = findFilter.GetSort("name")
		direction = findFilter.GetDirection()
	}

	// CVE-2024-32231 - ensure sort is in the list of allowed sorts
	if err := studioSortOptions.validateSort(sort); err != nil {
		return "", err
	}

	sortQuery := ""
	switch sort {
	case "tag_count":
		sortQuery += getCountSort(studioTable, studiosTagsTable, studioIDColumn, direction)
	case "scenes_count":
		sortQuery += getCountSort(studioTable, sceneTable, studioIDColumn, direction)
	case "scenes_duration":
		sortQuery += qb.sortByScenesDuration(direction)
	case "images_count":
		sortQuery += getCountSort(studioTable, imageTable, studioIDColumn, direction)
	case "galleries_count":
		sortQuery += getCountSort(studioTable, galleryTable, studioIDColumn, direction)
	case "child_count":
		sortQuery += getCountSort(studioTable, studioTable, studioParentIDColumn, direction)
	case "sex_scenes_count":
		sortQuery += qb.sortBySexSceneCount(direction)
	case "oral_scenes_count":
		sortQuery += qb.sortByOralSceneCount(direction)
	case "solo_scenes_count":
		sortQuery += qb.sortBySoloSceneCount(direction)
	case "facial_scenes_count":
		sortQuery += qb.sortByFacialSceneCount(direction)
	case "unique_performers_count":
		sortQuery += qb.sortByUniquePerformerCount(direction)
	default:
		sortQuery += getSort(sort, direction, "studios")
	}

	// Whatever the sorting, always use name/id as a final sort
	sortQuery += ", COALESCE(studios.name, studios.id) COLLATE NATURAL_CI ASC"
	return sortQuery, nil
}

func (qb *StudioStore) GetImage(ctx context.Context, studioID int) ([]byte, error) {
	return qb.blobJoinQueryBuilder.GetImage(ctx, studioID, studioImageBlobColumn)
}

func (qb *StudioStore) HasImage(ctx context.Context, studioID int) (bool, error) {
	return qb.blobJoinQueryBuilder.HasImage(ctx, studioID, studioImageBlobColumn)
}

func (qb *StudioStore) UpdateImage(ctx context.Context, studioID int, image []byte) error {
	return qb.blobJoinQueryBuilder.UpdateImage(ctx, studioID, studioImageBlobColumn, image)
}

func (qb *StudioStore) destroyImage(ctx context.Context, studioID int) error {
	return qb.blobJoinQueryBuilder.DestroyImage(ctx, studioID, studioImageBlobColumn)
}

func (qb *StudioStore) GetStashIDs(ctx context.Context, studioID int) ([]models.StashID, error) {
	return studiosStashIDsTableMgr.get(ctx, studioID)
}

func (qb *StudioStore) GetAliases(ctx context.Context, studioID int) ([]string, error) {
	return studiosAliasesTableMgr.get(ctx, studioID)
}

func (qb *StudioStore) GetURLs(ctx context.Context, studioID int) ([]string, error) {
	return studiosURLsTableMgr.get(ctx, studioID)
}
