package sqlite

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestRelatedPerformerEthnicityCriterionCustom(t *testing.T) {
	const (
		anyPerformer = "EXISTS (SELECT 1 FROM performers_scenes pj WHERE pj.scene_id = scenes.id)"
		performer    = "EXISTS (SELECT 1 FROM performers_scenes pj JOIN performers p ON p.id = pj.performer_id WHERE pj.scene_id = scenes.id AND "
	)
	all := []interface{}{"Black", "Mixed", "Afrolatino", "Latino"}
	black := []interface{}{"Black", "Mixed", "Afrolatino"}
	latino := []interface{}{"Latino", "Afrolatino"}

	tests := []struct {
		modifier models.CriterionModifier
		want     []sqlClause
	}{
		{models.CriterionModifierIncludes, []sqlClause{
			{performer + "p.ethnicity IN (?,?,?,?))", all},
			{anyPerformer, nil},
		}},
		{models.CriterionModifierIncludesAll, []sqlClause{
			{performer + "p.ethnicity IN (?,?,?))", black},
			{performer + "p.ethnicity IN (?,?))", latino},
		}},
		{models.CriterionModifierEquals, []sqlClause{
			{"NOT " + performer + "(p.ethnicity IS NULL OR TRIM(p.ethnicity) = '' OR p.ethnicity NOT IN (?,?,?,?)))", all},
			{anyPerformer, nil},
			{performer + "p.ethnicity IN (?,?,?))", black},
			{performer + "p.ethnicity IN (?,?))", latino},
		}},
		{models.CriterionModifierNotEquals, []sqlClause{
			{"NOT " + performer + "p.ethnicity IN (?,?,?,?))", all},
			{anyPerformer, nil},
		}},
	}

	for _, tt := range tests {
		t.Run(string(tt.modifier), func(t *testing.T) {
			f := &filterBuilder{}
			f.handleCriterion(context.Background(), scenePerformersCustom.ethnicityCriterionHandler(
				&models.StringCriterionInput{Modifier: tt.modifier, Value: "Black, Latino,"},
			))
			assert.Equal(t, tt.want, f.whereClauses)
		})
	}
}

func TestRelatedPerformerCountryCriterionCustom(t *testing.T) {
	tests := []struct {
		name    string
		related relatedPerformersCustom
		want    string
	}{
		{"gallery", galleryPerformersCustom, "EXISTS (SELECT 1 FROM performers_galleries pj JOIN performers p ON p.id = pj.performer_id WHERE pj.gallery_id = galleries.id AND p.country IN (?,?))"},
		{"image", imagePerformersCustom, "EXISTS (SELECT 1 FROM performers_images pj JOIN performers p ON p.id = pj.performer_id WHERE pj.image_id = images.id AND p.country IN (?,?))"},
		{"marker uses its scene", sceneMarkerPerformersCustom, "EXISTS (SELECT 1 FROM performers_scenes pj JOIN performers p ON p.id = pj.performer_id WHERE pj.scene_id = scene_markers.scene_id AND p.country IN (?,?))"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &filterBuilder{}
			f.handleCriterion(context.Background(), tt.related.countryCriterionHandler(
				&models.StringCriterionInput{Modifier: models.CriterionModifierIncludes, Value: "MX,US"},
			))
			if assert.Len(t, f.whereClauses, 2) {
				assert.Equal(t, tt.want, f.whereClauses[0].sql)
				assert.Equal(t, []interface{}{"MX", "US"}, f.whereClauses[0].args)
			}
		})
	}
}

func TestRelatedPerformerCriteriaIgnoreEmptySelectionCustom(t *testing.T) {
	for _, input := range []*models.StringCriterionInput{
		nil,
		{Modifier: models.CriterionModifierIncludes, Value: " , "},
		{Modifier: models.CriterionModifier("BOGUS"), Value: "MX"},
	} {
		f := &filterBuilder{}
		f.handleCriterion(context.Background(), imagePerformersCustom.ethnicityCriterionHandler(input))
		f.handleCriterion(context.Background(), imagePerformersCustom.countryCriterionHandler(input))
		assert.Empty(t, f.whereClauses)
	}
}
