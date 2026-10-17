package api

import (
	"context"
	"errors"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func stashDBApplyStrCustom(s string) *string { return &s }

// stashDBFakeResolverCustom resolves "field:stashID" first, then "field:name".
func stashDBFakeResolverCustom(known map[string]int, calls *[]string) stashDBResolveCustom {
	return func(_ context.Context, field string, stashID *string, name string) (int, bool, error) {
		id := "<none>"
		if stashID != nil {
			id = *stashID
			if v, ok := known[field+":"+id]; ok {
				*calls = append(*calls, field+":"+id+"/"+name)
				return v, true, nil
			}
		}
		*calls = append(*calls, field+":"+id+"/"+name)
		v, ok := known[field+":"+name]
		return v, ok, nil
	}
}

func TestStashDBSceneUpdateCustom(t *testing.T) {
	scene := &models.Scene{
		ID:           3,
		URLs:         models.NewRelatedStrings([]string{"https://local.com"}),
		PerformerIDs: models.NewRelatedIDs([]int{10}),
		TagIDs:       models.NewRelatedIDs([]int{20}),
	}
	fields := []models.StashDBFieldChangeCustom{
		{Field: "title", Local: stashDBApplyStrCustom("Old"), Remote: stashDBApplyStrCustom("New")},
		{Field: "director", Remote: stashDBApplyStrCustom("Hidden director")},
		{Field: "date", Remote: stashDBApplyStrCustom("2024-05-07")},
		{Field: "urls", Added: []string{"https://studio.com/b"}},
		{Field: "studio", Local: stashDBApplyStrCustom("Studio"), Remote: stashDBApplyStrCustom("Other Studio"), RemoteID: stashDBApplyStrCustom("s1")},
		{Field: "performers", Added: []string{"By ID", "By name", "Nobody", "Already here"}, AddedIDs: []string{"p1", "p2", "p3", "p4"}, Removed: []string{"Gone"}},
		{Field: "tags", Added: []string{"Rimming"}, AddedIDs: []string{"t1"}},
	}
	known := map[string]int{
		"studio:s1":               5,
		"performers:p1":           11,
		"performers:By name":      12,
		"performers:Already here": 10,
	}
	var calls []string
	requested := []string{"title", "date", "urls", "studio", "performers", "tags", "stale"}
	input, inputMap, left, err := stashDBSceneUpdateCustom(context.Background(), scene, fields, requested, stashDBFakeResolverCustom(known, &calls))
	require.NoError(t, err)

	require.Equal(t, models.SceneUpdateInput{
		ID:           "3",
		Title:        stashDBApplyStrCustom("New"),
		Date:         stashDBApplyStrCustom("2024-05-07"),
		Urls:         []string{"https://local.com", "https://studio.com/b"},
		StudioID:     stashDBApplyStrCustom("5"),
		PerformerIds: []string{"10", "11", "12"},
	}, input, "URLs append, entities add once, and an unmatched tag writes nothing")
	require.ElementsMatch(t, []string{"title", "date", "urls", "studio_id", "performer_ids"}, changesetTranslator{inputMap: inputMap}.getFields())
	require.Equal(t, []string{"https://local.com"}, scene.URLs.List(), "the loaded scene is not mutated")
	require.Equal(t, []int{10}, scene.PerformerIDs.List())

	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "director", Remote: stashDBApplyStrCustom("Hidden director")},
		{Field: "performers", Added: []string{"Nobody"}, AddedIDs: []string{"p3"}, Removed: []string{"Gone"}},
		{Field: "tags", Added: []string{"Rimming"}, AddedIDs: []string{"t1"}},
	}, left, "unrequested fields, unmatched entities, and removed entries stay in report order")
	require.Equal(t, []string{
		"studio:s1/Other Studio",
		"performers:p1/By ID", "performers:p2/By name", "performers:p3/Nobody", "performers:p4/Already here",
		"tags:t1/Rimming",
	}, calls, "entities resolve with their StashDB IDs")
}

func TestStashDBSceneUpdateUnmatchedCustom(t *testing.T) {
	scene := &models.Scene{ID: 1, URLs: models.NewRelatedStrings([]string{}), PerformerIDs: models.NewRelatedIDs([]int{}), TagIDs: models.NewRelatedIDs([]int{})}
	fields := []models.StashDBFieldChangeCustom{
		{Field: "studio", Remote: stashDBApplyStrCustom("Unknown")},
		// Saved before IDs were stored: resolves by name only.
		{Field: "tags", Added: []string{"Kissing", "Nope"}},
		{Field: "performers", Removed: []string{"Gone"}},
	}
	var calls []string
	input, inputMap, left, err := stashDBSceneUpdateCustom(context.Background(), scene, fields, []string{"studio", "tags", "performers"},
		stashDBFakeResolverCustom(map[string]int{"tags:Kissing": 7}, &calls))
	require.NoError(t, err)
	require.Equal(t, models.SceneUpdateInput{ID: "1", TagIds: []string{"7"}}, input)
	require.Len(t, inputMap, 1)
	require.Equal(t, []string{"studio:<none>/Unknown", "tags:<none>/Kissing", "tags:<none>/Nope"}, calls)
	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "studio", Remote: stashDBApplyStrCustom("Unknown")},
		{Field: "tags", Added: []string{"Nope"}},
		{Field: "performers", Removed: []string{"Gone"}},
	}, left, "a studio with no local match is skipped, never created")

	resolveErr := errors.New("db down")
	_, _, _, err = stashDBSceneUpdateCustom(context.Background(), scene, fields, []string{"tags"},
		func(context.Context, string, *string, string) (int, bool, error) { return 0, false, resolveErr })
	require.ErrorIs(t, err, resolveErr)
}

func TestStashDBPerformerUpdateCustom(t *testing.T) {
	p := &models.Performer{
		ID:      9,
		Aliases: models.NewRelatedStrings([]string{"Papi"}),
		URLs:    models.NewRelatedStrings([]string{"https://x.com/papi"}),
	}
	fields := []models.StashDBFieldChangeCustom{
		{Field: "name", Local: stashDBApplyStrCustom("Old"), Remote: stashDBApplyStrCustom("New")},
		{Field: "aliases", Added: []string{"El Papi"}},
		{Field: "gender", Remote: stashDBApplyStrCustom("MALE")},
		{Field: "height", Remote: stashDBApplyStrCustom("180")},
		{Field: "career_start", Remote: stashDBApplyStrCustom("2015")},
		{Field: "fake_tits", Remote: stashDBApplyStrCustom("Natural")},
		{Field: "urls", Added: []string{"https://onlyfans.com/papi"}},
		{Field: "ethnicity", Remote: stashDBApplyStrCustom("Latin")},
	}
	requested := []string{"name", "aliases", "gender", "height", "career_start", "fake_tits", "urls"}
	input, inputMap, left, err := stashDBPerformerUpdateCustom(p, fields, requested)
	require.NoError(t, err)

	male := models.GenderEnumMale
	height := 180
	require.Equal(t, models.PerformerUpdateInput{
		ID:          "9",
		Name:        stashDBApplyStrCustom("New"),
		AliasList:   []string{"Papi", "El Papi"},
		Gender:      &male,
		HeightCm:    &height,
		CareerStart: stashDBApplyStrCustom("2015"),
		FakeTits:    stashDBApplyStrCustom("Natural"),
		Urls:        []string{"https://x.com/papi", "https://onlyfans.com/papi"},
	}, input)
	require.ElementsMatch(t, []string{"name", "alias_list", "gender", "height_cm", "career_start", "fake_tits", "urls"},
		changesetTranslator{inputMap: inputMap}.getFields())
	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "ethnicity", Remote: stashDBApplyStrCustom("Latin")},
	}, left)

	// The update builds into a partial as performerUpdate would.
	partial, err := performerPartialFromInput(input, changesetTranslator{inputMap: inputMap})
	require.NoError(t, err)
	require.Equal(t, models.NewOptionalString("New"), partial.Name)
	require.Equal(t, models.NewOptionalString("MALE"), partial.Gender)
	require.Equal(t, models.NewOptionalInt(180), partial.Height)
	require.Equal(t, 2015, partial.CareerStart.Value.Year())
	require.False(t, partial.CareerEnd.Set, "career end stays untouched")
	require.Equal(t, &models.UpdateStrings{Values: []string{"Papi", "El Papi"}, Mode: models.RelationshipUpdateModeSet}, partial.Aliases)
	require.False(t, partial.Ethnicity.Set)

	for _, bad := range []models.StashDBFieldChangeCustom{
		{Field: "gender", Remote: stashDBApplyStrCustom("ROBOT")},
		{Field: "height", Remote: stashDBApplyStrCustom("tall")},
		{Field: "weight", Remote: stashDBApplyStrCustom("80")},
	} {
		_, _, _, err := stashDBPerformerUpdateCustom(p, []models.StashDBFieldChangeCustom{bad}, []string{bad.Field})
		require.Error(t, err, bad.Field)
	}
}
