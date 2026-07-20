package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

const (
	ratingCriteriaScoresTable = "rating_criteria_scores"
	ratingBonusScoresTable    = "rating_bonus_scores"
	ratingPenaltyScoresTable  = "rating_penalty_scores"
)

type ratingScoreSectionTable struct {
	section string
	table   string
}

var ratingScoreTables = []ratingScoreSectionTable{
	{section: models.RatingScoreSectionCriterion, table: ratingCriteriaScoresTable},
	{section: models.RatingScoreSectionBonus, table: ratingBonusScoresTable},
	{section: models.RatingScoreSectionPenalty, table: ratingPenaltyScoresTable},
}

var defaultSceneRatingScoreKeys = ratingScoreKeysForRubricCustom(defaultSceneRatingRubricCustom)
var groupSceneRatingScoreKeys = ratingScoreKeysForRubricCustom(groupSceneRatingRubricCustom)
var soloSceneRatingScoreKeys = ratingScoreKeysForRubricCustom(soloSceneRatingRubricCustom)
var performerRatingScoreKeys = ratingScoreKeysForRubricCustom(performerRatingRubricCustom)

type ratingScoreRow struct {
	ID            int            `db:"id"`
	Section       string         `db:"section"`
	EntityType    string         `db:"entity_type"`
	EntityID      int            `db:"entity_id"`
	Key           string         `db:"key"`
	RawValue      float64        `db:"raw_value"`
	WeightedValue float64        `db:"weighted_value"`
	Label         sql.NullString `db:"label"`
	CreatedAt     time.Time      `db:"created_at"`
	UpdatedAt     time.Time      `db:"updated_at"`
}

func (r ratingScoreRow) resolve(section string) *models.RatingScore {
	var label *string
	if r.Label.Valid {
		label = &r.Label.String
	}

	return &models.RatingScore{
		ID:            r.ID,
		EntityType:    r.EntityType,
		EntityID:      r.EntityID,
		Section:       section,
		Key:           r.Key,
		RawValue:      r.RawValue,
		WeightedValue: r.WeightedValue,
		Label:         label,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}

type RatingScoreStore struct{}

func NewRatingScoreStore() *RatingScoreStore {
	return &RatingScoreStore{}
}

func normalizeRatingEntityType(entityType string) (string, error) {
	ret := strings.ToLower(strings.TrimSpace(entityType))
	switch ret {
	case models.RatingEntityScene, models.RatingEntityPerformer:
		return ret, nil
	default:
		return "", fmt.Errorf("unsupported rating entity type %q", entityType)
	}
}

func ratingScoreTableForSection(section string) (string, string, error) {
	normalized := strings.ToLower(strings.TrimSpace(section))
	for _, t := range ratingScoreTables {
		if normalized == t.section {
			return t.table, normalized, nil
		}
	}

	return "", "", fmt.Errorf("unsupported rating score section %q", section)
}

func ratingScoreRowsForEntityQuery() string {
	return fmt.Sprintf(`
		SELECT section, id, entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
		FROM (
			SELECT 0 AS section_order, '%s' AS section, id, entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
			FROM %s
			WHERE entity_type = ? AND entity_id = ?
			UNION ALL
			SELECT 1 AS section_order, '%s' AS section, id, entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
			FROM %s
			WHERE entity_type = ? AND entity_id = ?
			UNION ALL
			SELECT 2 AS section_order, '%s' AS section, id, entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
			FROM %s
			WHERE entity_type = ? AND entity_id = ?
		)
		ORDER BY section_order, key
	`,
		models.RatingScoreSectionCriterion,
		ratingCriteriaScoresTable,
		models.RatingScoreSectionBonus,
		ratingBonusScoresTable,
		models.RatingScoreSectionPenalty,
		ratingPenaltyScoresTable,
	)
}

func ratingScoreKeyAllowed(allowed map[string]map[string]struct{}, section string, key string) bool {
	sectionKeys, ok := allowed[section]
	if !ok {
		return false
	}
	_, ok = sectionKeys[key]
	return ok
}

func sceneHasRatingMarkerTagQuery(tagID int) string {
	return fmt.Sprintf(`EXISTS (
		SELECT 1
		FROM %s sm
		WHERE sm.%s = ?
		AND %s
	)`, sceneMarkerTable, sceneIDColumn, tagHierarchyCondition("sm", tagID))
}

func sceneLacksRatingMarkerTagQuery(tagID int) string {
	return fmt.Sprintf(`NOT EXISTS (
		SELECT 1
		FROM %s sm
		WHERE sm.%s = ?
		AND %s
	)`, sceneMarkerTable, sceneIDColumn, tagHierarchyCondition("sm", tagID))
}

func sceneUsesSoloRating(ctx context.Context, sceneID int) (bool, error) {
	tags := GetRoleTagIDs()
	if tags.SoloTagID == 0 {
		return false, nil
	}

	clauses := []string{sceneHasRatingMarkerTagQuery(tags.SoloTagID)}
	args := []interface{}{sceneID}

	if tags.SexTagID != 0 {
		clauses = append(clauses, sceneLacksRatingMarkerTagQuery(tags.SexTagID))
		args = append(args, sceneID)
	}
	if tags.OralTagID != 0 {
		clauses = append(clauses, sceneLacksRatingMarkerTagQuery(tags.OralTagID))
		args = append(args, sceneID)
	}

	var isSolo bool
	query := "SELECT " + strings.Join(clauses, " AND ")
	if err := dbWrapper.Get(ctx, &isSolo, query, args...); err != nil {
		return false, fmt.Errorf("detecting solo scene rating mode for scene %d: %w", sceneID, err)
	}

	return isSolo, nil
}

func sceneUsesGroupRating(performerCount int) bool {
	return performerCount >= 4
}

func sceneUsesSoloRatingByCastCustom(performerCount int) bool {
	return performerCount == 1
}

func (s *RatingScoreStore) SceneMode(ctx context.Context, sceneID int) (string, error) {
	performerCount, err := scenePerformerCount(ctx, sceneID)
	if err != nil {
		return "", err
	}
	if sceneUsesGroupRating(performerCount) {
		return models.RatingSceneModeGroup, nil
	}
	if sceneUsesSoloRatingByCastCustom(performerCount) {
		return models.RatingSceneModeSolo, nil
	}

	isSolo, err := sceneUsesSoloRating(ctx, sceneID)
	if err != nil {
		return "", err
	}
	if isSolo {
		return models.RatingSceneModeSolo, nil
	}

	return models.RatingSceneModeDefault, nil
}

func (s *RatingScoreStore) rubricForEntityCustom(ctx context.Context, entityType string, entityID int) (ratingScoreRubricCustom, error) {
	if entityType == models.RatingEntityPerformer {
		return performerRatingRubricCustom, nil
	}

	mode, err := s.SceneMode(ctx, entityID)
	if err != nil {
		return nil, err
	}
	switch mode {
	case models.RatingSceneModeGroup:
		return groupSceneRatingRubricCustom, nil
	case models.RatingSceneModeSolo:
		return soloSceneRatingRubricCustom, nil
	default:
		return defaultSceneRatingRubricCustom, nil
	}
}

func scenePerformerCount(ctx context.Context, sceneID int) (int, error) {
	var count int
	query := fmt.Sprintf("SELECT COUNT(DISTINCT %s) FROM %s WHERE %s = ?", performerIDColumn, performersScenesTable, sceneIDColumn)
	if err := dbWrapper.Get(ctx, &count, query, sceneID); err != nil {
		return 0, fmt.Errorf("counting performers for scene %d rating mode: %w", sceneID, err)
	}

	return count, nil
}

func (s *RatingScoreStore) scoreRowsForRating(ctx context.Context, entityType string, entityID int) ([]ratingScoreRow, error) {
	var rows []ratingScoreRow
	query := ratingScoreRowsForEntityQuery()
	if err := dbWrapper.Select(
		ctx,
		&rows,
		query,
		entityType, entityID,
		entityType, entityID,
		entityType, entityID,
	); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("finding rating scores: %w", err)
	}

	allowed := performerRatingScoreKeys
	if entityType == models.RatingEntityScene {
		performerCount, err := scenePerformerCount(ctx, entityID)
		if err != nil {
			return nil, err
		}

		if sceneUsesGroupRating(performerCount) {
			allowed = groupSceneRatingScoreKeys
		} else if sceneUsesSoloRatingByCastCustom(performerCount) {
			allowed = soloSceneRatingScoreKeys
		} else {
			isSolo, err := sceneUsesSoloRating(ctx, entityID)
			if err != nil {
				return nil, err
			}

			allowed = defaultSceneRatingScoreKeys
			if isSolo {
				allowed = soloSceneRatingScoreKeys
			}
		}
	}

	filtered := rows[:0]
	for _, row := range rows {
		if ratingScoreKeyAllowed(allowed, row.Section, row.Key) {
			filtered = append(filtered, row)
		}
	}

	return filtered, nil
}

func (s *RatingScoreStore) FindByEntity(ctx context.Context, entityType string, entityID int) ([]*models.RatingScore, error) {
	normalizedEntityType, err := normalizeRatingEntityType(entityType)
	if err != nil {
		return nil, err
	}

	var rows []ratingScoreRow
	query := ratingScoreRowsForEntityQuery()
	if err := dbWrapper.Select(
		ctx,
		&rows,
		query,
		normalizedEntityType, entityID,
		normalizedEntityType, entityID,
		normalizedEntityType, entityID,
	); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("finding rating scores: %w", err)
	}

	var ret []*models.RatingScore
	for _, row := range rows {
		ret = append(ret, row.resolve(row.Section))
	}

	return ret, nil
}

func (s *RatingScoreStore) findOne(ctx context.Context, entityType string, entityID int, section string, key string) (*models.RatingScore, error) {
	table, normalizedSection, err := ratingScoreTableForSection(section)
	if err != nil {
		return nil, err
	}

	var row ratingScoreRow
	query := fmt.Sprintf(`
		SELECT id, entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
		FROM %s
		WHERE entity_type = ? AND entity_id = ? AND key = ?
	`, table)
	if err := dbWrapper.Get(ctx, &row, query, entityType, entityID, key); err != nil {
		return nil, err
	}

	return row.resolve(normalizedSection), nil
}

func (s *RatingScoreStore) Upsert(ctx context.Context, score *models.RatingScore) error {
	entityType, err := normalizeRatingEntityType(score.EntityType)
	if err != nil {
		return err
	}
	table, section, err := ratingScoreTableForSection(score.Section)
	if err != nil {
		return err
	}

	key := strings.TrimSpace(score.Key)
	if key == "" {
		return fmt.Errorf("rating score key cannot be empty")
	}
	rubric, err := s.rubricForEntityCustom(ctx, entityType, score.EntityID)
	if err != nil {
		return err
	}
	rawValue, weightedValue, err := canonicalRatingScoreInputCustom(rubric, section, key, score.RawValue)
	if err != nil {
		return err
	}
	score.EntityType = entityType
	score.Section = section
	score.Key = key
	score.RawValue = rawValue
	score.WeightedValue = weightedValue

	query := fmt.Sprintf(`
		INSERT INTO %s (entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT(entity_type, entity_id, key) DO UPDATE SET
			raw_value = excluded.raw_value,
			weighted_value = excluded.weighted_value,
			label = excluded.label,
			updated_at = CURRENT_TIMESTAMP
	`, table)

	if _, err := dbWrapper.Exec(ctx, query, entityType, score.EntityID, key, score.RawValue, score.WeightedValue, score.Label); err != nil {
		return fmt.Errorf("upserting rating score: %w", err)
	}

	updated, err := s.findOne(ctx, entityType, score.EntityID, section, key)
	if err != nil {
		return fmt.Errorf("finding rating score after upsert: %w", err)
	}

	*score = *updated
	return nil
}

func (s *RatingScoreStore) Delete(ctx context.Context, entityType string, entityID int, section string, key string) (bool, error) {
	normalizedEntityType, err := normalizeRatingEntityType(entityType)
	if err != nil {
		return false, err
	}
	table, _, err := ratingScoreTableForSection(section)
	if err != nil {
		return false, err
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return false, fmt.Errorf("rating score key cannot be empty")
	}

	result, err := dbWrapper.Exec(
		ctx,
		fmt.Sprintf("DELETE FROM %s WHERE entity_type = ? AND entity_id = ? AND key = ?", table),
		normalizedEntityType,
		entityID,
		key,
	)
	if err != nil {
		return false, fmt.Errorf("deleting rating score: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("checking deleted rating score: %w", err)
	}
	return rowsAffected > 0, nil
}

func (s *RatingScoreStore) DeleteByEntity(ctx context.Context, entityType string, entityID int) error {
	normalizedEntityType, err := normalizeRatingEntityType(entityType)
	if err != nil {
		return err
	}

	for _, table := range ratingScoreTables {
		deleteQuery := fmt.Sprintf("DELETE FROM %s WHERE entity_type = ? AND entity_id = ?", table.table)
		if _, err := dbWrapper.Exec(ctx, deleteQuery, normalizedEntityType, entityID); err != nil {
			return fmt.Errorf("deleting %s advisor scores for %s %d: %w", table.section, normalizedEntityType, entityID, err)
		}
	}
	return nil
}

func (s *RatingScoreStore) RecalculateRating(ctx context.Context, entityType string, entityID int) (int, error) {
	normalizedEntityType, err := normalizeRatingEntityType(entityType)
	if err != nil {
		return 0, err
	}

	rows, err := s.scoreRowsForRating(ctx, normalizedEntityType, entityID)
	if err != nil {
		return 0, err
	}

	total := 0.0
	for _, row := range rows {
		total += canonicalRatingScoreContributionCustom(row)
	}
	rating100 := int(math.Round(math.Max(0, total) * 10))
	orgasmBonus, err := s.countOrgasmRatingBonus(ctx, normalizedEntityType, entityID)
	if err != nil {
		return 0, err
	}
	rating100 += orgasmBonus

	var table string
	switch normalizedEntityType {
	case models.RatingEntityScene:
		table = sceneTable
	case models.RatingEntityPerformer:
		table = performerTable
	default:
		return 0, fmt.Errorf("unsupported rating entity type %q", entityType)
	}

	result, err := dbWrapper.Exec(ctx, fmt.Sprintf("UPDATE %s SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", table), rating100, entityID)
	if err != nil {
		return 0, fmt.Errorf("updating %s rating: %w", normalizedEntityType, err)
	}
	if rowsAffected, err := result.RowsAffected(); err == nil && rowsAffected == 0 {
		return 0, fmt.Errorf("%s %d not found", normalizedEntityType, entityID)
	}

	return rating100, nil
}

func (s *RatingScoreStore) ResetSceneScores(ctx context.Context, sceneID int) (bool, error) {
	var scoreCount int
	query := fmt.Sprintf(`
		SELECT
			(SELECT COUNT(*) FROM %s WHERE entity_type = ? AND entity_id = ?) +
			(SELECT COUNT(*) FROM %s WHERE entity_type = ? AND entity_id = ?) +
			(SELECT COUNT(*) FROM %s WHERE entity_type = ? AND entity_id = ?)
	`, ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable)
	if err := dbWrapper.Get(
		ctx,
		&scoreCount,
		query,
		models.RatingEntityScene, sceneID,
		models.RatingEntityScene, sceneID,
		models.RatingEntityScene, sceneID,
	); err != nil {
		return false, fmt.Errorf("counting advisor scores for scene %d: %w", sceneID, err)
	}

	if scoreCount == 0 {
		return false, nil
	}

	if err := s.DeleteByEntity(ctx, models.RatingEntityScene, sceneID); err != nil {
		return false, err
	}

	if _, err := dbWrapper.Exec(ctx, fmt.Sprintf("UPDATE %s SET rating = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", sceneTable), sceneID); err != nil {
		return false, fmt.Errorf("resetting advisor rating for scene %d: %w", sceneID, err)
	}

	return true, nil
}

func (s *RatingScoreStore) ResetAllSceneScores(ctx context.Context) (int, error) {
	var sceneIDs []int
	query := fmt.Sprintf(`
		SELECT DISTINCT entity_id
		FROM (
			SELECT entity_id FROM %s WHERE entity_type = ?
			UNION ALL
			SELECT entity_id FROM %s WHERE entity_type = ?
			UNION ALL
			SELECT entity_id FROM %s WHERE entity_type = ?
		)
	`, ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable)
	if err := dbWrapper.Select(
		ctx,
		&sceneIDs,
		query,
		models.RatingEntityScene,
		models.RatingEntityScene,
		models.RatingEntityScene,
	); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return 0, fmt.Errorf("finding scene advisor scores to reset: %w", err)
	}

	resetCount := 0
	for _, sceneID := range sceneIDs {
		reset, err := s.ResetSceneScores(ctx, sceneID)
		if err != nil {
			return resetCount, err
		}
		if reset {
			resetCount++
		}
	}

	return resetCount, nil
}

func (s *RatingScoreStore) countOrgasmRatingBonus(ctx context.Context, entityType string, entityID int) (int, error) {
	var count int
	var query string

	switch entityType {
	case models.RatingEntityScene:
		query = fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s = ?", scenesODatesTable, sceneIDColumn)
	case models.RatingEntityPerformer:
		query = fmt.Sprintf(`
			SELECT COUNT(sod.%s)
			FROM %s ps
			JOIN %s sod ON sod.%s = ps.%s
			WHERE ps.%s = ?
		`, sceneODateColumn, performersScenesTable, scenesODatesTable, sceneIDColumn, sceneIDColumn, performerIDColumn)
	default:
		return 0, fmt.Errorf("unsupported rating entity type %q", entityType)
	}

	if err := dbWrapper.Get(ctx, &count, query, entityID); err != nil {
		return 0, fmt.Errorf("counting orgasm rating bonus for %s %d: %w", entityType, entityID, err)
	}

	return calculateOrgasmRatingBonus(entityType, count), nil
}

func calculateOrgasmRatingBonus(entityType string, count int) int {
	if count < 3 {
		return 0
	}

	switch entityType {
	case models.RatingEntityScene:
		return count - 2
	case models.RatingEntityPerformer:
		return 1 + ((count - 3) / 2)
	default:
		return 0
	}
}
