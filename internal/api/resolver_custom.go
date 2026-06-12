package api

// CUSTOM: This file contains all custom query resolver functions and types
// added to this fork. These are NOT present in upstream Stash.

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
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

// SceneOYearCounts returns counts of scene orgasm events grouped by year ascending.
func (r *queryResolver) SceneOYearCounts(ctx context.Context) (ret []*SceneOYearCount, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT CAST(strftime('%Y', o_date) AS INT) AS year, COUNT(*) AS cnt FROM scenes_o_dates GROUP BY year ORDER BY year ASC"
		_, rows, err := db.QuerySQL(ctx, query, nil)
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
