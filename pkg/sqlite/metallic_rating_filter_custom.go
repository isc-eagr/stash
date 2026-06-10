package sqlite

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
)

// CUSTOM: begin - metallic rating filter helpers
const (
	metallicTierBronze              = "bronze"
	metallicTierSilver              = "silver"
	metallicTierGold                = "gold"
	metallicTierRoyalSapphire       = "royal_sapphire"
	metallicIncludeNonMetallicCards = "__include_non_metallic__"
)

type metallicRatingThresholds struct {
	bronze        int
	silver        int
	gold          int
	royalSapphire int
}

type metallicRatingOverrideTags struct {
	bronze        string
	silver        string
	gold          string
	royalSapphire string
	goat          string
}

type metallicRatingFilterConfig struct {
	primaryTable string
	ratingColumn string
	tagJoinTable string
	tagJoinFK    string
	thresholds   metallicRatingThresholds
	overrides    metallicRatingOverrideTags
}

var defaultMetallicRatingThresholds = metallicRatingThresholds{
	bronze:        60,
	silver:        73,
	gold:          84,
	royalSapphire: 90,
}

func metallicRatingCriterionHandler(
	criterion *models.MultiCriterionInput,
	primaryTable string,
	ratingColumn string,
	tagJoinTable string,
	tagJoinFK string,
	thresholdEntity string,
) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion == nil {
			return
		}

		cfg := metallicRatingFilterConfig{
			primaryTable: primaryTable,
			ratingColumn: ratingColumn,
			tagJoinTable: tagJoinTable,
			tagJoinFK:    tagJoinFK,
			thresholds:   getMetallicRatingThresholds(thresholdEntity),
			overrides:    getMetallicRatingOverrideTags(),
		}

		includes := normalizeMetallicRatingTiers(criterion.Value)
		excludes := normalizeMetallicRatingTiers(criterion.Excludes)
		includeNonMetallic := hasMetallicRatingOption(criterion.Excludes, metallicIncludeNonMetallicCards)

		switch criterion.Modifier {
		case models.CriterionModifierIncludes, models.CriterionModifierIncludesAll, models.CriterionModifierEquals:
			// A card can only have one final metallic style, so IncludesAll behaves as Includes.
		case models.CriterionModifierExcludes, models.CriterionModifierNotEquals:
			includeNonMetallic = includeNonMetallic ||
				hasMetallicRatingOption(criterion.Value, metallicIncludeNonMetallicCards)
			excludes = append(excludes, includes...)
			includes = nil
		default:
			f.setError(fmt.Errorf("invalid modifier %s for metallic rating criterion", criterion.Modifier))
			return
		}

		if len(includes) > 0 {
			f.whereClauses = append(f.whereClauses, cfg.tiersClause(includes))
		}
		if len(excludes) > 0 {
			if !includeNonMetallic {
				f.whereClauses = append(f.whereClauses, cfg.anyMetallicClause())
				f.whereClauses = append(f.whereClauses, cfg.tiersClause(excludes).not())
			} else {
				f.whereClauses = append(f.whereClauses, notTrueClause(cfg.tiersClause(excludes)))
			}
		}
	}
}

func notTrueClause(clause sqlClause) sqlClause {
	return makeClause("COALESCE(("+clause.sql+"), 0) = 0", clause.args...)
}

func hasMetallicRatingOption(values []string, option string) bool {
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), option) {
			return true
		}
	}

	return false
}

func normalizeMetallicRatingTiers(values []string) []string {
	seen := map[string]bool{}
	var ret []string

	for _, value := range values {
		tier := strings.ToLower(strings.TrimSpace(value))
		switch tier {
		case metallicTierBronze, metallicTierSilver, metallicTierGold, metallicTierRoyalSapphire:
			if !seen[tier] {
				ret = append(ret, tier)
				seen[tier] = true
			}
		}
	}

	return ret
}

func (c metallicRatingFilterConfig) tiersClause(tiers []string) sqlClause {
	var clauses []sqlClause
	for _, tier := range tiers {
		clauses = append(clauses, c.tierClause(tier))
	}

	if len(clauses) == 0 {
		return makeClause("0 = 1")
	}

	return orClauses(clauses...)
}

func (c metallicRatingFilterConfig) anyMetallicClause() sqlClause {
	return c.tiersClause([]string{
		metallicTierBronze,
		metallicTierSilver,
		metallicTierGold,
		metallicTierRoyalSapphire,
	})
}

func (c metallicRatingFilterConfig) tierClause(tier string) sqlClause {
	var clauses []sqlClause

	if overrideTagIDs := c.overrideTagIDsForTier(tier); len(overrideTagIDs) > 0 {
		clauses = append(clauses, andClauses(
			c.hasNoAnyTagClause(c.higherPriorityOverrideTagIDsForTier(tier)),
			c.hasAnyTagClause(overrideTagIDs),
		))
	}

	clauses = append(clauses, andClauses(c.hasNoOverrideTagClause(), c.ratingRangeClause(tier)))

	return orClauses(clauses...)
}

func (c metallicRatingFilterConfig) ratingRangeClause(tier string) sqlClause {
	switch tier {
	case metallicTierBronze:
		return makeClause(fmt.Sprintf("%s >= ? AND %s < ?", c.ratingColumn, c.ratingColumn), c.thresholds.bronze, c.thresholds.silver)
	case metallicTierSilver:
		return makeClause(fmt.Sprintf("%s >= ? AND %s < ?", c.ratingColumn, c.ratingColumn), c.thresholds.silver, c.thresholds.gold)
	case metallicTierGold:
		return makeClause(fmt.Sprintf("%s >= ? AND %s < ?", c.ratingColumn, c.ratingColumn), c.thresholds.gold, c.thresholds.royalSapphire)
	case metallicTierRoyalSapphire:
		return makeClause(fmt.Sprintf("%s >= ?", c.ratingColumn), c.thresholds.royalSapphire)
	default:
		return makeClause("0 = 1")
	}
}

func (c metallicRatingFilterConfig) overrideTagIDsForTier(tier string) []string {
	switch tier {
	case metallicTierBronze:
		return nonEmptyStrings(c.overrides.bronze)
	case metallicTierSilver:
		return nonEmptyStrings(c.overrides.silver)
	case metallicTierGold:
		return nonEmptyStrings(c.overrides.gold)
	case metallicTierRoyalSapphire:
		return nonEmptyStrings(c.overrides.royalSapphire, c.overrides.goat)
	default:
		return nil
	}
}

func (c metallicRatingFilterConfig) higherPriorityOverrideTagIDsForTier(tier string) []string {
	switch tier {
	case metallicTierBronze:
		return nonEmptyStrings(c.overrides.silver, c.overrides.gold, c.overrides.royalSapphire, c.overrides.goat)
	case metallicTierSilver:
		return nonEmptyStrings(c.overrides.gold, c.overrides.royalSapphire, c.overrides.goat)
	case metallicTierGold:
		return nonEmptyStrings(c.overrides.royalSapphire, c.overrides.goat)
	default:
		return nil
	}
}

func (c metallicRatingFilterConfig) allOverrideTagIDs() []string {
	return nonEmptyStrings(
		c.overrides.bronze,
		c.overrides.silver,
		c.overrides.gold,
		c.overrides.royalSapphire,
		c.overrides.goat,
	)
}

func (c metallicRatingFilterConfig) hasNoOverrideTagClause() sqlClause {
	return c.hasNoAnyTagClause(c.allOverrideTagIDs())
}

func (c metallicRatingFilterConfig) hasNoAnyTagClause(tagIDs []string) sqlClause {
	if len(tagIDs) == 0 {
		return makeClause("1 = 1")
	}

	return makeClause(
		fmt.Sprintf(
			"NOT EXISTS (SELECT 1 FROM %s mrt WHERE mrt.%s = %s.id AND mrt.tag_id IN %s)",
			c.tagJoinTable,
			c.tagJoinFK,
			c.primaryTable,
			getInBinding(len(tagIDs)),
		),
		stringSliceToInterfaces(tagIDs)...,
	)
}

func (c metallicRatingFilterConfig) hasAnyTagClause(tagIDs []string) sqlClause {
	return makeClause(
		fmt.Sprintf(
			"EXISTS (SELECT 1 FROM %s mrt WHERE mrt.%s = %s.id AND mrt.tag_id IN %s)",
			c.tagJoinTable,
			c.tagJoinFK,
			c.primaryTable,
			getInBinding(len(tagIDs)),
		),
		stringSliceToInterfaces(tagIDs)...,
	)
}

func getMetallicRatingThresholds(entityType string) metallicRatingThresholds {
	ret := defaultMetallicRatingThresholds
	uiConfig := config.GetInstance().GetUIConfiguration()
	thresholds := mapValue(uiConfig, "ratingCardThresholds")

	if entityType == "performer" {
		if performerThresholds := mapValue(thresholds, "performer"); performerThresholds != nil {
			applyMetallicThresholdMap(&ret, performerThresholds)
		} else {
			applyMetallicThresholdMap(&ret, thresholds)
		}
		return ret
	}

	if sceneThresholds := mapValue(thresholds, "scene"); sceneThresholds != nil {
		applyMetallicThresholdMap(&ret, sceneThresholds)
	} else {
		applyMetallicThresholdMap(&ret, thresholds)
	}
	return ret
}

func applyMetallicThresholdMap(thresholds *metallicRatingThresholds, values map[string]interface{}) {
	if values == nil {
		return
	}

	if value, ok := intConfigValue(values["bronze"]); ok {
		thresholds.bronze = clampMetallicThreshold(value)
	}
	if value, ok := intConfigValue(values["silver"]); ok {
		thresholds.silver = clampMetallicThreshold(value)
	}
	if value, ok := intConfigValue(values["gold"]); ok {
		thresholds.gold = clampMetallicThreshold(value)
	}
	if value, ok := intConfigValue(values["royalSapphire"]); ok {
		thresholds.royalSapphire = clampMetallicThreshold(value)
	}
}

func getMetallicRatingOverrideTags() metallicRatingOverrideTags {
	uiConfig := config.GetInstance().GetUIConfiguration()
	overrideTags := mapValue(uiConfig, "ratingCardOverrideTagIds")
	roleTags := mapValue(uiConfig, "roleTagIds")

	return metallicRatingOverrideTags{
		bronze:        stringConfigValue(overrideTags["bronzeTagId"]),
		silver:        stringConfigValue(overrideTags["silverTagId"]),
		gold:          stringConfigValue(overrideTags["goldTagId"]),
		royalSapphire: stringConfigValue(overrideTags["royalSapphireTagId"]),
		goat:          stringConfigValue(roleTags["goatTagId"]),
	}
}

func mapValue(values map[string]interface{}, key string) map[string]interface{} {
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

func intConfigValue(value interface{}) (int, bool) {
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
		if err == nil {
			return parsed, true
		}
	}

	return 0, false
}

func stringConfigValue(value interface{}) string {
	if value == nil {
		return ""
	}

	return strings.TrimSpace(fmt.Sprint(value))
}

func clampMetallicThreshold(value int) int {
	if value < 0 {
		return 0
	}
	return value
}

func nonEmptyStrings(values ...string) []string {
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

func stringSliceToInterfaces(values []string) []interface{} {
	ret := make([]interface{}, len(values))
	for i, value := range values {
		ret[i] = value
	}
	return ret
}

// CUSTOM: end
