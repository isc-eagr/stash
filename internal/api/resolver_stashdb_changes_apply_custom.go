package api

// CUSTOM: StashDB Changes apply writes report fields' StashDB values to the
// local scene or performer through the regular update paths.

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"

	"github.com/stashapp/stash/pkg/match"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/performer"
	"github.com/stashapp/stash/pkg/plugin/hook"
	"github.com/stashapp/stash/pkg/sliceutil"
	"github.com/stashapp/stash/pkg/sliceutil/intslice"
	"github.com/stashapp/stash/pkg/sliceutil/stringslice"
	"github.com/stashapp/stash/pkg/sqlite"
)

var errStashDBChangeNotFoundCustom = errors.New("not in the StashDB Changes report; check again")

func (r *mutationResolver) ApplyStashDBSceneChanges(ctx context.Context, input StashDBChangesApplyInput) (*StashDBSceneChange, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("converting id: %w", err)
	}

	store := sqlite.StashDBChangesStoreCustom{}
	var change *models.StashDBChangeCustom
	var update models.SceneUpdateInput
	var translator changesetTranslator
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var endpoint string
		var err error
		change, endpoint, err = store.GetChange(ctx, models.StashDBChangesKindSceneCustom, id, input.StashID)
		if err != nil {
			return err
		}
		if change == nil {
			return errStashDBChangeNotFoundCustom
		}

		qb := r.repository.Scene
		scene, err := qb.Find(ctx, id)
		if err != nil {
			return err
		}
		if scene == nil {
			return fmt.Errorf("scene with id %d not found", id)
		}
		if err := scene.LoadURLs(ctx, qb); err != nil {
			return err
		}
		if err := scene.LoadPerformerIDs(ctx, qb); err != nil {
			return err
		}
		if err := scene.LoadTagIDs(ctx, qb); err != nil {
			return err
		}

		var inputMap map[string]interface{}
		update, inputMap, change.Fields, err = stashDBSceneUpdateCustom(ctx, scene, change.Fields, input.Fields, r.stashDBResolverCustom(endpoint))
		if err != nil {
			return err
		}
		translator = changesetTranslator{inputMap: inputMap}
		if len(inputMap) > 0 {
			if _, err := r.sceneUpdate(ctx, update, translator); err != nil {
				return err
			}
		}
		return store.UpdateChangeFields(ctx, models.StashDBChangesKindSceneCustom, *change)
	}); err != nil {
		return nil, err
	}

	if len(translator.inputMap) > 0 {
		r.hookExecutor.ExecutePostHooks(ctx, id, hook.SceneUpdatePost, update, translator.getFields())
	}
	scene, err := r.getScene(ctx, id)
	if err != nil {
		return nil, err
	}
	return &StashDBSceneChange{
		Scene:        scene,
		StashID:      change.StashID,
		Status:       StashDBChangeStatus(change.Status),
		MergedIntoID: change.MergedIntoID,
		Fields:       stashDBFieldChangesCustom(change.Fields),
	}, nil
}

func (r *mutationResolver) ApplyStashDBPerformerChanges(ctx context.Context, input StashDBChangesApplyInput) (*StashDBPerformerChange, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("converting id: %w", err)
	}

	store := sqlite.StashDBChangesStoreCustom{}
	var change *models.StashDBChangeCustom
	var update models.PerformerUpdateInput
	var translator changesetTranslator
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		change, _, err = store.GetChange(ctx, models.StashDBChangesKindPerformerCustom, id, input.StashID)
		if err != nil {
			return err
		}
		if change == nil {
			return errStashDBChangeNotFoundCustom
		}

		qb := r.repository.Performer
		p, err := qb.Find(ctx, id)
		if err != nil {
			return err
		}
		if p == nil {
			return fmt.Errorf("performer with id %d not found", id)
		}
		if err := p.LoadAliases(ctx, qb); err != nil {
			return err
		}
		if err := p.LoadURLs(ctx, qb); err != nil {
			return err
		}

		var inputMap map[string]interface{}
		update, inputMap, change.Fields, err = stashDBPerformerUpdateCustom(p, change.Fields, input.Fields)
		if err != nil {
			return err
		}
		translator = changesetTranslator{inputMap: inputMap}
		if len(inputMap) > 0 {
			partial, err := performerPartialFromInput(update, translator)
			if err != nil {
				return err
			}
			// As performerUpdate does, aliases never repeat the name.
			if partial.Aliases != nil {
				name := p.Name
				if partial.Name.Set {
					name = partial.Name.Value
				}
				partial.Aliases.Values = stringslice.UniqueExcludeFold(partial.Aliases.Values, name)
			}
			if err := performer.ValidateUpdate(ctx, id, *partial, qb); err != nil {
				return err
			}
			if _, err := qb.UpdatePartial(ctx, id, *partial); err != nil {
				return err
			}
		}
		return store.UpdateChangeFields(ctx, models.StashDBChangesKindPerformerCustom, *change)
	}); err != nil {
		return nil, err
	}

	if len(translator.inputMap) > 0 {
		r.hookExecutor.ExecutePostHooks(ctx, id, hook.PerformerUpdatePost, update, translator.getFields())
	}
	p, err := r.getPerformer(ctx, id)
	if err != nil {
		return nil, err
	}
	return &StashDBPerformerChange{
		Performer:    p,
		StashID:      change.StashID,
		Status:       StashDBChangeStatus(change.Status),
		MergedIntoID: change.MergedIntoID,
		Fields:       stashDBFieldChangesCustom(change.Fields),
	}, nil
}

// stashDBResolveCustom returns the local studio, performer, or tag ("studio",
// "performers", "tags") for a StashDB one; ok is false when there is none.
type stashDBResolveCustom func(ctx context.Context, field string, stashID *string, name string) (id int, ok bool, err error)

// stashDBResolverCustom matches by StashDB ID on endpoint, then name, then
// alias, as scraping does. An ambiguous performer name has no match.
func (r *mutationResolver) stashDBResolverCustom(endpoint string) stashDBResolveCustom {
	return func(ctx context.Context, field string, stashID *string, name string) (int, bool, error) {
		var storedID *string
		var err error
		switch field {
		case "studio":
			s := &models.ScrapedStudio{Name: name, RemoteSiteID: stashID}
			err = match.ScrapedStudio(ctx, r.repository.Studio, s, endpoint)
			storedID = s.StoredID
		case "performers":
			p := &models.ScrapedPerformer{Name: &name, RemoteSiteID: stashID}
			err = match.ScrapedPerformer(ctx, r.repository.Performer, p, endpoint)
			storedID = p.StoredID
		case "tags":
			t := &models.ScrapedTag{Name: name, RemoteSiteID: stashID}
			err = match.ScrapedTag(ctx, r.repository.Tag, t, endpoint)
			storedID = t.StoredID
		default:
			return 0, false, fmt.Errorf("unknown StashDB entity field %q", field)
		}
		if err != nil || storedID == nil {
			return 0, false, err
		}
		id, err := strconv.Atoi(*storedID)
		return id, err == nil, err
	}
}

// stashDBResolveAddedCustom resolves a list field's added entities. The
// unresolved ones stay in the returned field, which is nil once nothing is
// left to show.
func stashDBResolveAddedCustom(ctx context.Context, f models.StashDBFieldChangeCustom, resolve stashDBResolveCustom) ([]int, *models.StashDBFieldChangeCustom, error) {
	var ids []int
	left := models.StashDBFieldChangeCustom{Field: f.Field, Removed: f.Removed}
	withIDs := len(f.AddedIDs) == len(f.Added)
	for i, name := range f.Added {
		var stashID *string
		if withIDs {
			stashID = &f.AddedIDs[i]
		}
		id, ok, err := resolve(ctx, f.Field, stashID, name)
		if err != nil {
			return nil, nil, err
		}
		if ok {
			ids = append(ids, id)
			continue
		}
		left.Added = append(left.Added, name)
		if withIDs {
			left.AddedIDs = append(left.AddedIDs, f.AddedIDs[i])
		}
	}
	if len(left.Added) == 0 && len(left.Removed) == 0 {
		return ids, nil, nil
	}
	return ids, &left, nil
}

// stashDBUpdateCustom is the input map of an update, listing the fields set
// as a GraphQL request would.
type stashDBUpdateCustom map[string]interface{}

func (u stashDBUpdateCustom) str(key string, dst **string, value string) {
	*dst = &value
	u[key] = value
}

// stashDBSceneUpdateCustom builds the scene update for the requested fields
// and returns the entry's fields left after it. The scene needs its URLs,
// performer IDs, and tag IDs loaded.
func stashDBSceneUpdateCustom(ctx context.Context, scene *models.Scene, fields []models.StashDBFieldChangeCustom, requested []string, resolve stashDBResolveCustom) (models.SceneUpdateInput, map[string]interface{}, []models.StashDBFieldChangeCustom, error) {
	input := models.SceneUpdateInput{ID: strconv.Itoa(scene.ID)}
	u := stashDBUpdateCustom{}
	var left []models.StashDBFieldChangeCustom
	for _, f := range fields {
		switch {
		case !slices.Contains(requested, f.Field):
			left = append(left, f)
		case f.Field == "urls":
			input.Urls = slices.Concat(scene.URLs.List(), f.Added)
			u["urls"] = input.Urls
		case f.Field == "performers" || f.Field == "tags":
			ids, rest, err := stashDBResolveAddedCustom(ctx, f, resolve)
			if err != nil {
				return input, nil, nil, err
			}
			if rest != nil {
				left = append(left, *rest)
			}
			if len(ids) == 0 {
				continue
			}
			current, key, dst := scene.TagIDs.List(), "tag_ids", &input.TagIds
			if f.Field == "performers" {
				current, key, dst = scene.PerformerIDs.List(), "performer_ids", &input.PerformerIds
			}
			*dst = intslice.IntSliceToStringSlice(sliceutil.AppendUniques(slices.Clone(current), ids))
			u[key] = *dst
		case f.Remote == nil:
			left = append(left, f)
		case f.Field == "studio":
			id, ok, err := resolve(ctx, "studio", f.RemoteID, *f.Remote)
			if err != nil {
				return input, nil, nil, err
			}
			if !ok {
				left = append(left, f)
				continue
			}
			u.str("studio_id", &input.StudioID, strconv.Itoa(id))
		case f.Field == "title":
			u.str("title", &input.Title, *f.Remote)
		case f.Field == "code":
			u.str("code", &input.Code, *f.Remote)
		case f.Field == "date":
			u.str("date", &input.Date, *f.Remote)
		case f.Field == "details":
			u.str("details", &input.Details, *f.Remote)
		case f.Field == "director":
			u.str("director", &input.Director, *f.Remote)
		default:
			return input, nil, nil, fmt.Errorf("cannot apply scene field %q", f.Field)
		}
	}
	return input, u, left, nil
}

// Performer fields applied as plain strings; each report field is also its
// update input key.
var stashDBPerformerStringFieldsCustom = map[string]func(*models.PerformerUpdateInput) **string{
	"name":           func(i *models.PerformerUpdateInput) **string { return &i.Name },
	"disambiguation": func(i *models.PerformerUpdateInput) **string { return &i.Disambiguation },
	"birthdate":      func(i *models.PerformerUpdateInput) **string { return &i.Birthdate },
	"death_date":     func(i *models.PerformerUpdateInput) **string { return &i.DeathDate },
	"ethnicity":      func(i *models.PerformerUpdateInput) **string { return &i.Ethnicity },
	"country":        func(i *models.PerformerUpdateInput) **string { return &i.Country },
	"eye_color":      func(i *models.PerformerUpdateInput) **string { return &i.EyeColor },
	"hair_color":     func(i *models.PerformerUpdateInput) **string { return &i.HairColor },
	"measurements":   func(i *models.PerformerUpdateInput) **string { return &i.Measurements },
	"fake_tits":      func(i *models.PerformerUpdateInput) **string { return &i.FakeTits },
	"career_start":   func(i *models.PerformerUpdateInput) **string { return &i.CareerStart },
	"career_end":     func(i *models.PerformerUpdateInput) **string { return &i.CareerEnd },
	"tattoos":        func(i *models.PerformerUpdateInput) **string { return &i.Tattoos },
	"piercings":      func(i *models.PerformerUpdateInput) **string { return &i.Piercings },
}

// stashDBPerformerUpdateCustom builds the performer update for the requested
// fields and returns the entry's fields left after it. The performer needs its
// aliases and URLs loaded.
func stashDBPerformerUpdateCustom(p *models.Performer, fields []models.StashDBFieldChangeCustom, requested []string) (models.PerformerUpdateInput, map[string]interface{}, []models.StashDBFieldChangeCustom, error) {
	input := models.PerformerUpdateInput{ID: strconv.Itoa(p.ID)}
	u := stashDBUpdateCustom{}
	var left []models.StashDBFieldChangeCustom
	for _, f := range fields {
		dst, isStr := stashDBPerformerStringFieldsCustom[f.Field]
		switch {
		case !slices.Contains(requested, f.Field):
			left = append(left, f)
		case f.Field == "urls":
			input.Urls = slices.Concat(p.URLs.List(), f.Added)
			u["urls"] = input.Urls
		case f.Field == "aliases":
			input.AliasList = slices.Concat(p.Aliases.List(), f.Added)
			u["alias_list"] = input.AliasList
		case f.Remote == nil:
			left = append(left, f)
		case isStr:
			u.str(f.Field, dst(&input), *f.Remote)
		case f.Field == "gender":
			g := models.GenderEnum(*f.Remote)
			if !g.IsValid() {
				return input, nil, nil, fmt.Errorf("invalid StashDB gender %q", *f.Remote)
			}
			input.Gender = &g
			u["gender"] = *f.Remote
		case f.Field == "height":
			h, err := strconv.Atoi(*f.Remote)
			if err != nil {
				return input, nil, nil, fmt.Errorf("invalid StashDB height %q", *f.Remote)
			}
			input.HeightCm = &h
			u["height_cm"] = h
		default:
			return input, nil, nil, fmt.Errorf("cannot apply performer field %q", f.Field)
		}
	}
	return input, u, left, nil
}
