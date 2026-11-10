package manager

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/stashbox"
	"github.com/stretchr/testify/require"
)

func stashDBStrCustom(s string) *string { return &s }

func stashDBDateCustom(t *testing.T, s string) *models.Date {
	t.Helper()
	d, err := models.ParseDate(s)
	require.NoError(t, err)
	return &d
}

func TestCompareStashDBSceneCustom(t *testing.T) {
	local := stashDBLocalSceneCustom{
		Scene: &models.Scene{
			Title:    "Same  title",
			Details:  "Line one\r\nLine two",
			Director: "Local director",
			Date:     stashDBDateCustom(t, "2024-05-06"),
			URLs:     models.NewRelatedStrings([]string{"http://www.studio.com/a/", "https://local-only.com"}),
		},
		Studio: &stashDBLocalEntityCustom{Name: "Studio", StashIDs: []string{"old-studio"}},
		Performers: []stashDBLocalEntityCustom{
			{Name: "Linked", StashIDs: []string{"p1"}},
			{Name: "Unlinked Papi", Aliases: []string{"Papi"}},
			{Name: "Local only"},
			{Name: "Removed", StashIDs: []string{"p-gone"}},
		},
		Tags: []stashDBLocalEntityCustom{
			{Name: "kissing"},
			{Name: "4K Available", StashIDs: []string{"t-4k"}},
			{Name: "Custom role"},
			{Name: "Dropped", StashIDs: []string{"t-gone"}},
		},
	}
	remote := &stashbox.StashDBSceneCustom{
		Title:    stashDBStrCustom("Same title"),
		Code:     stashDBStrCustom(" "),
		Details:  stashDBStrCustom("Line one\nLine two"),
		Director: stashDBStrCustom("New director"),
		Date:     stashDBStrCustom("2024-05-07"),
		URLs:     []string{"https://studio.com/a", "https://studio.com/b"},
		Studio:   &stashbox.StashDBEntityCustom{ID: "new-studio", Name: "Other Studio"},
		Performers: []stashbox.StashDBEntityCustom{
			{ID: "p1", Name: "Renamed on StashDB"},
			{ID: "p2", Name: "papi"},
			{ID: "p3", Name: "New guy"},
		},
		Tags: []stashbox.StashDBEntityCustom{
			{ID: "t1", Name: "Kissing"},
			{ID: "t-4k", Name: "4K Available", Ignored: true},
			{ID: "t-new", Name: "Rimming"},
			{ID: "t-ignored", Name: "Ignored new tag", Ignored: true},
		},
	}

	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "director", Local: stashDBStrCustom("Local director"), Remote: stashDBStrCustom("New director")},
		{Field: "date", Local: stashDBStrCustom("2024-05-06"), Remote: stashDBStrCustom("2024-05-07")},
		{Field: "urls", Added: []string{"https://studio.com/b"}},
		{Field: "studio", Local: stashDBStrCustom("Studio"), Remote: stashDBStrCustom("Other Studio"), RemoteID: stashDBStrCustom("new-studio")},
		{Field: "performers", Added: []string{"New guy"}, AddedIDs: []string{"p3"}, Removed: []string{"Removed"}},
		{Field: "tags", Added: []string{"Rimming"}, AddedIDs: []string{"t-new"}, Removed: []string{"Dropped"}},
	}, compareStashDBSceneCustom(local, remote),
		"whitespace, blank StashDB values, URL spelling, name/alias matches, local-only entries, and ignored tags are not changes")

	studioOnly := stashDBLocalSceneCustom{Scene: local.Scene, Studio: local.Studio}
	same := &stashbox.StashDBSceneCustom{
		Title:  stashDBStrCustom("Same title"),
		Studio: &stashbox.StashDBEntityCustom{ID: "old-studio", Name: "Renamed studio"},
	}
	require.Empty(t, compareStashDBSceneCustom(studioOnly, same), "a linked studio matches by ID despite a new name")

	noStudio := stashDBLocalSceneCustom{Scene: &models.Scene{URLs: models.NewRelatedStrings([]string{})}}
	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "studio", Remote: stashDBStrCustom("Other Studio"), RemoteID: stashDBStrCustom("new-studio")},
	}, compareStashDBSceneCustom(noStudio, &stashbox.StashDBSceneCustom{Studio: remote.Studio}))
}

func TestCompareStashDBPerformerCustom(t *testing.T) {
	male := models.GenderEnumMale
	height := 178
	local := &models.Performer{
		Name:           "Papi",
		Disambiguation: "Local note",
		Gender:         &male,
		Birthdate:      stashDBDateCustom(t, "1990-01-02"),
		Ethnicity:      "latin",
		Country:        "mx",
		Height:         &height,
		CareerStart:    stashDBDateCustom(t, "2015"),
		Tattoos:        "Arm,  Rose",
		Aliases:        models.NewRelatedStrings([]string{"Papito"}),
		URLs:           models.NewRelatedStrings([]string{"https://x.com/papi"}),
	}
	remote := &models.ScrapedPerformer{
		Name:         stashDBStrCustom("Papi"),
		Gender:       stashDBStrCustom("MALE"),
		Aliases:      stashDBStrCustom("papito, El Papi"),
		Birthdate:    stashDBStrCustom("1990-01-02"),
		DeathDate:    stashDBStrCustom(""),
		Ethnicity:    stashDBStrCustom("Latin"),
		Country:      stashDBStrCustom("MX"),
		EyeColor:     stashDBStrCustom("Brown"),
		Height:       stashDBStrCustom("180"),
		FakeTits:     stashDBStrCustom("Na"),
		CareerStart:  stashDBStrCustom("2015"),
		CareerEnd:    stashDBStrCustom("2020"),
		Tattoos:      stashDBStrCustom("arm, rose"),
		Measurements: nil,
		URLs:         []string{"https://x.com/papi", "https://onlyfans.com/papi"},
	}

	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "aliases", Added: []string{"El Papi"}},
		{Field: "eye_color", Remote: stashDBStrCustom("Brown")},
		{Field: "height", Local: stashDBStrCustom("178"), Remote: stashDBStrCustom("180")},
		{Field: "career_end", Remote: stashDBStrCustom("2020")},
		{Field: "urls", Added: []string{"https://onlyfans.com/papi"}},
	}, compareStashDBPerformerCustom(local, remote),
		"enum-like fields ignore case, an empty StashDB disambiguation and NA breast type are not values")

	dates := &models.Performer{
		Birthdate:   stashDBDateCustom(t, "1992-01-01"),
		DeathDate:   stashDBDateCustom(t, "2020"),
		CareerStart: stashDBDateCustom(t, "2015-06-01"),
		Aliases:     models.NewRelatedStrings([]string{}),
		URLs:        models.NewRelatedStrings([]string{}),
	}
	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "death_date", Local: stashDBStrCustom("2020"), Remote: stashDBStrCustom("2020-03-04")},
	}, compareStashDBPerformerCustom(dates, &models.ScrapedPerformer{
		Birthdate: stashDBStrCustom("1992"),
		DeathDate: stashDBStrCustom("2020-03-04"),
	}), "a finer local date matches StashDB's year; a coarser one shows as is")

	renamed := &models.ScrapedPerformer{Name: stashDBStrCustom("Papi Chulo"), Aliases: stashDBStrCustom("Papi")}
	require.Equal(t, []models.StashDBFieldChangeCustom{
		{Field: "name", Local: stashDBStrCustom("Papi"), Remote: stashDBStrCustom("Papi Chulo")},
	}, compareStashDBPerformerCustom(local, renamed), "the local name is not a missing alias")
}

func TestStashDBChangeStatusCustom(t *testing.T) {
	change := models.StashDBChangeCustom{StashID: "a"}
	require.False(t, stashDBChangeStatusCustom(&change, "a"), "nothing to report")
	require.False(t, stashDBChangeStatusCustom(&change, ""))

	change.Fields = []models.StashDBFieldChangeCustom{{Field: "title"}}
	require.True(t, stashDBChangeStatusCustom(&change, "a"))
	require.Equal(t, models.StashDBChangeStatusChangedCustom, change.Status)

	change = models.StashDBChangeCustom{StashID: "a"}
	require.True(t, stashDBChangeStatusCustom(&change, "b"), "a redirect means the entry was merged")
	require.Equal(t, models.StashDBChangeStatusMergedCustom, change.Status)
	require.Equal(t, "b", *change.MergedIntoID)
}
