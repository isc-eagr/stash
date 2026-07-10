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
