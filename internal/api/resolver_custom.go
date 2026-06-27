package api

// CUSTOM: This file contains all custom query resolver functions and types
// added to this fork. These are NOT present in upstream Stash.

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
)

// CUSTOM: Custom resolver types for extended GraphQL types
type performerImageResolver struct{ *Resolver }
type sceneReleaseResolver struct{ *Resolver }
type sceneMultiSegmentLoopPresetInputResolver struct{ *Resolver }

const sceneODateTrackingStart = "2024-03-08"
const sceneODateMostOsExcludedDay = "2025-09-08"

type customRatingTierThresholds struct {
	bronze        int
	silver        int
	gold          int
	royalSapphire int
}

type customRatingTierOverrideTags struct {
	bronze        string
	silver        string
	gold          string
	royalSapphire string
	goat          string
}

var defaultCustomRatingTierThresholds = customRatingTierThresholds{
	bronze:        60,
	silver:        73,
	gold:          84,
	royalSapphire: 90,
}

type sceneOEventAssociatedTagCandidate struct {
	OID      string
	MarkerID int
	IsOrgasm bool
	Tag      *models.Tag
}

// CUSTOM: Factory methods for custom resolver types
func (r *Resolver) PerformerImage() PerformerImageResolver {
	return &performerImageResolver{r}
}
func (r *Resolver) SceneRelease() SceneReleaseResolver {
	return &sceneReleaseResolver{r}
}
func (r *Resolver) SceneMultiSegmentLoopPresetInput() SceneMultiSegmentLoopPresetInputResolver {
	return &sceneMultiSegmentLoopPresetInputResolver{r}
}

// NOTE: TagFilterType resolver stub removed temporarily to allow gqlgen
// to run and generate the TagFilterTypeResolver interface. The stub will be
// re-added after code generation so we can return a no-op resolver for the
// input type fields (TagFilterType is used as an input type and doesn't
// require runtime resolution).

func (r *queryResolver) PerformerEthnicities(ctx context.Context) (ret []string, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		// Query distinct, non-empty, non-null performer ethnicities
		cols, rows, err := db.QuerySQL(ctx, "SELECT DISTINCT ethnicity FROM performers WHERE ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' ORDER BY ethnicity", nil)
		if err != nil {
			return err
		}
		_ = cols // not used
		out := make([]string, 0, len(rows))
		for _, row := range rows {
			if len(row) == 0 {
				continue
			}
			switch v := row[0].(type) {
			case string:
				out = append(out, v)
			case []byte:
				out = append(out, string(v))
			default:
				out = append(out, fmt.Sprint(v))
			}
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// PerformerEthnicityCounts returns counts of performers grouped by non-empty ethnicity,
// sorted by count descending.
func (r *queryResolver) PerformerEthnicityCounts(ctx context.Context) (ret []*PerformerEthnicityCount, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT ethnicity, COUNT(*) as cnt FROM performers WHERE ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' GROUP BY ethnicity ORDER BY cnt DESC"
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		out := make([]*PerformerEthnicityCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			var eth string
			switch v := row[0].(type) {
			case string:
				eth = v
			case []byte:
				eth = string(v)
			default:
				eth = fmt.Sprint(v)
			}
			var cnt int
			switch v := row[1].(type) {
			case int64:
				cnt = int(v)
			case int:
				cnt = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				cnt = i
			case string:
				i, _ := strconv.Atoi(v)
				cnt = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				cnt = i
			}
			out = append(out, &PerformerEthnicityCount{Ethnicity: eth, Count: cnt})
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// PerformerEthnicityFiveStarCounts returns counts of performers with a 5-star rating (rating100â†’5)
// grouped by non-empty ethnicity, sorted by count descending. Threshold is rating >= 90, consistent
// with Rating100To5 mapping (round(r/20) >= 4.5 â†’ 5).
func (r *queryResolver) PerformerEthnicityFiveStarCounts(ctx context.Context) (ret []*PerformerEthnicityCount, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT ethnicity, COUNT(*) as cnt FROM performers WHERE rating IS NOT NULL AND rating >= 90 AND ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' GROUP BY ethnicity ORDER BY cnt DESC"
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		out := make([]*PerformerEthnicityCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			var eth string
			switch v := row[0].(type) {
			case string:
				eth = v
			case []byte:
				eth = string(v)
			default:
				eth = fmt.Sprint(v)
			}
			var cnt int
			switch v := row[1].(type) {
			case int64:
				cnt = int(v)
			case int:
				cnt = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				cnt = i
			case string:
				i, _ := strconv.Atoi(v)
				cnt = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				cnt = i
			}
			out = append(out, &PerformerEthnicityCount{Ethnicity: eth, Count: cnt})
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// PerformerEthnicityTierCounts returns final metallic card-style counts grouped by
// non-empty ethnicity. It mirrors the performers metallic_rating filter semantics,
// including override tags and higher-priority override precedence.
func (r *queryResolver) PerformerEthnicityTierCounts(ctx context.Context) (ret []*PerformerEthnicityTierCount, err error) {
	thresholds := getCustomPerformerRatingTierThresholds()
	overrides := getCustomRatingTierOverrideTags()
	bronzeClause, bronzeArgs := customRatingTierSQLClause("bronze", thresholds, overrides)
	silverClause, silverArgs := customRatingTierSQLClause("silver", thresholds, overrides)
	goldClause, goldArgs := customRatingTierSQLClause("gold", thresholds, overrides)
	royalSapphireClause, royalSapphireArgs := customRatingTierSQLClause("royal_sapphire", thresholds, overrides)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := fmt.Sprintf(`
SELECT
  ethnicity,
  SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS bronze_count,
  SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS silver_count,
  SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS gold_count,
  SUM(CASE WHEN %s THEN 1 ELSE 0 END) AS royal_sapphire_count
FROM performers
WHERE ethnicity IS NOT NULL
  AND TRIM(ethnicity) <> ''
GROUP BY ethnicity
HAVING bronze_count + silver_count + gold_count + royal_sapphire_count > 0
ORDER BY bronze_count + silver_count + gold_count + royal_sapphire_count DESC, ethnicity ASC`,
			bronzeClause,
			silverClause,
			goldClause,
			royalSapphireClause,
		)
		args := append([]interface{}{}, bronzeArgs...)
		args = append(args, silverArgs...)
		args = append(args, goldArgs...)
		args = append(args, royalSapphireArgs...)
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		out := make([]*PerformerEthnicityTierCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 5 {
				continue
			}
			out = append(out, &PerformerEthnicityTierCount{
				Ethnicity:     customStringValue(row[0]),
				Bronze:        customIntValue(row[1]),
				Silver:        customIntValue(row[2]),
				Gold:          customIntValue(row[3]),
				RoyalSapphire: customIntValue(row[4]),
			})
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func customRatingTierSQLClause(tier string, thresholds customRatingTierThresholds, overrides customRatingTierOverrideTags) (string, []interface{}) {
	var clauses []string
	var args []interface{}

	if overrideTagIDs := customOverrideTagIDsForTier(tier, overrides); len(overrideTagIDs) > 0 {
		noHigherPriorityClause, noHigherPriorityArgs := customHasNoAnyPerformerTagClause(
			customHigherPriorityOverrideTagIDsForTier(tier, overrides),
		)
		hasOverrideClause, hasOverrideArgs := customHasAnyPerformerTagClause(overrideTagIDs)
		clauses = append(clauses, fmt.Sprintf("(%s AND %s)", noHigherPriorityClause, hasOverrideClause))
		args = append(args, noHigherPriorityArgs...)
		args = append(args, hasOverrideArgs...)
	}

	noOverrideClause, noOverrideArgs := customHasNoAnyPerformerTagClause(customAllOverrideTagIDs(overrides))
	ratingClause, ratingArgs := customRatingRangeSQLClause(tier, thresholds)
	clauses = append(clauses, fmt.Sprintf("(%s AND %s)", noOverrideClause, ratingClause))
	args = append(args, noOverrideArgs...)
	args = append(args, ratingArgs...)

	return "(" + strings.Join(clauses, " OR ") + ")", args
}

func customRatingRangeSQLClause(tier string, thresholds customRatingTierThresholds) (string, []interface{}) {
	switch tier {
	case "bronze":
		return "rating >= ? AND rating < ?", []interface{}{thresholds.bronze, thresholds.silver}
	case "silver":
		return "rating >= ? AND rating < ?", []interface{}{thresholds.silver, thresholds.gold}
	case "gold":
		return "rating >= ? AND rating < ?", []interface{}{thresholds.gold, thresholds.royalSapphire}
	case "royal_sapphire":
		return "rating >= ?", []interface{}{thresholds.royalSapphire}
	default:
		return "0 = 1", nil
	}
}

func customOverrideTagIDsForTier(tier string, overrides customRatingTierOverrideTags) []string {
	switch tier {
	case "bronze":
		return customNonEmptyStrings(overrides.bronze)
	case "silver":
		return customNonEmptyStrings(overrides.silver)
	case "gold":
		return customNonEmptyStrings(overrides.gold)
	case "royal_sapphire":
		return customNonEmptyStrings(overrides.royalSapphire, overrides.goat)
	default:
		return nil
	}
}

func customHigherPriorityOverrideTagIDsForTier(tier string, overrides customRatingTierOverrideTags) []string {
	switch tier {
	case "bronze":
		return customNonEmptyStrings(overrides.silver, overrides.gold, overrides.royalSapphire, overrides.goat)
	case "silver":
		return customNonEmptyStrings(overrides.gold, overrides.royalSapphire, overrides.goat)
	case "gold":
		return customNonEmptyStrings(overrides.royalSapphire, overrides.goat)
	default:
		return nil
	}
}

func customAllOverrideTagIDs(overrides customRatingTierOverrideTags) []string {
	return customNonEmptyStrings(
		overrides.bronze,
		overrides.silver,
		overrides.gold,
		overrides.royalSapphire,
		overrides.goat,
	)
}

func customHasAnyPerformerTagClause(tagIDs []string) (string, []interface{}) {
	if len(tagIDs) == 0 {
		return "0 = 1", nil
	}

	placeholders := strings.TrimRight(strings.Repeat("?,", len(tagIDs)), ",")
	return fmt.Sprintf(
		"EXISTS (SELECT 1 FROM performers_tags prt WHERE prt.performer_id = performers.id AND prt.tag_id IN (%s))",
		placeholders,
	), customStringSliceToInterfaces(tagIDs)
}

func customHasNoAnyPerformerTagClause(tagIDs []string) (string, []interface{}) {
	if len(tagIDs) == 0 {
		return "1 = 1", nil
	}

	hasAnyClause, args := customHasAnyPerformerTagClause(tagIDs)
	return "NOT " + hasAnyClause, args
}

func getCustomPerformerRatingTierThresholds() customRatingTierThresholds {
	ret := defaultCustomRatingTierThresholds
	uiConfig := config.GetInstance().GetUIConfiguration()
	thresholds := customMapValue(uiConfig, "ratingCardThresholds")
	if performerThresholds := customMapValue(thresholds, "performer"); performerThresholds != nil {
		applyCustomRatingTierThresholds(&ret, performerThresholds)
	} else {
		applyCustomRatingTierThresholds(&ret, thresholds)
	}
	return ret
}

func getCustomRatingTierOverrideTags() customRatingTierOverrideTags {
	uiConfig := config.GetInstance().GetUIConfiguration()
	overrideTags := customMapValue(uiConfig, "ratingCardOverrideTagIds")
	roleTags := customMapValue(uiConfig, "roleTagIds")

	return customRatingTierOverrideTags{
		bronze:        customStringConfigValue(overrideTags["bronzeTagId"]),
		silver:        customStringConfigValue(overrideTags["silverTagId"]),
		gold:          customStringConfigValue(overrideTags["goldTagId"]),
		royalSapphire: customStringConfigValue(overrideTags["royalSapphireTagId"]),
		goat:          customStringConfigValue(roleTags["goatTagId"]),
	}
}

func applyCustomRatingTierThresholds(thresholds *customRatingTierThresholds, values map[string]interface{}) {
	if values == nil {
		return
	}
	if value, ok := customIntConfigValue(values["bronze"]); ok {
		thresholds.bronze = customClampRatingThreshold(value)
	}
	if value, ok := customIntConfigValue(values["silver"]); ok {
		thresholds.silver = customClampRatingThreshold(value)
	}
	if value, ok := customIntConfigValue(values["gold"]); ok {
		thresholds.gold = customClampRatingThreshold(value)
	}
	if value, ok := customIntConfigValue(values["royalSapphire"]); ok {
		thresholds.royalSapphire = customClampRatingThreshold(value)
	}
}

func customStringConfigValue(value interface{}) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func customMapValue(values map[string]interface{}, key string) map[string]interface{} {
	if values == nil {
		return nil
	}
	switch typed := values[key].(type) {
	case map[string]interface{}:
		return typed
	case map[interface{}]interface{}:
		ret := make(map[string]interface{}, len(typed))
		for k, v := range typed {
			if keyString, ok := k.(string); ok {
				ret[keyString] = v
			}
		}
		return ret
	default:
		return nil
	}
}

func customNonEmptyStrings(values ...string) []string {
	var ret []string
	seen := map[string]bool{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" && !seen[trimmed] {
			ret = append(ret, trimmed)
			seen[trimmed] = true
		}
	}
	return ret
}

func customStringSliceToInterfaces(values []string) []interface{} {
	ret := make([]interface{}, len(values))
	for i, value := range values {
		ret[i] = value
	}
	return ret
}

func customIntConfigValue(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	case float32:
		return int(typed), true
	case string:
		parsed, err := strconv.Atoi(typed)
		return parsed, err == nil
	default:
		return 0, false
	}
}

func customClampRatingThreshold(value int) int {
	if value < 0 {
		return 0
	}
	return value
}

func customStringValue(value interface{}) string {
	switch typed := value.(type) {
	case time.Time:
		return typed.Format(time.RFC3339)
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		return fmt.Sprint(typed)
	}
}

func customIntValue(value interface{}) int {
	switch typed := value.(type) {
	case int64:
		return int(typed)
	case int:
		return typed
	case []byte:
		i, _ := strconv.Atoi(string(typed))
		return i
	case string:
		i, _ := strconv.Atoi(typed)
		return i
	default:
		i, _ := strconv.Atoi(fmt.Sprint(typed))
		return i
	}
}

func customFloatPtrValue(value interface{}) *float64 {
	if value == nil {
		return nil
	}

	var out float64
	switch typed := value.(type) {
	case float64:
		out = typed
	case float32:
		out = float64(typed)
	case int64:
		out = float64(typed)
	case int:
		out = float64(typed)
	case []byte:
		v, err := strconv.ParseFloat(string(typed), 64)
		if err != nil {
			return nil
		}
		out = v
	case string:
		v, err := strconv.ParseFloat(typed, 64)
		if err != nil {
			return nil
		}
		out = v
	default:
		v, err := strconv.ParseFloat(fmt.Sprint(typed), 64)
		if err != nil {
			return nil
		}
		out = v
	}

	return &out
}

func sceneOStatsDate(year int, month int, day int) (string, error) {
	if year < 1 || month < 1 || month > 12 || day < 1 || day > 31 {
		return "", fmt.Errorf("invalid date: %04d-%02d-%02d", year, month, day)
	}

	date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if date.Year() != year || int(date.Month()) != month || date.Day() != day {
		return "", fmt.Errorf("invalid date: %04d-%02d-%02d", year, month, day)
	}

	return date.Format("2006-01-02"), nil
}

func validateSceneOStatsDate(value string) (string, error) {
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		return "", fmt.Errorf("invalid date %q: expected YYYY-MM-DD", value)
	}

	return date.Format("2006-01-02"), nil
}

// SceneOYearCounts returns counts of scene orgasm events grouped by year ascending.
func (r *queryResolver) SceneOYearCounts(ctx context.Context) (ret []*SceneOYearCount, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT CAST(strftime('%Y', o_date, 'localtime') AS INT) AS year, COUNT(*) AS cnt FROM scenes_o_dates WHERE o_date IS NOT NULL AND date(o_date, 'localtime') >= date(?) GROUP BY year ORDER BY year ASC"
		_, rows, err := db.QuerySQL(ctx, query, []interface{}{sceneODateTrackingStart})
		if err != nil {
			return err
		}
		out := make([]*SceneOYearCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			var yearInt int
			switch v := row[0].(type) {
			case int64:
				yearInt = int(v)
			case int:
				yearInt = v
			case []byte:
				y, _ := strconv.Atoi(string(v))
				yearInt = y
			case string:
				y, _ := strconv.Atoi(v)
				yearInt = y
			default:
				y, _ := strconv.Atoi(fmt.Sprint(v))
				yearInt = y
			}
			var cnt int
			switch v := row[1].(type) {
			case int64:
				cnt = int(v)
			case int:
				cnt = v
			case []byte:
				c, _ := strconv.Atoi(string(v))
				cnt = c
			case string:
				c, _ := strconv.Atoi(v)
				cnt = c
			default:
				c, _ := strconv.Atoi(fmt.Sprint(v))
				cnt = c
			}
			out = append(out, &SceneOYearCount{Year: yearInt, Count: cnt})
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// SceneOMonthCounts returns counts of scene O events grouped by month for a year.
func (r *queryResolver) SceneOMonthCounts(ctx context.Context, year int) (ret []*SceneOMonthCount, err error) {
	if year < 1 {
		return nil, fmt.Errorf("invalid year: %d", year)
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := `
SELECT CAST(strftime('%m', o_date, 'localtime') AS INT) AS month, COUNT(*) AS cnt
FROM scenes_o_dates
WHERE o_date IS NOT NULL
  AND date(o_date, 'localtime') >= date(?)
  AND CAST(strftime('%Y', o_date, 'localtime') AS INT) = ?
GROUP BY month
ORDER BY month ASC`
		_, rows, err := db.QuerySQL(ctx, query, []interface{}{sceneODateTrackingStart, year})
		if err != nil {
			return err
		}

		out := make([]*SceneOMonthCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			out = append(out, &SceneOMonthCount{
				Year:  year,
				Month: customIntValue(row[0]),
				Count: customIntValue(row[1]),
			})
		}

		ret = out
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// SceneODayCounts returns counts of scene O events grouped by day for a month.
func (r *queryResolver) SceneODayCounts(ctx context.Context, year int, month int) (ret []*SceneODayCount, err error) {
	if _, err := sceneOStatsDate(year, month, 1); err != nil {
		return nil, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := `
SELECT date(o_date, 'localtime') AS day_date, CAST(strftime('%d', o_date, 'localtime') AS INT) AS day, COUNT(*) AS cnt
FROM scenes_o_dates
WHERE o_date IS NOT NULL
  AND date(o_date, 'localtime') >= date(?)
  AND CAST(strftime('%Y', o_date, 'localtime') AS INT) = ?
  AND CAST(strftime('%m', o_date, 'localtime') AS INT) = ?
GROUP BY day_date, day
ORDER BY day ASC`
		_, rows, err := db.QuerySQL(ctx, query, []interface{}{sceneODateTrackingStart, year, month})
		if err != nil {
			return err
		}

		out := make([]*SceneODayCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 3 {
				continue
			}
			out = append(out, &SceneODayCount{
				Date:  customStringValue(row[0]),
				Day:   customIntValue(row[1]),
				Count: customIntValue(row[2]),
			})
		}

		ret = out
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// SceneOEventsByDate returns the recorded O events for a date in chronological order.
func (r *queryResolver) SceneOEventsByDate(ctx context.Context, date string) (ret []*SceneOEvent, err error) {
	date, err = validateSceneOStatsDate(date)
	if err != nil {
		return nil, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := `
SELECT od.rowid, od.scene_id, od.o_date, od.video_timestamp
FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
WHERE od.o_date IS NOT NULL AND date(od.o_date, 'localtime') = date(?)
  AND date(od.o_date, 'localtime') >= date(?)
ORDER BY datetime(od.o_date, 'localtime') ASC, COALESCE(od.video_timestamp, -1) ASC, s.title ASC`
		_, rows, err := db.QuerySQL(ctx, query, []interface{}{date, sceneODateTrackingStart})
		if err != nil {
			return err
		}

		out := make([]*SceneOEvent, 0, len(rows))
		for _, row := range rows {
			if len(row) < 4 {
				continue
			}

			sceneID := customIntValue(row[1])
			scene, err := r.repository.Scene.Find(ctx, sceneID)
			if err != nil {
				return err
			}
			if scene == nil {
				continue
			}

			out = append(out, &SceneOEvent{
				ID:             fmt.Sprint(row[0]),
				SceneID:        fmt.Sprint(sceneID),
				ODate:          customStringValue(row[2]),
				VideoTimestamp: customFloatPtrValue(row[3]),
				Scene:          scene,
			})
		}

		if err := r.populateSceneOEventAssociatedTags(ctx, out); err != nil {
			return err
		}

		ret = out
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// SceneOEventsByTag returns recorded O events covered by the given marker tag.
func (r *queryResolver) SceneOEventsByTag(ctx context.Context, tagID string) (ret []*SceneOEvent, err error) {
	tagIDInt, err := strconv.Atoi(tagID)
	if err != nil || tagIDInt < 1 {
		return nil, fmt.Errorf("invalid tag ID: %s", tagID)
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var orgasmTagID int
		if roleTagIds != nil {
			if orgasmID, ok := roleTagIds["orgasmTagId"].(string); ok && orgasmID != "" {
				orgasmTagID, _ = strconv.Atoi(orgasmID)
			}
		}

		var query string
		var args []interface{}
		if orgasmTagID != 0 {
			query = `
WITH RECURSIVE orgasm_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN orgasm_tags ot ON tr.parent_id = ot.id
),
covered_markers AS (
  SELECT
    od.rowid AS o_id,
    sm.id AS marker_id,
    CASE
      WHEN sm.primary_tag_id IN (SELECT id FROM orgasm_tags)
        OR EXISTS (
          SELECT 1 FROM scene_markers_tags smt
          WHERE smt.scene_marker_id = sm.id
            AND smt.tag_id IN (SELECT id FROM orgasm_tags)
        )
      THEN 1 ELSE 0
    END AS is_orgasm
  FROM scenes_o_dates od
  JOIN scene_markers sm ON sm.scene_id = od.scene_id
  WHERE od.video_timestamp IS NOT NULL
    AND od.o_date IS NOT NULL
    AND date(od.o_date, 'localtime') >= date(?)
    AND sm.end_seconds IS NOT NULL
    AND od.video_timestamp >= sm.seconds
    AND od.video_timestamp <= sm.end_seconds
),
selected_markers AS (
  SELECT cm.o_id, cm.marker_id
  FROM covered_markers cm
  WHERE cm.is_orgasm = 1
     OR NOT EXISTS (
       SELECT 1 FROM covered_markers orgasm_cm
       WHERE orgasm_cm.o_id = cm.o_id
         AND orgasm_cm.is_orgasm = 1
     )
),
tagged_o_events AS (
  SELECT DISTINCT smk.o_id
  FROM selected_markers smk
  JOIN scene_markers sm ON sm.id = smk.marker_id
  WHERE sm.primary_tag_id = ?
     OR EXISTS (
       SELECT 1 FROM scene_markers_tags smt
       WHERE smt.scene_marker_id = smk.marker_id
         AND smt.tag_id = ?
     )
)
SELECT od.rowid, od.scene_id, od.o_date, od.video_timestamp
FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
JOIN tagged_o_events toe ON toe.o_id = od.rowid
ORDER BY datetime(od.o_date, 'localtime') DESC, COALESCE(od.video_timestamp, -1) ASC, s.title ASC`
			args = []interface{}{orgasmTagID, sceneODateTrackingStart, tagIDInt, tagIDInt}
		} else {
			query = `
WITH tagged_o_events AS (
  SELECT DISTINCT od.rowid AS o_id
  FROM scenes_o_dates od
  JOIN scene_markers sm ON sm.scene_id = od.scene_id
  WHERE od.video_timestamp IS NOT NULL
    AND od.o_date IS NOT NULL
    AND date(od.o_date, 'localtime') >= date(?)
    AND sm.end_seconds IS NOT NULL
    AND od.video_timestamp >= sm.seconds
    AND od.video_timestamp <= sm.end_seconds
    AND (
      sm.primary_tag_id = ?
      OR EXISTS (
        SELECT 1 FROM scene_markers_tags smt
        WHERE smt.scene_marker_id = sm.id
          AND smt.tag_id = ?
      )
    )
)
SELECT od.rowid, od.scene_id, od.o_date, od.video_timestamp
FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
JOIN tagged_o_events toe ON toe.o_id = od.rowid
ORDER BY datetime(od.o_date, 'localtime') DESC, COALESCE(od.video_timestamp, -1) ASC, s.title ASC`
			args = []interface{}{sceneODateTrackingStart, tagIDInt, tagIDInt}
		}

		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}

		out := make([]*SceneOEvent, 0, len(rows))
		for _, row := range rows {
			if len(row) < 4 {
				continue
			}

			sceneID := customIntValue(row[1])
			scene, err := r.repository.Scene.Find(ctx, sceneID)
			if err != nil {
				return err
			}
			if scene == nil {
				continue
			}

			out = append(out, &SceneOEvent{
				ID:             fmt.Sprint(row[0]),
				SceneID:        fmt.Sprint(sceneID),
				ODate:          customStringValue(row[2]),
				VideoTimestamp: customFloatPtrValue(row[3]),
				Scene:          scene,
			})
		}

		if err := r.populateSceneOEventAssociatedTags(ctx, out); err != nil {
			return err
		}

		ret = out
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// SceneOCountsByTag returns timestamped scene O events grouped by marker tags
// covering each event's video timestamp. Primary and secondary marker tags are
// both counted, with each tag counted once per O event.
func (r *queryResolver) SceneOCountsByTag(ctx context.Context) (ret []*SceneOCountByTag, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var orgasmTagID int
		if roleTagIds != nil {
			if orgasmID, ok := roleTagIds["orgasmTagId"].(string); ok && orgasmID != "" {
				orgasmTagID, _ = strconv.Atoi(orgasmID)
			}
		}

		var query string
		var args []interface{}
		if orgasmTagID != 0 {
			query = `
WITH RECURSIVE orgasm_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN orgasm_tags ot ON tr.parent_id = ot.id
),
covered_markers AS (
  SELECT
    od.rowid AS o_id,
    sm.id AS marker_id,
    CASE
      WHEN sm.primary_tag_id IN (SELECT id FROM orgasm_tags)
        OR EXISTS (
          SELECT 1 FROM scene_markers_tags smt
          WHERE smt.scene_marker_id = sm.id
            AND smt.tag_id IN (SELECT id FROM orgasm_tags)
        )
      THEN 1 ELSE 0
    END AS is_orgasm
  FROM scenes_o_dates od
  JOIN scene_markers sm ON sm.scene_id = od.scene_id
  WHERE od.video_timestamp IS NOT NULL
    AND od.o_date IS NOT NULL
    AND date(od.o_date, 'localtime') >= date(?)
    AND sm.end_seconds IS NOT NULL
    AND od.video_timestamp >= sm.seconds
    AND od.video_timestamp <= sm.end_seconds
),
selected_markers AS (
  SELECT cm.o_id, cm.marker_id
  FROM covered_markers cm
  WHERE cm.is_orgasm = 1
     OR NOT EXISTS (
       SELECT 1 FROM covered_markers orgasm_cm
       WHERE orgasm_cm.o_id = cm.o_id
         AND orgasm_cm.is_orgasm = 1
     )
),
covered_o_tags AS (
  SELECT DISTINCT
    smk.o_id,
    t.id AS tag_id,
    t.name AS tag_name
  FROM selected_markers smk
  JOIN scene_markers sm ON sm.id = smk.marker_id
  JOIN tags t ON t.id = sm.primary_tag_id

  UNION

  SELECT DISTINCT
    smk.o_id,
    t.id AS tag_id,
    t.name AS tag_name
  FROM selected_markers smk
  JOIN scene_markers_tags smt ON smt.scene_marker_id = smk.marker_id
  JOIN tags t ON t.id = smt.tag_id
)
SELECT tag_id, tag_name, COUNT(*) AS cnt
FROM covered_o_tags
GROUP BY tag_id, tag_name
ORDER BY cnt DESC, tag_name ASC`
			args = []interface{}{orgasmTagID, sceneODateTrackingStart}
		} else {
			query = `
WITH covered_o_tags AS (
  SELECT DISTINCT
    od.scene_id,
    od.o_date,
    od.video_timestamp,
    t.id AS tag_id,
    t.name AS tag_name
  FROM scenes_o_dates od
  JOIN scene_markers sm ON sm.scene_id = od.scene_id
  JOIN tags t ON t.id = sm.primary_tag_id
  WHERE od.video_timestamp IS NOT NULL
    AND od.o_date IS NOT NULL
    AND date(od.o_date, 'localtime') >= date(?)
    AND sm.end_seconds IS NOT NULL
    AND od.video_timestamp >= sm.seconds
    AND od.video_timestamp <= sm.end_seconds

  UNION

  SELECT DISTINCT
    od.scene_id,
    od.o_date,
    od.video_timestamp,
    t.id AS tag_id,
    t.name AS tag_name
  FROM scenes_o_dates od
  JOIN scene_markers sm ON sm.scene_id = od.scene_id
  JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  JOIN tags t ON t.id = smt.tag_id
  WHERE od.video_timestamp IS NOT NULL
    AND od.o_date IS NOT NULL
    AND date(od.o_date, 'localtime') >= date(?)
    AND sm.end_seconds IS NOT NULL
    AND od.video_timestamp >= sm.seconds
    AND od.video_timestamp <= sm.end_seconds
)
SELECT tag_id, tag_name, COUNT(*) AS cnt
FROM covered_o_tags
GROUP BY tag_id, tag_name
ORDER BY cnt DESC, tag_name ASC`
			args = []interface{}{sceneODateTrackingStart, sceneODateTrackingStart}
		}

		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}

		out := make([]*SceneOCountByTag, 0, len(rows))
		for _, row := range rows {
			if len(row) < 3 {
				continue
			}

			out = append(out, &SceneOCountByTag{
				TagID:   fmt.Sprint(row[0]),
				TagName: fmt.Sprint(row[1]),
				Count:   customIntValue(row[2]),
			})
		}

		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func vatoStatsEthnicityLabel(value interface{}) string {
	ret := strings.TrimSpace(customStringValue(value))
	if ret == "" || strings.EqualFold(ret, "<nil>") || strings.EqualFold(ret, "null") {
		return "Unknown"
	}
	return ret
}

func sceneOStatsEthnicityFilter(value string) (string, error) {
	ret := strings.TrimSpace(value)
	if ret == "" {
		return "", fmt.Errorf("ethnicity is required")
	}
	return ret, nil
}

func sceneOOrgasmTagID() int {
	uiConfig := config.GetInstance().GetUIConfiguration()
	roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
	if roleTagIds == nil {
		return 0
	}

	orgasmID, _ := roleTagIds["orgasmTagId"].(string)
	if orgasmID == "" {
		return 0
	}

	ret, _ := strconv.Atoi(orgasmID)
	return ret
}

func sceneOEventAssociatedTagsFromCandidates(candidates []sceneOEventAssociatedTagCandidate) map[string][]*models.Tag {
	hasOrgasmMarker := make(map[string]bool)
	for _, candidate := range candidates {
		if candidate.IsOrgasm {
			hasOrgasmMarker[candidate.OID] = true
		}
	}

	seen := make(map[string]map[int]bool)
	ret := make(map[string][]*models.Tag)
	for _, candidate := range candidates {
		if candidate.Tag == nil {
			continue
		}
		if hasOrgasmMarker[candidate.OID] && !candidate.IsOrgasm {
			continue
		}
		if seen[candidate.OID] == nil {
			seen[candidate.OID] = make(map[int]bool)
		}
		if seen[candidate.OID][candidate.Tag.ID] {
			continue
		}

		seen[candidate.OID][candidate.Tag.ID] = true
		ret[candidate.OID] = append(ret[candidate.OID], candidate.Tag)
	}

	return ret
}

func sceneOEventAssociatedTagsQuery(placeholders string, includeOrgasmTagPriority bool) string {
	orgasmCTE := ""
	isOrgasmExpression := "0"
	if includeOrgasmTagPriority {
		orgasmCTE = `RECURSIVE orgasm_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN orgasm_tags ot ON tr.parent_id = ot.id
),
`
		isOrgasmExpression = `CASE
      WHEN sm.primary_tag_id IN (SELECT id FROM orgasm_tags)
        OR EXISTS (
          SELECT 1 FROM scene_markers_tags smt_orgasm
          WHERE smt_orgasm.scene_marker_id = sm.id
            AND smt_orgasm.tag_id IN (SELECT id FROM orgasm_tags)
        )
      THEN 1 ELSE 0
    END`
	}

	return fmt.Sprintf(`
WITH %scovered_marker_tags AS (
  SELECT
    od.rowid AS o_id,
    sm.id AS marker_id,
    %s AS is_orgasm,
    t.id AS tag_id,
    t.name AS tag_name,
    0 AS tag_sort
  FROM scenes_o_dates od
  JOIN scene_markers sm ON sm.scene_id = od.scene_id
  JOIN tags t ON t.id = sm.primary_tag_id
  WHERE od.rowid IN (%s)
    AND od.video_timestamp IS NOT NULL
    AND sm.end_seconds IS NOT NULL
    AND od.video_timestamp >= sm.seconds
    AND od.video_timestamp <= sm.end_seconds

  UNION

  SELECT
    od.rowid AS o_id,
    sm.id AS marker_id,
    %s AS is_orgasm,
    t.id AS tag_id,
    t.name AS tag_name,
    1 AS tag_sort
  FROM scenes_o_dates od
  JOIN scene_markers sm ON sm.scene_id = od.scene_id
  JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  JOIN tags t ON t.id = smt.tag_id
  WHERE od.rowid IN (%s)
    AND od.video_timestamp IS NOT NULL
    AND sm.end_seconds IS NOT NULL
    AND od.video_timestamp >= sm.seconds
    AND od.video_timestamp <= sm.end_seconds
)
SELECT o_id, marker_id, is_orgasm, tag_id, tag_name
FROM covered_marker_tags
ORDER BY o_id, marker_id, tag_sort, tag_name COLLATE NOCASE`, orgasmCTE, isOrgasmExpression, placeholders, isOrgasmExpression, placeholders)
}

func sceneOEventIDChunk(ids []int, start int, size int) []int {
	end := start + size
	if end > len(ids) {
		end = len(ids)
	}
	return ids[start:end]
}

func sceneOEventIDPlaceholders(ids []int) (string, []interface{}) {
	placeholders := make([]string, 0, len(ids))
	args := make([]interface{}, 0, len(ids))
	for _, id := range ids {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	return strings.Join(placeholders, ","), args
}

func (r *queryResolver) populateSceneOEventAssociatedTags(ctx context.Context, events []*SceneOEvent) error {
	for _, event := range events {
		event.AssociatedTags = []*models.Tag{}
	}

	byID := make(map[string]*SceneOEvent, len(events))
	ids := make([]int, 0, len(events))
	for _, event := range events {
		if event.VideoTimestamp == nil {
			continue
		}
		id, err := strconv.Atoi(event.ID)
		if err != nil {
			continue
		}
		byID[event.ID] = event
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil
	}

	db := manager.GetInstance().Database
	orgasmTagID := sceneOOrgasmTagID()
	candidates := []sceneOEventAssociatedTagCandidate{}
	for start := 0; start < len(ids); start += 450 {
		chunk := sceneOEventIDChunk(ids, start, 450)
		placeholders, idArgs := sceneOEventIDPlaceholders(chunk)
		query := sceneOEventAssociatedTagsQuery(placeholders, orgasmTagID != 0)

		args := make([]interface{}, 0, len(idArgs)*2+1)
		if orgasmTagID != 0 {
			args = append(args, orgasmTagID)
		}
		args = append(args, idArgs...)
		args = append(args, idArgs...)

		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}

		for _, row := range rows {
			if len(row) < 5 {
				continue
			}
			candidates = append(candidates, sceneOEventAssociatedTagCandidate{
				OID:      fmt.Sprint(row[0]),
				MarkerID: customIntValue(row[1]),
				IsOrgasm: customIntValue(row[2]) == 1,
				Tag: &models.Tag{
					ID:   customIntValue(row[3]),
					Name: customStringValue(row[4]),
				},
			})
		}
	}

	associatedTags := sceneOEventAssociatedTagsFromCandidates(candidates)
	for oID, tags := range associatedTags {
		if event := byID[oID]; event != nil {
			event.AssociatedTags = tags
		}
	}

	return nil
}

func (r *queryResolver) sceneOEventsFromRows(ctx context.Context, rows [][]interface{}) ([]*SceneOEvent, error) {
	out := make([]*SceneOEvent, 0, len(rows))
	for _, row := range rows {
		if len(row) < 4 {
			continue
		}

		sceneID := customIntValue(row[1])
		scene, err := r.repository.Scene.Find(ctx, sceneID)
		if err != nil {
			return nil, err
		}
		if scene == nil {
			continue
		}

		out = append(out, &SceneOEvent{
			ID:             fmt.Sprint(row[0]),
			SceneID:        fmt.Sprint(sceneID),
			ODate:          customStringValue(row[2]),
			VideoTimestamp: customFloatPtrValue(row[3]),
			Scene:          scene,
		})
	}

	if err := r.populateSceneOEventAssociatedTags(ctx, out); err != nil {
		return nil, err
	}

	return out, nil
}

// SceneOCountsByEthnicity returns reliable O events grouped by the ethnicities
// of performers associated with each O's scene.
func (r *queryResolver) SceneOCountsByEthnicity(ctx context.Context) (ret []*SceneOCountByEthnicity, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := `
WITH o_ethnicities AS (
  SELECT DISTINCT
    od.rowid AS o_id,
    CASE
      WHEN performers.ethnicity IS NULL OR TRIM(performers.ethnicity) = '' OR LOWER(TRIM(performers.ethnicity)) IN ('<nil>', 'null')
      THEN 'Unknown'
      ELSE TRIM(performers.ethnicity)
    END AS ethnicity
  FROM scenes_o_dates od
  LEFT JOIN performers_scenes ps ON ps.scene_id = od.scene_id
  LEFT JOIN performers ON performers.id = ps.performer_id
  WHERE od.o_date IS NOT NULL
    AND date(od.o_date, 'localtime') >= date(?)
)
SELECT ethnicity, COUNT(*) AS cnt
FROM o_ethnicities
GROUP BY ethnicity
ORDER BY cnt DESC, ethnicity COLLATE NOCASE ASC`
		_, rows, err := db.QuerySQL(ctx, query, []interface{}{sceneODateTrackingStart})
		if err != nil {
			return err
		}

		out := make([]*SceneOCountByEthnicity, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			out = append(out, &SceneOCountByEthnicity{
				Ethnicity: vatoStatsEthnicityLabel(row[0]),
				Count:     customIntValue(row[1]),
			})
		}

		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// SceneOEventsByEthnicity returns reliable O events for scenes with an
// associated performer ethnicity. "Unknown" includes missing/blank ethnicity.
func (r *queryResolver) SceneOEventsByEthnicity(ctx context.Context, ethnicity string) (ret []*SceneOEvent, err error) {
	ethnicity, err = sceneOStatsEthnicityFilter(ethnicity)
	if err != nil {
		return nil, err
	}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		unknown := strings.EqualFold(ethnicity, "Unknown")
		ethnicityPredicate := `
  AND EXISTS (
    SELECT 1
    FROM performers_scenes ps
    JOIN performers ON performers.id = ps.performer_id
    WHERE ps.scene_id = od.scene_id
      AND TRIM(performers.ethnicity) = ?
  )`
		args := []interface{}{sceneODateTrackingStart, ethnicity}
		if unknown {
			ethnicityPredicate = `
  AND (
    NOT EXISTS (
      SELECT 1
      FROM performers_scenes known_ps
      JOIN performers known_p ON known_p.id = known_ps.performer_id
      WHERE known_ps.scene_id = od.scene_id
        AND known_p.ethnicity IS NOT NULL
        AND TRIM(known_p.ethnicity) <> ''
        AND LOWER(TRIM(known_p.ethnicity)) NOT IN ('<nil>', 'null')
    )
    OR EXISTS (
      SELECT 1
      FROM performers_scenes unknown_ps
      LEFT JOIN performers unknown_p ON unknown_p.id = unknown_ps.performer_id
      WHERE unknown_ps.scene_id = od.scene_id
        AND (unknown_p.ethnicity IS NULL OR TRIM(unknown_p.ethnicity) = '' OR LOWER(TRIM(unknown_p.ethnicity)) IN ('<nil>', 'null'))
    )
  )`
			args = []interface{}{sceneODateTrackingStart}
		}
		query := fmt.Sprintf(`
SELECT od.rowid, od.scene_id, od.o_date, od.video_timestamp
FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
WHERE od.o_date IS NOT NULL
  AND date(od.o_date, 'localtime') >= date(?)
  %s
ORDER BY datetime(od.o_date, 'localtime') DESC, COALESCE(od.video_timestamp, -1) ASC, s.title ASC`, ethnicityPredicate)
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}

		out, err := r.sceneOEventsFromRows(ctx, rows)
		if err != nil {
			return err
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func vatoStatsStringPtrValue(value interface{}) *string {
	ret := strings.TrimSpace(customStringValue(value))
	if ret == "" || strings.EqualFold(ret, "<nil>") || strings.EqualFold(ret, "null") {
		return nil
	}
	return &ret
}

func vatoStatsIntPtrValue(value interface{}) *int {
	if value == nil {
		return nil
	}
	ret := customIntValue(value)
	return &ret
}

func vatoStatsAgeRange(age int) string {
	return strconv.Itoa(age)
}

func vatoStatsImagePath(baseURL string, performerID int, hasImage bool) *string {
	ret := fmt.Sprintf("%s/performer/%d/image?t=0", baseURL, performerID)
	if !hasImage {
		ret += "&default=true"
	}
	return &ret
}

func vatoStatsIDFilter(column string, ids []int) (string, []interface{}) {
	if len(ids) == 0 || len(ids) > 900 {
		return "", nil
	}

	placeholders := make([]string, 0, len(ids))
	args := make([]interface{}, 0, len(ids))
	for _, id := range ids {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	return fmt.Sprintf(" AND %s IN (%s)", column, strings.Join(placeholders, ",")), args
}

func vatoStatsSetAgeCount(performer *VatoStatsPerformer, ageRange string, count int) {
	for _, row := range performer.AgeCounts {
		if row.AgeRange == ageRange {
			row.Count += count
			return
		}
	}
	performer.AgeCounts = append(performer.AgeCounts, &VatoStatsAgeCount{
		AgeRange: ageRange,
		Count:    count,
	})
}

// VatoStatsPerformers returns the raw per-vato rows used by /vatostats. The UI
// owns drill-down state so metric/category combinations can evolve without
// adding a resolver for every chart.
func (r *queryResolver) VatoStatsPerformers(ctx context.Context) (ret []*VatoStatsPerformer, err error) {
	baseURL, _ := ctx.Value(BaseURLCtxKey).(string)
	thresholds := getCustomPerformerRatingTierThresholds()
	overrides := getCustomRatingTierOverrideTags()
	bronzeClause, bronzeArgs := customRatingTierSQLClause("bronze", thresholds, overrides)
	silverClause, silverArgs := customRatingTierSQLClause("silver", thresholds, overrides)
	goldClause, goldArgs := customRatingTierSQLClause("gold", thresholds, overrides)
	royalSapphireClause, royalSapphireArgs := customRatingTierSQLClause("royal_sapphire", thresholds, overrides)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := fmt.Sprintf(`
SELECT
  performers.id,
  performers.name,
  performers.rating,
  CASE
    WHEN %s THEN 'royal_sapphire'
    WHEN %s THEN 'gold'
    WHEN %s THEN 'silver'
    WHEN %s THEN 'bronze'
    ELSE NULL
  END AS metallic_rating,
  performers.ethnicity,
  performers.country,
  performers.hair_color,
  performers.eye_color,
  performers.height,
  performers.penis_length,
  performers.circumcised,
  CASE WHEN performers.image_blob IS NULL OR TRIM(performers.image_blob) = '' THEN 0 ELSE 1 END AS has_image,
  COUNT(DISTINCT ps.scene_id) AS scene_count,
  COUNT(od.o_date) AS scene_o_count,
  MAX(date(od.o_date)) AS most_recent_o_date,
  COALESCE(career_span.career_span_days, 0) AS career_span_days
FROM performers
LEFT JOIN performers_scenes ps ON ps.performer_id = performers.id
LEFT JOIN scenes_o_dates od ON od.scene_id = ps.scene_id AND od.o_date IS NOT NULL
LEFT JOIN (
  SELECT
    ps_span.performer_id,
    COALESCE(CAST(julianday(MAX(date(s_span.date))) - julianday(MIN(date(s_span.date))) AS INT), 0) AS career_span_days
  FROM performers_scenes ps_span
  JOIN scenes s_span ON s_span.id = ps_span.scene_id
  WHERE s_span.date IS NOT NULL AND TRIM(s_span.date) <> ''
  GROUP BY ps_span.performer_id
) career_span ON career_span.performer_id = performers.id
GROUP BY performers.id
HAVING scene_count > 0
ORDER BY performers.name COLLATE NOCASE ASC`,
			royalSapphireClause,
			goldClause,
			silverClause,
			bronzeClause,
		)
		args := append([]interface{}{}, royalSapphireArgs...)
		args = append(args, goldArgs...)
		args = append(args, silverArgs...)
		args = append(args, bronzeArgs...)
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}

		out := make([]*VatoStatsPerformer, 0, len(rows))
		byID := make(map[int]*VatoStatsPerformer, len(rows))
		ids := make([]int, 0, len(rows))
		for _, row := range rows {
			if len(row) < 16 {
				continue
			}

			id := customIntValue(row[0])
			sceneCount := customIntValue(row[12])
			if id == 0 || sceneCount == 0 {
				continue
			}

			performer := &VatoStatsPerformer{
				ID:                   strconv.Itoa(id),
				Name:                 customStringValue(row[1]),
				Rating100:            vatoStatsIntPtrValue(row[2]),
				MetallicRating:       vatoStatsStringPtrValue(row[3]),
				Ethnicity:            vatoStatsStringPtrValue(row[4]),
				Country:              vatoStatsStringPtrValue(row[5]),
				HairColor:            vatoStatsStringPtrValue(row[6]),
				EyeColor:             vatoStatsStringPtrValue(row[7]),
				HeightCm:             vatoStatsIntPtrValue(row[8]),
				PenisLength:          customFloatPtrValue(row[9]),
				Circumcised:          vatoStatsStringPtrValue(row[10]),
				ImagePath:            vatoStatsImagePath(baseURL, id, customIntValue(row[11]) != 0),
				SceneCount:           sceneCount,
				SceneOCount:          customIntValue(row[13]),
				MostRecentODate:      vatoStatsStringPtrValue(row[14]),
				CareerSpanDays:       customIntValue(row[15]),
				AgeCounts:            []*VatoStatsAgeCount{},
				UnknownSceneAgeCount: sceneCount,
			}
			out = append(out, performer)
			byID[id] = performer
			ids = append(ids, id)
		}

		if len(ids) == 0 {
			ret = out
			return nil
		}

		uiConfig := config.GetInstance().GetUIConfiguration()
		sexTagID, oralTagID, _, facialTagID, _, _, _ := getRoleTagIDs(uiConfig)
		applyRoleSceneCounts := func(tagID int, includeSecondary bool, countColumn string, setTop func(*VatoStatsPerformer, int), setBottom func(*VatoStatsPerformer, int)) error {
			if tagID == 0 {
				return nil
			}
			roleIDClause, roleIDArgs := vatoStatsIDFilter("smp.performer_id", ids)
			tagCondition := "sm.primary_tag_id IN (SELECT id FROM role_tags)"
			if includeSecondary {
				tagCondition = `(sm.primary_tag_id IN (SELECT id FROM role_tags)
    OR EXISTS (
      SELECT 1
      FROM scene_markers_tags smt
      WHERE smt.scene_marker_id = sm.id
        AND smt.tag_id IN (SELECT id FROM role_tags)
    ))`
			}
			sexRoleQuery := fmt.Sprintf(`
WITH RECURSIVE role_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN role_tags rt ON tr.parent_id = rt.id
)
SELECT
  smp.performer_id,
  COUNT(DISTINCT CASE WHEN smp.role = 'top' THEN %s END) AS role_top_count,
  COUNT(DISTINCT CASE WHEN smp.role = 'bottom' THEN %s END) AS role_bottom_count
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
WHERE %s
  %s
GROUP BY smp.performer_id`, countColumn, countColumn, tagCondition, roleIDClause)
			roleArgs := append([]interface{}{tagID}, roleIDArgs...)
			_, roleRows, err := db.QuerySQL(ctx, sexRoleQuery, roleArgs)
			if err != nil {
				return err
			}
			for _, row := range roleRows {
				if len(row) < 3 {
					continue
				}
				performer := byID[customIntValue(row[0])]
				if performer == nil {
					continue
				}
				setTop(performer, customIntValue(row[1]))
				setBottom(performer, customIntValue(row[2]))
			}
			return nil
		}
		if err := applyRoleSceneCounts(sexTagID, false, "sm.scene_id", func(performer *VatoStatsPerformer, count int) {
			performer.SexTopCount = count
		}, func(performer *VatoStatsPerformer, count int) {
			performer.SexBottomCount = count
		}); err != nil {
			return err
		}
		if err := applyRoleSceneCounts(oralTagID, false, "sm.scene_id", func(performer *VatoStatsPerformer, count int) {
			performer.OralTopCount = count
		}, func(performer *VatoStatsPerformer, count int) {
			performer.OralBottomCount = count
		}); err != nil {
			return err
		}
		if err := applyRoleSceneCounts(facialTagID, true, "sm.id", func(performer *VatoStatsPerformer, count int) {
			performer.FacialGivenCount = count
		}, func(performer *VatoStatsPerformer, count int) {
			performer.FacialReceivedCount = count
		}); err != nil {
			return err
		}

		ageIDClause, ageIDArgs := vatoStatsIDFilter("ps.performer_id", ids)
		ageQuery := fmt.Sprintf(`
SELECT
  ps.performer_id,
  CAST(strftime('%%Y.%%m%%d', s.date) - strftime('%%Y.%%m%%d', p.birthdate) AS INT) AS scene_age,
  COUNT(*) AS cnt
FROM performers_scenes ps
JOIN performers p ON p.id = ps.performer_id
JOIN scenes s ON s.id = ps.scene_id
WHERE p.birthdate IS NOT NULL
  AND TRIM(p.birthdate) <> ''
  AND s.date IS NOT NULL
  AND TRIM(s.date) <> ''
  %s
GROUP BY ps.performer_id, scene_age`, ageIDClause)
		_, ageRows, err := db.QuerySQL(ctx, ageQuery, ageIDArgs)
		if err != nil {
			return err
		}
		for _, row := range ageRows {
			if len(row) < 3 {
				continue
			}
			performer := byID[customIntValue(row[0])]
			if performer == nil {
				continue
			}
			age := customIntValue(row[1])
			count := customIntValue(row[2])
			if age < 18 || age > 80 || count <= 0 {
				continue
			}
			vatoStatsSetAgeCount(performer, vatoStatsAgeRange(age), count)
			performer.UnknownSceneAgeCount -= count
			if performer.UnknownSceneAgeCount < 0 {
				performer.UnknownSceneAgeCount = 0
			}
		}
		for _, performer := range out {
			sort.Slice(performer.AgeCounts, func(i int, j int) bool {
				return performer.AgeCounts[i].AgeRange < performer.AgeCounts[j].AgeRange
			})
		}

		ret = out
		return nil
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

// MostOsInDay returns the single date with the highest recorded scene O count.
func (r *queryResolver) MostOsInDay(ctx context.Context) (ret *SceneODayStat, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT date(o_date) AS day, COUNT(*) AS cnt FROM scenes_o_dates WHERE o_date IS NOT NULL AND date(o_date) >= date(?) AND date(o_date) <> date(?) GROUP BY day ORDER BY cnt DESC, day ASC LIMIT 1"
		_, rows, err := db.QuerySQL(ctx, query, []interface{}{sceneODateTrackingStart, sceneODateMostOsExcludedDay})
		if err != nil {
			return err
		}
		if len(rows) == 0 || len(rows[0]) < 2 {
			return nil
		}

		var count int
		switch v := rows[0][1].(type) {
		case int64:
			count = int(v)
		case int:
			count = v
		case []byte:
			count, _ = strconv.Atoi(string(v))
		case string:
			count, _ = strconv.Atoi(v)
		default:
			count, _ = strconv.Atoi(fmt.Sprint(v))
		}

		ret = &SceneODayStat{
			Date:  fmt.Sprint(rows[0][0]),
			Count: count,
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// LongestPeriodWithoutO returns the longest gap between recorded scene O dates,
// including the current gap from the most recent O date through today.
func (r *queryResolver) LongestPeriodWithoutO(ctx context.Context) (ret *SceneODrySpell, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT DISTINCT date(o_date) AS day FROM scenes_o_dates WHERE o_date IS NOT NULL AND date(o_date) >= date(?) ORDER BY day ASC"
		_, rows, err := db.QuerySQL(ctx, query, []interface{}{sceneODateTrackingStart})
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}

		dates := make([]time.Time, 0, len(rows))
		for _, row := range rows {
			if len(row) == 0 || row[0] == nil {
				continue
			}
			day, parseErr := time.Parse("2006-01-02", fmt.Sprint(row[0]))
			if parseErr != nil {
				return parseErr
			}
			dates = append(dates, day)
		}
		if len(dates) == 0 {
			return nil
		}

		bestDays := -1
		bestStart := dates[0]
		bestEnd := dates[0]
		for i := 1; i < len(dates); i++ {
			days := int(dates[i].Sub(dates[i-1]).Hours()/24) - 1
			if days > bestDays {
				bestDays = days
				bestStart = dates[i-1].AddDate(0, 0, 1)
				bestEnd = dates[i].AddDate(0, 0, -1)
			}
		}

		today, parseErr := time.Parse("2006-01-02", time.Now().Format("2006-01-02"))
		if parseErr != nil {
			return parseErr
		}
		lastDate := dates[len(dates)-1]
		currentDays := int(today.Sub(lastDate).Hours() / 24)
		if currentDays > bestDays {
			bestDays = currentDays
			bestStart = lastDate.AddDate(0, 0, 1)
			bestEnd = today
			if currentDays == 0 {
				bestStart = today
			}
		}
		if bestDays < 0 {
			bestDays = 0
			bestStart = lastDate
			bestEnd = lastDate
		}

		ret = &SceneODrySpell{
			Days:      bestDays,
			StartDate: bestStart.Format("2006-01-02"),
			EndDate:   bestEnd.Format("2006-01-02"),
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// SceneOrgasmCount returns the total number of orgasms in scenes using marker logic:
//   - Find markers where the primary tag is the configured orgasm tag or any descendant of it, or
//     where any secondary tag is the configured orgasm tag or any descendant of it
//   - For each matching marker, count the number of 'top' performers on that marker
//   - Each marker counts as the number of tops, with a minimum of 1 if no tops are assigned
//
// Uses roleTagIds.orgasmTagId from UI config and includes all subtags recursively.
func (r *queryResolver) SceneOrgasmCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var orgasmTagID int
		var secondCameraTagID int
		if roleTagIds != nil {
			if orgasmID, ok := roleTagIds["orgasmTagId"].(string); ok && orgasmID != "" {
				orgasmTagID, _ = strconv.Atoi(orgasmID)
			}
			if scID, ok := roleTagIds["secondCameraTagId"].(string); ok && scID != "" {
				secondCameraTagID, _ = strconv.Atoi(scID)
			}
		}
		if orgasmTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database

		// Build optional 2nd camera exclusion clause
		secondCameraCTE := ""
		secondCameraExclude := ""
		args := []interface{}{orgasmTagID}
		if secondCameraTagID > 0 {
			secondCameraCTE = `,
second_camera_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN second_camera_tags sct ON tr.parent_id = sct.id
)`
			secondCameraExclude = `
  AND sm.id NOT IN (
    SELECT smt2.scene_marker_id FROM scene_markers_tags smt2
    WHERE smt2.tag_id IN (SELECT id FROM second_camera_tags)
  )`
			args = append(args, secondCameraTagID)
		}

		query := `
WITH RECURSIVE orgasm_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN orgasm_tags ot ON tr.parent_id = ot.id
)` + secondCameraCTE + `,
orgasm_markers AS (
  SELECT DISTINCT sm.id
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE (sm.primary_tag_id IN (SELECT id FROM orgasm_tags)
     OR smt.tag_id IN (SELECT id FROM orgasm_tags))` + secondCameraExclude + `
)
SELECT COALESCE(SUM(CASE WHEN top_count > 0 THEN top_count ELSE 1 END), 0) AS total_orgasms
FROM (
  SELECT om.id, (SELECT COUNT(*) FROM scene_marker_performers smp WHERE smp.scene_marker_id = om.id AND smp.role = 'top') AS top_count
  FROM orgasm_markers om
) sub`
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// SceneFacialCount returns the total number of facial events.
// A marker counts if:
// - its primary tag is the configured facial tag or any descendant of it, or
// - it has any secondary tag that is the configured facial tag or any descendant of it.
// For each matching marker, count the number of 'top' performers on that marker.
// Each marker counts as the number of tops, with a minimum of 1 if no tops are assigned.
// Uses roleTagIds.facialTagId from UI config and includes all subtags recursively.
func (r *queryResolver) SceneFacialCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var facialTagID int
		var secondCameraTagID int
		if roleTagIds != nil {
			if facialID, ok := roleTagIds["facialTagId"].(string); ok && facialID != "" {
				facialTagID, _ = strconv.Atoi(facialID)
			}
			if scID, ok := roleTagIds["secondCameraTagId"].(string); ok && scID != "" {
				secondCameraTagID, _ = strconv.Atoi(scID)
			}
		}
		if facialTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database

		// Build optional 2nd camera exclusion clause
		secondCameraCTE := ""
		secondCameraExclude := ""
		args := []interface{}{facialTagID}
		if secondCameraTagID > 0 {
			secondCameraCTE = `,
second_camera_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN second_camera_tags sct ON tr.parent_id = sct.id
)`
			secondCameraExclude = `
  AND sm.id NOT IN (
    SELECT smt2.scene_marker_id FROM scene_markers_tags smt2
    WHERE smt2.tag_id IN (SELECT id FROM second_camera_tags)
  )`
			args = append(args, secondCameraTagID)
		}

		query := `
WITH RECURSIVE facial_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN facial_tags ft ON tr.parent_id = ft.id
)` + secondCameraCTE + `,
facial_markers AS (
  SELECT DISTINCT sm.id
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE (sm.primary_tag_id IN (SELECT id FROM facial_tags)
     OR smt.tag_id IN (SELECT id FROM facial_tags))` + secondCameraExclude + `
)
SELECT COALESCE(SUM(CASE WHEN top_count > 0 THEN top_count ELSE 1 END), 0) AS total_facials
FROM (
  SELECT fm.id, (SELECT COUNT(*) FROM scene_marker_performers smp WHERE smp.scene_marker_id = fm.id AND smp.role = 'top') AS top_count
  FROM facial_markers fm
) sub`
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersFacialGivenCount returns the number of distinct performers who have given facials.
// Uses roleTagIds.facialTagId from UI config and includes all subtags recursively.
func (r *queryResolver) PerformersFacialGivenCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var facialTagID int
		if roleTagIds != nil {
			if facialID, ok := roleTagIds["facialTagId"].(string); ok && facialID != "" {
				facialTagID, _ = strconv.Atoi(facialID)
			}
		}
		if facialTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database
		query := `
WITH RECURSIVE facial_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN facial_tags ft ON tr.parent_id = ft.id
),
facial_markers AS (
  SELECT DISTINCT sm.id
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE sm.primary_tag_id IN (SELECT id FROM facial_tags)
     OR smt.tag_id IN (SELECT id FROM facial_tags)
)
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
WHERE smp.scene_marker_id IN (SELECT id FROM facial_markers)
  AND smp.role = 'top'`
		args := []interface{}{facialTagID}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersFacialReceivedCount returns the number of distinct performers who have received facials.
// Uses roleTagIds.facialTagId from UI config and includes all subtags recursively.
func (r *queryResolver) PerformersFacialReceivedCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var facialTagID int
		if roleTagIds != nil {
			if facialID, ok := roleTagIds["facialTagId"].(string); ok && facialID != "" {
				facialTagID, _ = strconv.Atoi(facialID)
			}
		}
		if facialTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database
		query := `
WITH RECURSIVE facial_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN facial_tags ft ON tr.parent_id = ft.id
),
facial_markers AS (
  SELECT DISTINCT sm.id
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE sm.primary_tag_id IN (SELECT id FROM facial_tags)
     OR smt.tag_id IN (SELECT id FROM facial_tags)
)
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
WHERE smp.scene_marker_id IN (SELECT id FROM facial_markers)
  AND smp.role = 'bottom'`
		args := []interface{}{facialTagID}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersSexGivenCount returns the number of distinct performers who have been tops in sex markers.
// Uses roleTagIds.sexTagId from UI config.
func (r *queryResolver) PerformersSexGivenCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var sexTagID int
		if roleTagIds != nil {
			if sexID, ok := roleTagIds["sexTagId"].(string); ok && sexID != "" {
				sexTagID, _ = strconv.Atoi(sexID)
			}
		}
		if sexTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database
		query := `SELECT COUNT(DISTINCT smp.performer_id) 
FROM scene_marker_performers smp 
JOIN scene_markers sm ON sm.id = smp.scene_marker_id 
WHERE sm.primary_tag_id = ? AND smp.role = 'top'`
		args := []interface{}{sexTagID}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersSexReceivedCount returns the number of distinct performers who have been bottoms in sex markers.
// Uses roleTagIds.sexTagId from UI config.
func (r *queryResolver) PerformersSexReceivedCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var sexTagID int
		if roleTagIds != nil {
			if sexID, ok := roleTagIds["sexTagId"].(string); ok && sexID != "" {
				sexTagID, _ = strconv.Atoi(sexID)
			}
		}
		if sexTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database
		query := `SELECT COUNT(DISTINCT smp.performer_id) 
FROM scene_marker_performers smp 
JOIN scene_markers sm ON sm.id = smp.scene_marker_id 
WHERE sm.primary_tag_id = ? AND smp.role = 'bottom'`
		args := []interface{}{sexTagID}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersOralGivenCount returns the number of distinct performers who have been tops in oral markers.
// Uses roleTagIds.oralTagId from UI config.
func (r *queryResolver) PerformersOralGivenCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var oralTagID int
		if roleTagIds != nil {
			if oralID, ok := roleTagIds["oralTagId"].(string); ok && oralID != "" {
				oralTagID, _ = strconv.Atoi(oralID)
			}
		}
		if oralTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database
		query := `SELECT COUNT(DISTINCT smp.performer_id) 
FROM scene_marker_performers smp 
JOIN scene_markers sm ON sm.id = smp.scene_marker_id 
WHERE sm.primary_tag_id = ? AND smp.role = 'top'`
		args := []interface{}{oralTagID}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersOralReceivedCount returns the number of distinct performers who have been bottoms in oral markers.
// Uses roleTagIds.oralTagId from UI config.
func (r *queryResolver) PerformersOralReceivedCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var oralTagID int
		if roleTagIds != nil {
			if oralID, ok := roleTagIds["oralTagId"].(string); ok && oralID != "" {
				oralTagID, _ = strconv.Atoi(oralID)
			}
		}
		if oralTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database
		query := `SELECT COUNT(DISTINCT smp.performer_id) 
FROM scene_marker_performers smp 
JOIN scene_markers sm ON sm.id = smp.scene_marker_id 
WHERE sm.primary_tag_id = ? AND smp.role = 'bottom'`
		args := []interface{}{oralTagID}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersStrictTopCount returns the number of performers who have 'top' role in sex/oral/facial markers but no 'bottom' role in any of those.
// Uses roleTagIds.sexTagId, roleTagIds.oralTagId, and roleTagIds.facialTagId from UI config.
func (r *queryResolver) PerformersStrictTopCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var sexTagID, oralTagID, facialTagID int
		if roleTagIds != nil {
			if sexID, ok := roleTagIds["sexTagId"].(string); ok && sexID != "" {
				sexTagID, _ = strconv.Atoi(sexID)
			}
			if oralID, ok := roleTagIds["oralTagId"].(string); ok && oralID != "" {
				oralTagID, _ = strconv.Atoi(oralID)
			}
			if facialID, ok := roleTagIds["facialTagId"].(string); ok && facialID != "" {
				facialTagID, _ = strconv.Atoi(facialID)
			}
		}
		if sexTagID == 0 && oralTagID == 0 && facialTagID == 0 {
			return nil // No tags configured
		}

		db := manager.GetInstance().Database

		// Build tag list for the query
		var tagIDs []string
		if sexTagID > 0 {
			tagIDs = append(tagIDs, strconv.Itoa(sexTagID))
		}
		if oralTagID > 0 {
			tagIDs = append(tagIDs, strconv.Itoa(oralTagID))
		}
		if facialTagID > 0 {
			tagIDs = append(tagIDs, strconv.Itoa(facialTagID))
		}

		if len(tagIDs) == 0 {
			return nil
		}

		tagList := strings.Join(tagIDs, ",")
		query := fmt.Sprintf(`
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
WHERE smp.role = 'top'
  AND (sm.primary_tag_id IN (%s) OR smt.tag_id IN (%s))
  AND smp.performer_id NOT IN (
    SELECT DISTINCT smp2.performer_id
    FROM scene_marker_performers smp2
    JOIN scene_markers sm2 ON sm2.id = smp2.scene_marker_id
    LEFT JOIN scene_markers_tags smt2 ON smt2.scene_marker_id = sm2.id
    WHERE smp2.role = 'bottom'
      AND (sm2.primary_tag_id IN (%s) OR smt2.tag_id IN (%s))
  )`, tagList, tagList, tagList, tagList)
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersStrictBottomCount returns the number of performers who have 'bottom' role in sex/oral/facial markers but no 'top' role in any of those.
// Uses roleTagIds.sexTagId, roleTagIds.oralTagId, and roleTagIds.facialTagId from UI config.
func (r *queryResolver) PerformersStrictBottomCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var sexTagID, oralTagID, facialTagID int
		if roleTagIds != nil {
			if sexID, ok := roleTagIds["sexTagId"].(string); ok && sexID != "" {
				sexTagID, _ = strconv.Atoi(sexID)
			}
			if oralID, ok := roleTagIds["oralTagId"].(string); ok && oralID != "" {
				oralTagID, _ = strconv.Atoi(oralID)
			}
			if facialID, ok := roleTagIds["facialTagId"].(string); ok && facialID != "" {
				facialTagID, _ = strconv.Atoi(facialID)
			}
		}
		if sexTagID == 0 && oralTagID == 0 && facialTagID == 0 {
			return nil // No tags configured
		}

		db := manager.GetInstance().Database

		// Build tag list for the query
		var tagIDs []string
		if sexTagID > 0 {
			tagIDs = append(tagIDs, strconv.Itoa(sexTagID))
		}
		if oralTagID > 0 {
			tagIDs = append(tagIDs, strconv.Itoa(oralTagID))
		}
		if facialTagID > 0 {
			tagIDs = append(tagIDs, strconv.Itoa(facialTagID))
		}

		if len(tagIDs) == 0 {
			return nil
		}

		tagList := strings.Join(tagIDs, ",")
		query := fmt.Sprintf(`
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
WHERE smp.role = 'bottom'
  AND (sm.primary_tag_id IN (%s) OR smt.tag_id IN (%s))
  AND smp.performer_id NOT IN (
    SELECT DISTINCT smp2.performer_id
    FROM scene_marker_performers smp2
    JOIN scene_markers sm2 ON sm2.id = smp2.scene_marker_id
    LEFT JOIN scene_markers_tags smt2 ON smt2.scene_marker_id = sm2.id
    WHERE smp2.role = 'top'
      AND (sm2.primary_tag_id IN (%s) OR smt2.tag_id IN (%s))
  )`, tagList, tagList, tagList, tagList)
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersLenientTopCount returns the number of performers who have both top and oral bottom tags, but no bottom tag.
func (r *queryResolver) PerformersLenientTopCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		topTagName := "top"
		bottomTagName := "bottom"
		oralBottomTagName := "oralbottom"
		if sceneTagAliases != nil {
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
				oralBottomTagName = ob
			}
		}

		db := manager.GetInstance().Database
		query := `
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
JOIN tags t ON t.id = sm.primary_tag_id
WHERE LOWER(TRIM(t.name)) = ?
  AND smp.performer_id IN (
    SELECT DISTINCT smp2.performer_id
    FROM scene_marker_performers smp2
    JOIN scene_markers sm2 ON sm2.id = smp2.scene_marker_id
    JOIN tags t2 ON t2.id = sm2.primary_tag_id
    WHERE LOWER(TRIM(t2.name)) = ?
  )
  AND smp.performer_id NOT IN (
    SELECT DISTINCT smp3.performer_id
    FROM scene_marker_performers smp3
    JOIN scene_markers sm3 ON sm3.id = smp3.scene_marker_id
    JOIN tags t3 ON t3.id = sm3.primary_tag_id
    WHERE LOWER(TRIM(t3.name)) = ?
  )`
		args := []interface{}{
			strings.ToLower(topTagName),
			strings.ToLower(oralBottomTagName),
			strings.ToLower(bottomTagName),
		}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersLenientBottomCount returns the number of performers who have both bottom and oral top tags, but no top tag.
func (r *queryResolver) PerformersLenientBottomCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		topTagName := "top"
		bottomTagName := "bottom"
		oralTopTagName := "oraltop"
		if sceneTagAliases != nil {
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
				oralTopTagName = ot
			}
		}

		db := manager.GetInstance().Database
		query := `
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
JOIN tags t ON t.id = sm.primary_tag_id
WHERE LOWER(TRIM(t.name)) = ?
  AND smp.performer_id IN (
    SELECT DISTINCT smp2.performer_id
    FROM scene_marker_performers smp2
    JOIN scene_markers sm2 ON sm2.id = smp2.scene_marker_id
    JOIN tags t2 ON t2.id = sm2.primary_tag_id
    WHERE LOWER(TRIM(t2.name)) = ?
  )
  AND smp.performer_id NOT IN (
    SELECT DISTINCT smp3.performer_id
    FROM scene_marker_performers smp3
    JOIN scene_markers sm3 ON sm3.id = smp3.scene_marker_id
    JOIN tags t3 ON t3.id = sm3.primary_tag_id
    WHERE LOWER(TRIM(t3.name)) = ?
  )`
		args := []interface{}{
			strings.ToLower(bottomTagName),
			strings.ToLower(oralTopTagName),
			strings.ToLower(topTagName),
		}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersSoloOnlyCount returns the number of performers who have solo markers but no oral/sex markers.
// Uses roleTagIds.soloTagId, oralTagId, sexTagId from UI config with depth -1 (include subtags).
func (r *queryResolver) PerformersSoloOnlyCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var soloTagID, oralTagID, sexTagID int
		if roleTagIds != nil {
			if id, ok := roleTagIds["soloTagId"].(string); ok && id != "" {
				soloTagID, _ = strconv.Atoi(id)
			}
			if id, ok := roleTagIds["oralTagId"].(string); ok && id != "" {
				oralTagID, _ = strconv.Atoi(id)
			}
			if id, ok := roleTagIds["sexTagId"].(string); ok && id != "" {
				sexTagID, _ = strconv.Atoi(id)
			}
		}
		if soloTagID == 0 {
			return nil // No solo tag configured
		}

		db := manager.GetInstance().Database

		// Build exclude tag list
		var excludeTagIDs []int
		if oralTagID != 0 {
			excludeTagIDs = append(excludeTagIDs, oralTagID)
		}
		if sexTagID != 0 {
			excludeTagIDs = append(excludeTagIDs, sexTagID)
		}

		// Query with hierarchical tag expansion (depth -1 = all descendants)
		// This matches the frontend performer_markers filter behavior
		query := `
WITH RECURSIVE solo_family(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN solo_family sf ON tr.parent_id = sf.id
)
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
WHERE (
  sm.primary_tag_id IN (SELECT id FROM solo_family)
  OR EXISTS (SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM solo_family))
)`

		args := []interface{}{soloTagID}

		// Add exclusion clause if we have exclude tags
		if len(excludeTagIDs) > 0 {
			// Build CTE for each exclude tag family
			var excludeCTEs []string
			var excludeConditions []string
			for i, tagID := range excludeTagIDs {
				cteName := fmt.Sprintf("exclude_family_%d", i)
				excludeCTEs = append(excludeCTEs, fmt.Sprintf(`
%s(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN %s ef ON tr.parent_id = ef.id
)`, cteName, cteName))
				args = append(args, tagID)
				excludeConditions = append(excludeConditions, fmt.Sprintf(`
  AND smp.performer_id NOT IN (
    SELECT DISTINCT smp2.performer_id
    FROM scene_marker_performers smp2
    JOIN scene_markers sm2 ON sm2.id = smp2.scene_marker_id
    WHERE sm2.primary_tag_id IN (SELECT id FROM %s)
       OR EXISTS (SELECT 1 FROM scene_markers_tags smt2 WHERE smt2.scene_marker_id = sm2.id AND smt2.tag_id IN (SELECT id FROM %s))
  )`, cteName, cteName))
			}

			// Rebuild query with exclude CTEs
			query = `
WITH RECURSIVE solo_family(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN solo_family sf ON tr.parent_id = sf.id
),` + strings.Join(excludeCTEs, ",") + `
SELECT COUNT(DISTINCT smp.performer_id)
FROM scene_marker_performers smp
JOIN scene_markers sm ON sm.id = smp.scene_marker_id
WHERE (
  sm.primary_tag_id IN (SELECT id FROM solo_family)
  OR EXISTS (SELECT 1 FROM scene_markers_tags smt WHERE smt.scene_marker_id = sm.id AND smt.tag_id IN (SELECT id FROM solo_family))
)` + strings.Join(excludeConditions, "")
			// args already has soloTagID as first element, followed by exclude tag IDs
		}

		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
} // PerformersOneSceneCount returns the number of performers who appear in exactly one scene.
func (r *queryResolver) PerformersOneSceneCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := `
SELECT COUNT(*)
FROM (
  SELECT performer_id
  FROM performers_scenes
  GROUP BY performer_id
  HAVING COUNT(*) = 1
)`
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *queryResolver) PerformerTagSceneCounts(ctx context.Context, performer_id string, tag_ids []string) ([]*PerformerTagSceneCount, error) {
	// parse performer id
	pid, err := strconv.Atoi(performer_id)
	if err != nil {
		return nil, err
	}

	if len(tag_ids) == 0 {
		return []*PerformerTagSceneCount{}, nil
	}

	// parse tag ids and build args
	args := make([]interface{}, 0, 1+len(tag_ids))
	args = append(args, pid)
	placeholders := make([]string, len(tag_ids))
	parsedIDs := make([]int, len(tag_ids))
	for i, tid := range tag_ids {
		id, err := strconv.Atoi(tid)
		if err != nil {
			return nil, err
		}
		parsedIDs[i] = id
		args = append(args, id)
		placeholders[i] = "?"
	}

	// Query via scene_marker_performers -> scene_markers to get counts by primary_tag_id
	query := `SELECT sm.primary_tag_id, COUNT(DISTINCT sm.scene_id) 
FROM scene_marker_performers smp 
JOIN scene_markers sm ON sm.id = smp.scene_marker_id 
WHERE smp.performer_id = ? AND sm.primary_tag_id IN (` + strings.Join(placeholders, ",") + `) 
GROUP BY sm.primary_tag_id`

	db := manager.GetInstance().Database

	var rows [][]interface{}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		_, rows, err = db.QuerySQL(ctx, query, args)
		return err
	}); err != nil {
		return nil, err
	}

	counts := make(map[int]int)
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}

		// tag_id may be returned as int64 or string/[]byte depending on driver
		var tagInt int
		switch v := row[0].(type) {
		case int64:
			tagInt = int(v)
		case int:
			tagInt = v
		case []byte:
			tagInt, _ = strconv.Atoi(string(v))
		case string:
			tagInt, _ = strconv.Atoi(v)
		default:
			tagInt, _ = strconv.Atoi(fmt.Sprint(v))
		}

		var cnt int
		switch v := row[1].(type) {
		case int64:
			cnt = int(v)
		case int:
			cnt = v
		case []byte:
			cnt, _ = strconv.Atoi(string(v))
		case string:
			cnt, _ = strconv.Atoi(v)
		default:
			cnt, _ = strconv.Atoi(fmt.Sprint(v))
		}

		counts[tagInt] = cnt
	}

	var result []*PerformerTagSceneCount
	for _, id := range parsedIDs {
		c := counts[id]
		result = append(result, &PerformerTagSceneCount{
			TagID: strconv.Itoa(id),
			Count: c,
		})
	}

	return result, nil
}

// EstimatedLiters calculates the estimated liters produced from orgasms.
// Formula: orgasm count Ã— 3ml (average volume per orgasm), converted to liters.
func (r *queryResolver) EstimatedLiters(ctx context.Context) (float64, error) {
	orgasmCount, err := r.SceneOrgasmCount(ctx)
	if err != nil {
		return 0, err
	}
	// 3ml per orgasm, convert to liters (divide by 1000)
	return float64(orgasmCount) * 3.0 / 1000.0, nil
}

// TotalPenisMeters sums all performer penis lengths, using 17cm as default if missing.
// Result is converted from cm to meters.
func (r *queryResolver) TotalPenisMeters(ctx context.Context) (float64, error) {
	var totalCm float64
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		// Sum penis lengths, using 17cm as default for performers without a value
		query := "SELECT SUM(COALESCE(penis_length, 17)) FROM performers"
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 && rows[0][0] != nil {
			switch v := rows[0][0].(type) {
			case float64:
				totalCm = v
			case int64:
				totalCm = float64(v)
			case int:
				totalCm = float64(v)
			case []byte:
				f, _ := strconv.ParseFloat(string(v), 64)
				totalCm = f
			case string:
				f, _ := strconv.ParseFloat(v, 64)
				totalCm = f
			default:
				f, _ := strconv.ParseFloat(fmt.Sprint(v), 64)
				totalCm = f
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	// Convert cm to meters
	return totalCm / 100.0, nil
}

// TotalOrgasmTime calculates the total time (in seconds) of all orgasm markers.
// For each orgasm marker, the duration is (end_seconds - seconds), or 20 seconds if end_seconds is NULL.
// Duration is multiplied by the number of top performers (or 1 if no tops assigned).
// Uses roleTagIds.orgasmTagId from UI config and includes all subtags recursively.
func (r *queryResolver) TotalOrgasmTime(ctx context.Context) (float64, error) {
	var totalSeconds float64
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var orgasmTagID int
		var secondCameraTagID int
		if roleTagIds != nil {
			if orgasmID, ok := roleTagIds["orgasmTagId"].(string); ok && orgasmID != "" {
				orgasmTagID, _ = strconv.Atoi(orgasmID)
			}
			if scID, ok := roleTagIds["secondCameraTagId"].(string); ok && scID != "" {
				secondCameraTagID, _ = strconv.Atoi(scID)
			}
		}
		if orgasmTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database

		// Build optional 2nd camera exclusion clause
		secondCameraCTE := ""
		secondCameraExclude := ""
		args := []interface{}{orgasmTagID}
		if secondCameraTagID > 0 {
			secondCameraCTE = `,
second_camera_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN second_camera_tags sct ON tr.parent_id = sct.id
)`
			secondCameraExclude = `
  AND sm.id NOT IN (
    SELECT smt2.scene_marker_id FROM scene_markers_tags smt2
    WHERE smt2.tag_id IN (SELECT id FROM second_camera_tags)
  )`
			args = append(args, secondCameraTagID)
		}

		query := `
WITH RECURSIVE orgasm_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN orgasm_tags ot ON tr.parent_id = ot.id
)` + secondCameraCTE + `,
orgasm_markers AS (
  SELECT DISTINCT sm.id, sm.seconds, sm.end_seconds
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE (sm.primary_tag_id IN (SELECT id FROM orgasm_tags)
     OR smt.tag_id IN (SELECT id FROM orgasm_tags))` + secondCameraExclude + `
)
SELECT COALESCE(SUM(
  (CASE WHEN end_seconds IS NOT NULL THEN end_seconds - seconds ELSE 20.0 END) 
  * 
  (CASE WHEN top_count > 0 THEN top_count ELSE 1 END)
), 0) AS total_time
FROM (
  SELECT om.id, om.seconds, om.end_seconds,
    (SELECT COUNT(*) FROM scene_marker_performers smp WHERE smp.scene_marker_id = om.id AND smp.role = 'top') AS top_count
  FROM orgasm_markers om
) sub`
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 && rows[0][0] != nil {
			switch v := rows[0][0].(type) {
			case float64:
				totalSeconds = v
			case int64:
				totalSeconds = float64(v)
			case int:
				totalSeconds = float64(v)
			case []byte:
				f, _ := strconv.ParseFloat(string(v), 64)
				totalSeconds = f
			case string:
				f, _ := strconv.ParseFloat(v, 64)
				totalSeconds = f
			default:
				f, _ := strconv.ParseFloat(fmt.Sprint(v), 64)
				totalSeconds = f
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return totalSeconds, nil
}

// TotalFacialTime calculates the total time (in seconds) of all facial markers.
// For each facial marker, the duration is (end_seconds - seconds), or 20 seconds if end_seconds is NULL.
// Duration is multiplied by the number of top performers (or 1 if no tops assigned).
// Uses roleTagIds.facialTagId from UI config and includes all subtags recursively.
func (r *queryResolver) TotalFacialTime(ctx context.Context) (float64, error) {
	var totalSeconds float64
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		roleTagIds, _ := uiConfig["roleTagIds"].(map[string]interface{})
		var facialTagID int
		var secondCameraTagID int
		if roleTagIds != nil {
			if facialID, ok := roleTagIds["facialTagId"].(string); ok && facialID != "" {
				facialTagID, _ = strconv.Atoi(facialID)
			}
			if scID, ok := roleTagIds["secondCameraTagId"].(string); ok && scID != "" {
				secondCameraTagID, _ = strconv.Atoi(scID)
			}
		}
		if facialTagID == 0 {
			return nil // No tag configured
		}

		db := manager.GetInstance().Database

		// Build optional 2nd camera exclusion clause
		secondCameraCTE := ""
		secondCameraExclude := ""
		args := []interface{}{facialTagID}
		if secondCameraTagID > 0 {
			secondCameraCTE = `,
second_camera_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN second_camera_tags sct ON tr.parent_id = sct.id
)`
			secondCameraExclude = `
  AND sm.id NOT IN (
    SELECT smt2.scene_marker_id FROM scene_markers_tags smt2
    WHERE smt2.tag_id IN (SELECT id FROM second_camera_tags)
  )`
			args = append(args, secondCameraTagID)
		}

		query := `
WITH RECURSIVE facial_tags(id) AS (
  SELECT id FROM tags WHERE id = ?
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN facial_tags ft ON tr.parent_id = ft.id
)` + secondCameraCTE + `,
facial_markers AS (
  SELECT DISTINCT sm.id, sm.seconds, sm.end_seconds
  FROM scene_markers sm
  LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
  WHERE (sm.primary_tag_id IN (SELECT id FROM facial_tags)
     OR smt.tag_id IN (SELECT id FROM facial_tags))` + secondCameraExclude + `
)
SELECT COALESCE(SUM(
  (CASE WHEN end_seconds IS NOT NULL THEN end_seconds - seconds ELSE 20.0 END) 
  * 
  (CASE WHEN top_count > 0 THEN top_count ELSE 1 END)
), 0) AS total_time
FROM (
  SELECT fm.id, fm.seconds, fm.end_seconds,
    (SELECT COUNT(*) FROM scene_marker_performers smp WHERE smp.scene_marker_id = fm.id AND smp.role = 'top') AS top_count
  FROM facial_markers fm
) sub`
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 && rows[0][0] != nil {
			switch v := rows[0][0].(type) {
			case float64:
				totalSeconds = v
			case int64:
				totalSeconds = float64(v)
			case int:
				totalSeconds = float64(v)
			case []byte:
				f, _ := strconv.ParseFloat(string(v), 64)
				totalSeconds = f
			case string:
				f, _ := strconv.ParseFloat(v, 64)
				totalSeconds = f
			default:
				f, _ := strconv.ParseFloat(fmt.Sprint(v), 64)
				totalSeconds = f
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return totalSeconds, nil
}
