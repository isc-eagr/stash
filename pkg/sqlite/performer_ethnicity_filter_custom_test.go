package sqlite

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestExpandPerformerEthnicitySelectionsCustom(t *testing.T) {
	assert.Equal(t,
		[]string{"Black", "Mixed", "Afrolatino", "Latino"},
		expandPerformerEthnicitySelectionsCustom(" Black, Latino, Black "),
	)
}

func TestPerformerEthnicityCriterionHandlerCustom(t *testing.T) {
	tests := []struct {
		name     string
		modifier models.CriterionModifier
		wantSQL  string
	}{
		{
			name:     "selected values match any expanded ethnicity",
			modifier: models.CriterionModifierEquals,
			wantSQL:  "performers.ethnicity IN (?, ?, ?, ?)",
		},
		{
			name:     "includes uses selected database values",
			modifier: models.CriterionModifierIncludes,
			wantSQL:  "performers.ethnicity IN (?, ?, ?, ?)",
		},
		{
			name:     "excluded values reject every expanded ethnicity",
			modifier: models.CriterionModifierNotEquals,
			wantSQL:  "performers.ethnicity NOT IN (?, ?, ?, ?)",
		},
		{
			name:     "excludes uses selected database values",
			modifier: models.CriterionModifierExcludes,
			wantSQL:  "performers.ethnicity NOT IN (?, ?, ?, ?)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &filterBuilder{}
			f.handleCriterion(context.Background(), performerEthnicityCriterionHandlerCustom(
				&models.StringCriterionInput{
					Modifier: tt.modifier,
					Value:    "Black,Latino",
				},
				"performers.ethnicity",
			))

			if assert.Len(t, f.whereClauses, 1) {
				assert.Equal(t, tt.wantSQL, f.whereClauses[0].sql)
				assert.Equal(t, []interface{}{"Black", "Mixed", "Afrolatino", "Latino"}, f.whereClauses[0].args)
			}
		})
	}
}

func TestPerformerEthnicityCriterionHandlerCustomPreservesNullFilter(t *testing.T) {
	f := &filterBuilder{}
	f.handleCriterion(context.Background(), performerEthnicityCriterionHandlerCustom(
		&models.StringCriterionInput{Modifier: models.CriterionModifierIsNull},
		"performers.ethnicity",
	))

	if assert.Len(t, f.whereClauses, 1) {
		assert.Equal(t, "(performers.ethnicity IS NULL OR TRIM(performers.ethnicity) = '')", f.whereClauses[0].sql)
	}
}

func TestPerformerSelectionCriteriaSupportUnknownAndMultipleCountries(t *testing.T) {
	tests := []struct {
		name     string
		handler  criterionHandlerFunc
		wantSQL  string
		wantArgs []interface{}
	}{
		{
			name: "ethnicity combines an unknown value with selected values",
			handler: performerEthnicityCriterionHandlerCustom(
				&models.StringCriterionInput{
					Modifier: models.CriterionModifierIncludes,
					Value:    "Latino,__unknown__",
				},
				"performers.ethnicity",
			),
			wantSQL:  "((performers.ethnicity IS NULL OR TRIM(performers.ethnicity) = '') OR performers.ethnicity IN (?, ?))",
			wantArgs: []interface{}{"Latino", "Afrolatino"},
		},
		{
			name: "country matches every selected value",
			handler: performerCountryCriterionHandlerCustom(
				&models.StringCriterionInput{
					Modifier: models.CriterionModifierIncludes,
					Value:    "MX,US",
				},
				"performers.country",
			),
			wantSQL:  "performers.country IN (?, ?)",
			wantArgs: []interface{}{"MX", "US"},
		},
		{
			name: "country matches blank and null values for unknown",
			handler: performerCountryCriterionHandlerCustom(
				&models.StringCriterionInput{
					Modifier: models.CriterionModifierIncludes,
					Value:    "__unknown__",
				},
				"performers.country",
			),
			wantSQL:  "(performers.country IS NULL OR TRIM(performers.country) = '')",
			wantArgs: []interface{}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &filterBuilder{}
			f.handleCriterion(context.Background(), tt.handler)
			if assert.Len(t, f.whereClauses, 1) {
				assert.Equal(t, tt.wantSQL, f.whereClauses[0].sql)
				assert.Equal(t, tt.wantArgs, f.whereClauses[0].args)
			}
		})
	}
}
