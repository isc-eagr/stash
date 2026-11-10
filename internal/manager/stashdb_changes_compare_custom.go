package manager

// CUSTOM: StashDB Changes field comparison. Only values StashDB has count, so
// an empty StashDB field, a local-only URL or alias, or an unlinked local tag
// or performer never shows as a change.

import (
	"slices"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/stashbox"
)

// stashDBLocalEntityCustom is a local studio, performer, or tag with its
// StashDB IDs on the checked endpoint.
type stashDBLocalEntityCustom struct {
	Name     string
	Aliases  []string
	StashIDs []string
}

type stashDBLocalSceneCustom struct {
	// URLs must be loaded.
	Scene      *models.Scene
	Studio     *stashDBLocalEntityCustom
	Performers []stashDBLocalEntityCustom
	Tags       []stashDBLocalEntityCustom
}

func compareStashDBSceneCustom(local stashDBLocalSceneCustom, remote *stashbox.StashDBSceneCustom) []models.StashDBFieldChangeCustom {
	s := local.Scene
	var ret []models.StashDBFieldChangeCustom
	ret = appendStashDBValueChangeCustom(ret, "title", s.Title, remote.Title, false)
	ret = appendStashDBValueChangeCustom(ret, "code", s.Code, remote.Code, false)
	ret = appendStashDBValueChangeCustom(ret, "details", s.Details, remote.Details, false)
	ret = appendStashDBValueChangeCustom(ret, "director", s.Director, remote.Director, false)
	ret = appendStashDBDateChangeCustom(ret, "date", s.Date, remote.Date)
	ret = appendStashDBURLChangeCustom(ret, s.URLs.List(), remote.URLs)
	if remote.Studio != nil && (local.Studio == nil || !local.Studio.matchesCustom(*remote.Studio)) {
		change := models.StashDBFieldChangeCustom{Field: "studio", Remote: &remote.Studio.Name, RemoteID: &remote.Studio.ID}
		if local.Studio != nil {
			change.Local = &local.Studio.Name
		}
		ret = append(ret, change)
	}
	ret = appendStashDBEntityChangeCustom(ret, "performers", local.Performers, remote.Performers)
	ret = appendStashDBEntityChangeCustom(ret, "tags", local.Tags, remote.Tags)
	return ret
}

func compareStashDBPerformerCustom(local *models.Performer, remote *models.ScrapedPerformer) []models.StashDBFieldChangeCustom {
	var gender string
	if local.Gender != nil {
		gender = local.Gender.String()
	}
	var height string
	if local.Height != nil {
		height = strconv.Itoa(*local.Height)
	}
	// StashDB marks men's breast type as NA, which is not a value.
	breastType := remote.FakeTits
	if breastType != nil && strings.EqualFold(*breastType, "na") {
		breastType = nil
	}

	var ret []models.StashDBFieldChangeCustom
	ret = appendStashDBValueChangeCustom(ret, "name", local.Name, remote.Name, false)
	ret = appendStashDBValueChangeCustom(ret, "disambiguation", local.Disambiguation, remote.Disambiguation, false)
	ret = appendStashDBAliasChangeCustom(ret, local, remote.Aliases)
	ret = appendStashDBValueChangeCustom(ret, "gender", gender, remote.Gender, true)
	ret = appendStashDBDateChangeCustom(ret, "birthdate", local.Birthdate, remote.Birthdate)
	ret = appendStashDBDateChangeCustom(ret, "death_date", local.DeathDate, remote.DeathDate)
	ret = appendStashDBValueChangeCustom(ret, "ethnicity", local.Ethnicity, remote.Ethnicity, true)
	ret = appendStashDBValueChangeCustom(ret, "country", local.Country, remote.Country, true)
	ret = appendStashDBValueChangeCustom(ret, "eye_color", local.EyeColor, remote.EyeColor, true)
	ret = appendStashDBValueChangeCustom(ret, "hair_color", local.HairColor, remote.HairColor, true)
	ret = appendStashDBValueChangeCustom(ret, "height", height, remote.Height, false)
	ret = appendStashDBValueChangeCustom(ret, "measurements", local.Measurements, remote.Measurements, true)
	ret = appendStashDBValueChangeCustom(ret, "fake_tits", local.FakeTits, breastType, true)
	ret = appendStashDBValueChangeCustom(ret, "career_start", stashDBYearCustom(local.CareerStart), remote.CareerStart, false)
	ret = appendStashDBValueChangeCustom(ret, "career_end", stashDBYearCustom(local.CareerEnd), remote.CareerEnd, false)
	ret = appendStashDBValueChangeCustom(ret, "tattoos", local.Tattoos, remote.Tattoos, true)
	ret = appendStashDBValueChangeCustom(ret, "piercings", local.Piercings, remote.Piercings, true)
	ret = appendStashDBURLChangeCustom(ret, local.URLs.List(), remote.URLs)
	return ret
}

// Whitespace runs compare as one space; fold also ignores case.
func stashDBSameValueCustom(a, b string, fold bool) bool {
	a, b = strings.Join(strings.Fields(a), " "), strings.Join(strings.Fields(b), " ")
	if fold {
		return strings.EqualFold(a, b)
	}
	return a == b
}

func appendStashDBValueChangeCustom(ret []models.StashDBFieldChangeCustom, field, local string, remote *string, fold bool) []models.StashDBFieldChangeCustom {
	if remote == nil {
		return ret
	}
	r := strings.TrimSpace(strings.ReplaceAll(*remote, "\r\n", "\n"))
	l := strings.TrimSpace(strings.ReplaceAll(local, "\r\n", "\n"))
	if r == "" || stashDBSameValueCustom(l, r, fold) {
		return ret
	}
	change := models.StashDBFieldChangeCustom{Field: field, Remote: &r}
	if l != "" {
		change.Local = &l
	}
	return append(ret, change)
}

// Dates compare at the precision StashDB gives, so a local 1992-01-01 matches
// a StashDB 1992. A coarser local date keeps its own precision.
func appendStashDBDateChangeCustom(ret []models.StashDBFieldChangeCustom, field string, local *models.Date, remote *string) []models.StashDBFieldChangeCustom {
	var l string
	if local != nil {
		l = local.String()
	}
	if remote != nil {
		if d, err := models.ParseDate(strings.TrimSpace(*remote)); err == nil {
			v := d.String()
			remote = &v
			if local != nil && local.Precision < d.Precision {
				l = models.Date{Time: local.Time, Precision: d.Precision}.String()
			}
		}
	}
	return appendStashDBValueChangeCustom(ret, field, l, remote, false)
}

func stashDBYearCustom(d *models.Date) string {
	if d == nil {
		return ""
	}
	return strconv.Itoa(d.Year())
}

// URLs match ignoring case, scheme, "www.", and a trailing slash.
func stashDBURLKeyCustom(u string) string {
	u = strings.ToLower(strings.TrimSpace(u))
	u = strings.TrimPrefix(strings.TrimPrefix(u, "https://"), "http://")
	return strings.TrimRight(strings.TrimPrefix(u, "www."), "/")
}

func appendStashDBURLChangeCustom(ret []models.StashDBFieldChangeCustom, local, remote []string) []models.StashDBFieldChangeCustom {
	seen := make(map[string]bool, len(local)+len(remote))
	for _, u := range local {
		seen[stashDBURLKeyCustom(u)] = true
	}
	var added []string
	for _, u := range remote {
		key := stashDBURLKeyCustom(u)
		if key != "" && !seen[key] {
			seen[key] = true
			added = append(added, strings.TrimSpace(u))
		}
	}
	if len(added) == 0 {
		return ret
	}
	return append(ret, models.StashDBFieldChangeCustom{Field: "urls", Added: added})
}

func appendStashDBAliasChangeCustom(ret []models.StashDBFieldChangeCustom, local *models.Performer, remote *string) []models.StashDBFieldChangeCustom {
	if remote == nil {
		return ret
	}
	have := append([]string{local.Name}, local.Aliases.List()...)
	var added []string
	// Scraped aliases are joined with ", ", as the scrape dialog splits them.
	for _, alias := range strings.Split(*remote, ",") {
		alias = strings.TrimSpace(alias)
		if alias == "" || slices.ContainsFunc(have, func(h string) bool { return strings.EqualFold(strings.TrimSpace(h), alias) }) {
			continue
		}
		have = append(have, alias)
		added = append(added, alias)
	}
	if len(added) == 0 {
		return ret
	}
	return append(ret, models.StashDBFieldChangeCustom{Field: "aliases", Added: added})
}

// A local entity matches by StashDB ID, or by name or alias, so stale links and
// unlinked local copies are not reported twice.
func (e stashDBLocalEntityCustom) matchesCustom(remote stashbox.StashDBEntityCustom) bool {
	if slices.Contains(e.StashIDs, remote.ID) {
		return true
	}
	name := strings.TrimSpace(remote.Name)
	return slices.ContainsFunc(append([]string{e.Name}, e.Aliases...), func(n string) bool {
		return strings.EqualFold(strings.TrimSpace(n), name)
	})
}

// Added lists StashDB entities the scene lacks locally, with their StashDB IDs
// for applying them; Removed lists local entities linked to StashDB that the
// StashDB scene no longer has.
func appendStashDBEntityChangeCustom(ret []models.StashDBFieldChangeCustom, field string, local []stashDBLocalEntityCustom, remote []stashbox.StashDBEntityCustom) []models.StashDBFieldChangeCustom {
	var added, addedIDs, removed []string
	for _, r := range remote {
		if !r.Ignored && !slices.ContainsFunc(local, func(l stashDBLocalEntityCustom) bool { return l.matchesCustom(r) }) {
			added = append(added, r.Name)
			addedIDs = append(addedIDs, r.ID)
		}
	}
	for _, l := range local {
		if len(l.StashIDs) > 0 && !slices.ContainsFunc(remote, l.matchesCustom) {
			removed = append(removed, l.Name)
		}
	}
	if len(added) == 0 && len(removed) == 0 {
		return ret
	}
	return append(ret, models.StashDBFieldChangeCustom{Field: field, Added: added, AddedIDs: addedIDs, Removed: removed})
}
