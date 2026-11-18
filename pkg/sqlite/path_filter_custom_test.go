//go:build integration
// +build integration

package sqlite_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
)

// TestImageQueryPathEqualsFolderCustom checks that Equals/Not Equals on a
// folder path (as picked in the folder selector) match its direct files.
func TestImageQueryPathEqualsFolderCustom(t *testing.T) {
	folderPath := folderPaths[folderIdxWithImageFiles]

	withTxn(func(ctx context.Context) error {
		all := queryImages(ctx, t, db.Image, nil, nil)
		inFolder := 0
		for _, image := range all {
			if filepath.Dir(image.Path) == folderPath {
				inFolder++
			}
		}
		if !assert.Positive(t, inFolder) {
			return nil
		}

		for _, value := range []string{folderPath, folderPath + string(filepath.Separator)} {
			equals := queryPathCustom(ctx, t, db.Image, value, models.CriterionModifierEquals)
			assert.Len(t, equals, inFolder, "equals %q", value)
			for _, image := range equals {
				assert.Equal(t, folderPath, filepath.Dir(image.Path))
			}

			notEquals := queryPathCustom(ctx, t, db.Image, value, models.CriterionModifierNotEquals)
			assert.Len(t, notEquals, len(all)-inFolder, "not equals %q", value)
			for _, image := range notEquals {
				assert.NotEqual(t, folderPath, filepath.Dir(image.Path))
			}
		}

		return nil
	})
}

func queryPathCustom(ctx context.Context, t *testing.T, qb models.ImageReader, value string, modifier models.CriterionModifier) []*models.Image {
	return queryImages(ctx, t, qb, &models.ImageFilterType{
		Path: &models.StringCriterionInput{Value: value, Modifier: modifier},
	}, nil)
}
