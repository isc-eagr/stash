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

type ratingScoreRow struct {
	ID            int            `db:"id"`
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

func (s *RatingScoreStore) FindByEntity(ctx context.Context, entityType string, entityID int) ([]*models.RatingScore, error) {
	normalizedEntityType, err := normalizeRatingEntityType(entityType)
	if err != nil {
		return nil, err
	}

	var ret []*models.RatingScore
	for _, sectionTable := range ratingScoreTables {
		var rows []ratingScoreRow
		query := fmt.Sprintf(`
			SELECT id, entity_type, entity_id, key, raw_value, weighted_value, label, created_at, updated_at
			FROM %s
			WHERE entity_type = ? AND entity_id = ?
			ORDER BY key
		`, sectionTable.table)
		if err := dbWrapper.Select(ctx, &rows, query, normalizedEntityType, entityID); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("finding rating scores in %s: %w", sectionTable.table, err)
		}

		for _, row := range rows {
			ret = append(ret, row.resolve(sectionTable.section))
		}
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

func (s *RatingScoreStore) RecalculateRating(ctx context.Context, entityType string, entityID int) (int, error) {
	normalizedEntityType, err := normalizeRatingEntityType(entityType)
	if err != nil {
		return 0, err
	}

	var total float64
	for _, sectionTable := range ratingScoreTables {
		var sectionTotal sql.NullFloat64
		query := fmt.Sprintf(`
			SELECT COALESCE(SUM(weighted_value), 0)
			FROM %s
			WHERE entity_type = ? AND entity_id = ?
		`, sectionTable.table)
		if err := dbWrapper.Get(ctx, &sectionTotal, query, normalizedEntityType, entityID); err != nil {
			return 0, fmt.Errorf("summing %s: %w", sectionTable.table, err)
		}
		if sectionTotal.Valid {
			total += sectionTotal.Float64
		}
	}

	rating100 := int(math.Round(math.Max(0, total) * 10))

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
