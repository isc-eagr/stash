package stashbox

// CUSTOM: StashDB Changes reads the current StashDB data of linked scenes and
// performers so the report can compare it with the local copy.

import (
	"context"
	"fmt"
	"reflect"
	"slices"
	"strings"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scraper"
	"github.com/stashapp/stash/pkg/stashbox/graphql"
)

// StashDBEntityCustom is a studio, performer, or tag referenced by a scene.
type StashDBEntityCustom struct {
	ID   string
	Name string
	// Tags matching the scraper's excluded tag patterns are never suggested.
	Ignored bool
}

// StashDBSceneCustom is the scene metadata the report compares; images and
// fingerprints are left out. ID differs from the requested one when StashDB
// redirects a merged scene.
type StashDBSceneCustom struct {
	ID         string
	Deleted    bool
	Title      *string
	Code       *string
	Details    *string
	Director   *string
	Date       *string
	URLs       []string
	Studio     *StashDBEntityCustom
	Performers []StashDBEntityCustom
	Tags       []StashDBEntityCustom
}

type stashDBChangesEntityResponseCustom struct {
	ID   string `graphql:"id"`
	Name string `graphql:"name"`
}

func (e stashDBChangesEntityResponseCustom) entity() StashDBEntityCustom {
	return StashDBEntityCustom{ID: e.ID, Name: e.Name}
}

type stashDBChangesSceneResponseCustom struct {
	ID         string                                `graphql:"id"`
	Deleted    bool                                  `graphql:"deleted"`
	Title      *string                               `graphql:"title"`
	Code       *string                               `graphql:"code"`
	Details    *string                               `graphql:"details"`
	Director   *string                               `graphql:"director"`
	Date       *string                               `graphql:"date"`
	Urls       []*graphql.URLFragment                `graphql:"urls"`
	Studio     *stashDBChangesEntityResponseCustom   `graphql:"studio"`
	Tags       []*stashDBChangesEntityResponseCustom `graphql:"tags"`
	Performers []*struct {
		Performer *stashDBChangesEntityResponseCustom `graphql:"performer"`
	} `graphql:"performers"`
}

const stashDBChangesSceneSelectionCustom = `id deleted title code details director date urls { url type } studio { id name } tags { id name } performers { performer { id name } }`

// Matches PerformerFragment without images, which the report does not compare.
const stashDBChangesPerformerSelectionCustom = `id name disambiguation aliases gender merged_ids deleted merged_into_id urls { url type } birth_date death_date ethnicity country eye_color hair_color height measurements { band_size cup_size waist hip } breast_type career_start_year career_end_year tattoos { location description } piercings { location description }`

// FindStashDBScenesCustom looks up several scenes in one request. The result
// is keyed by stash ID; scenes StashDB does not have are omitted.
func (c Client) FindStashDBScenesCustom(ctx context.Context, stashIDs []string) (map[string]*StashDBSceneCustom, error) {
	found, err := c.findAliasedCustom(ctx, "StashDBChangesScenes", "findScene", stashDBChangesSceneSelectionCustom, stashIDs, (*stashDBChangesSceneResponseCustom)(nil))
	if err != nil {
		return nil, err
	}

	ret := make(map[string]*StashDBSceneCustom, len(found))
	for id, v := range found {
		s := v.(*stashDBChangesSceneResponseCustom)
		scene := &StashDBSceneCustom{
			ID:       s.ID,
			Deleted:  s.Deleted,
			Title:    s.Title,
			Code:     s.Code,
			Details:  s.Details,
			Director: s.Director,
			Date:     s.Date,
		}
		if s.Studio != nil {
			studio := s.Studio.entity()
			scene.Studio = &studio
		}
		for _, u := range s.Urls {
			if u != nil {
				scene.URLs = append(scene.URLs, u.URL)
			}
		}
		for _, p := range s.Performers {
			if p != nil && p.Performer != nil {
				scene.Performers = append(scene.Performers, p.Performer.entity())
			}
		}
		var tags []*models.ScrapedTag
		for _, t := range s.Tags {
			if t != nil {
				tags = append(tags, &models.ScrapedTag{Name: t.Name, RemoteSiteID: &t.ID})
			}
		}
		kept, _ := scraper.FilterTags(c.excludeTagRE, tags)
		for _, t := range tags {
			tag := StashDBEntityCustom{ID: *t.RemoteSiteID, Name: t.Name, Ignored: !slices.Contains(kept, t)}
			scene.Tags = append(scene.Tags, tag)
		}
		ret[id] = scene
	}
	return ret, nil
}

// FindStashDBPerformersCustom looks up several performers in one request,
// converted the same way a performer scrape converts them. Deleted and merged
// performers are included with RemoteDeleted/RemoteMergedIntoId set.
func (c Client) FindStashDBPerformersCustom(ctx context.Context, stashIDs []string) (map[string]*models.ScrapedPerformer, error) {
	found, err := c.findAliasedCustom(ctx, "StashDBChangesPerformers", "findPerformer", stashDBChangesPerformerSelectionCustom, stashIDs, (*graphql.PerformerFragment)(nil))
	if err != nil {
		return nil, err
	}

	ret := make(map[string]*models.ScrapedPerformer, len(found))
	for id, v := range found {
		ret[id] = performerFragmentToScrapedPerformer(*v.(*graphql.PerformerFragment))
	}
	return ret, nil
}

// findAliasedCustom runs one aliased lookup per ID in a single request and
// returns the non-null results keyed by ID, as pointers of resultType.
func (c Client) findAliasedCustom(ctx context.Context, operation, field, selection string, ids []string, resultType any) (map[string]any, error) {
	ret := make(map[string]any, len(ids))
	if len(ids) == 0 {
		return ret, nil
	}

	params := make([]string, len(ids))
	selections := make([]string, len(ids))
	vars := make(map[string]any, len(ids))
	// The GraphQL decoder fills structs only, so aliases sN map to fields SN.
	fields := make([]reflect.StructField, len(ids))
	for i, id := range ids {
		alias := fmt.Sprintf("s%d", i)
		params[i] = fmt.Sprintf("$%s: ID!", alias)
		selections[i] = fmt.Sprintf("%s: %s(id: $%s) { %s }", alias, field, alias, selection)
		vars[alias] = id
		fields[i] = reflect.StructField{Name: fmt.Sprintf("S%d", i), Type: reflect.TypeOf(resultType)}
	}
	query := fmt.Sprintf("query %s(%s) { %s }", operation, strings.Join(params, ", "), strings.Join(selections, " "))

	res := reflect.New(reflect.StructOf(fields))
	if err := c.client.Client.Post(ctx, operation, query, res.Interface(), vars); err != nil {
		return nil, err
	}

	for i, id := range ids {
		v := res.Elem().Field(i)
		if !v.IsNil() {
			ret[id] = v.Interface()
		}
	}
	return ret, nil
}
