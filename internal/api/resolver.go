package api

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/stashapp/stash/internal/build"
	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/plugin/hook"
	"github.com/stashapp/stash/pkg/scene"
	"github.com/stashapp/stash/pkg/scraper"
)

var (
	// ErrNotImplemented is an error which means the given functionality isn't implemented by the API.
	ErrNotImplemented = errors.New("not implemented")

	// ErrNotSupported is returned whenever there's a test, which can be used to guard against the error,
	// but the given parameters aren't supported by the system.
	ErrNotSupported = errors.New("not supported")

	// ErrInput signifies errors where the input isn't valid for some reason. And no more specific error exists.
	ErrInput = errors.New("input error")
)

type hookExecutor interface {
	ExecutePostHooks(ctx context.Context, id int, hookType hook.TriggerEnum, input interface{}, inputFields []string)
}

type Resolver struct {
	repository     models.Repository
	sceneService   manager.SceneService
	imageService   manager.ImageService
	galleryService manager.GalleryService
	groupService   manager.GroupService

	hookExecutor hookExecutor
}

func (r *Resolver) scraperCache() *scraper.Cache {
	return manager.GetInstance().ScraperCache
}

func (r *Resolver) Gallery() GalleryResolver {
	return &galleryResolver{r}
}
func (r *Resolver) GalleryChapter() GalleryChapterResolver {
	return &galleryChapterResolver{r}
}
func (r *Resolver) Mutation() MutationResolver {
	return &mutationResolver{r}
}
func (r *Resolver) Performer() PerformerResolver {
	return &performerResolver{r}
}
func (r *Resolver) Query() QueryResolver {
	return &queryResolver{r}
}
func (r *Resolver) Scene() SceneResolver {
	return &sceneResolver{r}
}
func (r *Resolver) Image() ImageResolver {
	return &imageResolver{r}
}
func (r *Resolver) SceneMarker() SceneMarkerResolver {
	return &sceneMarkerResolver{r}
}
func (r *Resolver) Studio() StudioResolver {
	return &studioResolver{r}
}

func (r *Resolver) Group() GroupResolver {
	return &groupResolver{r}
}
func (r *Resolver) Movie() MovieResolver {
	return &movieResolver{&groupResolver{r}}
}

func (r *Resolver) Subscription() SubscriptionResolver {
	return &subscriptionResolver{r}
}
func (r *Resolver) Tag() TagResolver {
	return &tagResolver{r}
}
func (r *Resolver) GalleryFile() GalleryFileResolver {
	return &galleryFileResolver{r}
}
func (r *Resolver) VideoFile() VideoFileResolver {
	return &videoFileResolver{r}
}
func (r *Resolver) ImageFile() ImageFileResolver {
	return &imageFileResolver{r}
}
func (r *Resolver) BasicFile() BasicFileResolver {
	return &basicFileResolver{r}
}
func (r *Resolver) Folder() FolderResolver {
	return &folderResolver{r}
}
func (r *Resolver) SavedFilter() SavedFilterResolver {
	return &savedFilterResolver{r}
}
func (r *Resolver) Plugin() PluginResolver {
	return &pluginResolver{r}
}
func (r *Resolver) ConfigResult() ConfigResultResolver {
	return &configResultResolver{r}
}

// NOTE: TagFilterType resolver stub removed temporarily to allow gqlgen
// to run and generate the TagFilterTypeResolver interface. The stub will be
// re-added after code generation so we can return a no-op resolver for the
// input type fields (TagFilterType is used as an input type and doesn't
// require runtime resolution).

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }

type galleryResolver struct{ *Resolver }
type galleryChapterResolver struct{ *Resolver }
type performerResolver struct{ *Resolver }
type sceneResolver struct{ *Resolver }
type sceneMarkerResolver struct{ *Resolver }
type imageResolver struct{ *Resolver }
type studioResolver struct{ *Resolver }

// movie is group under the hood
type groupResolver struct{ *Resolver }
type movieResolver struct{ *groupResolver }

type tagResolver struct{ *Resolver }
type galleryFileResolver struct{ *Resolver }
type videoFileResolver struct{ *Resolver }
type imageFileResolver struct{ *Resolver }
type basicFileResolver struct{ *Resolver }
type folderResolver struct{ *Resolver }
type savedFilterResolver struct{ *Resolver }
type pluginResolver struct{ *Resolver }
type configResultResolver struct{ *Resolver }

func (r *Resolver) withTxn(ctx context.Context, fn func(ctx context.Context) error) error {
	return r.repository.WithTxn(ctx, fn)
}

func (r *Resolver) withReadTxn(ctx context.Context, fn func(ctx context.Context) error) error {
	return r.repository.WithReadTxn(ctx, fn)
}

func (r *queryResolver) MarkerWall(ctx context.Context, q *string) (ret []*models.SceneMarker, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneMarker.Wall(ctx, q)
		return err
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *queryResolver) SceneWall(ctx context.Context, q *string) (ret []*models.Scene, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.Scene.Wall(ctx, q)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *queryResolver) MarkerStrings(ctx context.Context, q *string, sort *string) (ret []*models.MarkerStringsResultType, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		ret, err = r.repository.SceneMarker.GetMarkerStrings(ctx, q, sort)
		return err
	}); err != nil {
		return nil, err
	}

	return ret, nil
}

func (r *queryResolver) PerformerEthnicities(ctx context.Context) (ret []string, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		// Query distinct, non-empty, non-null performer ethnicities
		cols, rows, err := db.QuerySQL(ctx, "SELECT DISTINCT ethnicity FROM performers WHERE ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' ORDER BY ethnicity", nil)
		if err != nil {
			return err
		}
		_ = cols // not used
		out := make([]string, 0, len(rows))
		for _, row := range rows {
			if len(row) == 0 {
				continue
			}
			switch v := row[0].(type) {
			case string:
				out = append(out, v)
			case []byte:
				out = append(out, string(v))
			default:
				out = append(out, fmt.Sprint(v))
			}
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// PerformerEthnicityCounts returns counts of performers grouped by non-empty ethnicity,
// sorted by count descending.
func (r *queryResolver) PerformerEthnicityCounts(ctx context.Context) (ret []*PerformerEthnicityCount, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT ethnicity, COUNT(*) as cnt FROM performers WHERE ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' GROUP BY ethnicity ORDER BY cnt DESC"
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		out := make([]*PerformerEthnicityCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			var eth string
			switch v := row[0].(type) {
			case string:
				eth = v
			case []byte:
				eth = string(v)
			default:
				eth = fmt.Sprint(v)
			}
			var cnt int
			switch v := row[1].(type) {
			case int64:
				cnt = int(v)
			case int:
				cnt = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				cnt = i
			case string:
				i, _ := strconv.Atoi(v)
				cnt = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				cnt = i
			}
			out = append(out, &PerformerEthnicityCount{Ethnicity: eth, Count: cnt})
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// PerformerEthnicityFiveStarCounts returns counts of performers with a 5-star rating (rating100→5)
// grouped by non-empty ethnicity, sorted by count descending. Threshold is rating >= 90, consistent
// with Rating100To5 mapping (round(r/20) >= 4.5 → 5).
func (r *queryResolver) PerformerEthnicityFiveStarCounts(ctx context.Context) (ret []*PerformerEthnicityCount, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT ethnicity, COUNT(*) as cnt FROM performers WHERE rating IS NOT NULL AND rating >= 90 AND ethnicity IS NOT NULL AND TRIM(ethnicity) <> '' GROUP BY ethnicity ORDER BY cnt DESC"
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		out := make([]*PerformerEthnicityCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			var eth string
			switch v := row[0].(type) {
			case string:
				eth = v
			case []byte:
				eth = string(v)
			default:
				eth = fmt.Sprint(v)
			}
			var cnt int
			switch v := row[1].(type) {
			case int64:
				cnt = int(v)
			case int:
				cnt = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				cnt = i
			case string:
				i, _ := strconv.Atoi(v)
				cnt = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				cnt = i
			}
			out = append(out, &PerformerEthnicityCount{Ethnicity: eth, Count: cnt})
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// SceneOYearCounts returns counts of scene orgasm events grouped by year ascending.
func (r *queryResolver) SceneOYearCounts(ctx context.Context) (ret []*SceneOYearCount, err error) {
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT CAST(strftime('%Y', o_date) AS INT) AS year, COUNT(*) AS cnt FROM scenes_o_dates GROUP BY year ORDER BY year ASC"
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		out := make([]*SceneOYearCount, 0, len(rows))
		for _, row := range rows {
			if len(row) < 2 {
				continue
			}
			var yearInt int
			switch v := row[0].(type) {
			case int64:
				yearInt = int(v)
			case int:
				yearInt = v
			case []byte:
				y, _ := strconv.Atoi(string(v))
				yearInt = y
			case string:
				y, _ := strconv.Atoi(v)
				yearInt = y
			default:
				y, _ := strconv.Atoi(fmt.Sprint(v))
				yearInt = y
			}
			var cnt int
			switch v := row[1].(type) {
			case int64:
				cnt = int(v)
			case int:
				cnt = v
			case []byte:
				c, _ := strconv.Atoi(string(v))
				cnt = c
			case string:
				c, _ := strconv.Atoi(v)
				cnt = c
			default:
				c, _ := strconv.Atoi(fmt.Sprint(v))
				cnt = c
			}
			out = append(out, &SceneOYearCount{Year: yearInt, Count: cnt})
		}
		ret = out
		return nil
	}); err != nil {
		return nil, err
	}
	return ret, nil
}

// SceneOrgasmCount returns the total number of orgasms in scenes using marker logic:
// - Count markers where the primary tag name is 'orgasm' (case-insensitive)
// - If that marker also has a secondary tag 'simultaneous', it counts as 2
func (r *queryResolver) SceneOrgasmCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := "SELECT SUM(1 + CASE WHEN EXISTS (SELECT 1 FROM scene_markers_tags smt2 JOIN tags t2 ON smt2.tag_id = t2.id WHERE smt2.scene_marker_id = sm.id AND LOWER(TRIM(t2.name)) = 'simultaneous') THEN 1 ELSE 0 END) AS total_orgasms FROM scene_markers sm JOIN tags t ON sm.primary_tag_id = t.id WHERE LOWER(TRIM(t.name)) = 'orgasm'"
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// SceneFacialCount returns the total number of facial markers.
// A marker counts if:
// - its primary tag is 'facial' or any descendant of 'facial', or
// - it has any secondary tag that is 'facial' or any descendant of 'facial'.
// Each marker is counted once even if multiple matching tags are present.
func (r *queryResolver) SceneFacialCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := `
WITH RECURSIVE facial_tags(id) AS (
  SELECT id FROM tags WHERE LOWER(TRIM(name)) = 'facial'
  UNION ALL
  SELECT tr.child_id FROM tags_relations tr JOIN facial_tags ft ON tr.parent_id = ft.id
)
SELECT COUNT(DISTINCT sm.id) AS cnt
FROM scene_markers sm
LEFT JOIN scene_markers_tags smt ON smt.scene_marker_id = sm.id
WHERE sm.primary_tag_id IN (SELECT id FROM facial_tags)
   OR smt.tag_id IN (SELECT id FROM facial_tags)`
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersFacialGivenCount returns the number of distinct performers who have given facials.
// Uses the configurable 'facialgiven' tag alias from UI config.
func (r *queryResolver) PerformersFacialGivenCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		facialGivenTagName := "facialgiven"
		if sceneTagAliases != nil {
			if fg, ok := sceneTagAliases["facialgiven"].(string); ok && fg != "" {
				facialGivenTagName = fg
			}
		}

		db := manager.GetInstance().Database
		query := "SELECT COUNT(DISTINCT pst.performer_id) FROM performer_scene_tags pst JOIN tags t ON pst.tag_id = t.id WHERE LOWER(TRIM(t.name)) = ?"
		args := []interface{}{strings.ToLower(facialGivenTagName)}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersFacialReceivedCount returns the number of distinct performers who have received facials.
// Uses the configurable 'facialreceived' tag alias from UI config.
func (r *queryResolver) PerformersFacialReceivedCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		facialReceivedTagName := "facialreceived"
		if sceneTagAliases != nil {
			if fr, ok := sceneTagAliases["facialreceived"].(string); ok && fr != "" {
				facialReceivedTagName = fr
			}
		}

		db := manager.GetInstance().Database
		query := "SELECT COUNT(DISTINCT pst.performer_id) FROM performer_scene_tags pst JOIN tags t ON pst.tag_id = t.id WHERE LOWER(TRIM(t.name)) = ?"
		args := []interface{}{strings.ToLower(facialReceivedTagName)}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersStrictTopCount returns the number of performers who have top/oraltop tags but no bottom/oralbottom tags.
func (r *queryResolver) PerformersStrictTopCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		topTagName := "top"
		bottomTagName := "bottom"
		oralTopTagName := "oraltop"
		oralBottomTagName := "oralbottom"
		if sceneTagAliases != nil {
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
				oralTopTagName = ot
			}
			if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
				oralBottomTagName = ob
			}
		}

		db := manager.GetInstance().Database
		query := `
SELECT COUNT(DISTINCT pst.performer_id)
FROM performer_scene_tags pst
JOIN tags t ON pst.tag_id = t.id
WHERE LOWER(TRIM(t.name)) IN (?, ?)
  AND pst.performer_id NOT IN (
    SELECT DISTINCT pst2.performer_id
    FROM performer_scene_tags pst2
    JOIN tags t2 ON pst2.tag_id = t2.id
    WHERE LOWER(TRIM(t2.name)) IN (?, ?)
  )`
		args := []interface{}{
			strings.ToLower(topTagName),
			strings.ToLower(oralTopTagName),
			strings.ToLower(bottomTagName),
			strings.ToLower(oralBottomTagName),
		}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersStrictBottomCount returns the number of performers who have bottom/oralbottom tags but no top/oraltop tags.
func (r *queryResolver) PerformersStrictBottomCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		topTagName := "top"
		bottomTagName := "bottom"
		oralTopTagName := "oraltop"
		oralBottomTagName := "oralbottom"
		if sceneTagAliases != nil {
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
				oralTopTagName = ot
			}
			if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
				oralBottomTagName = ob
			}
		}

		db := manager.GetInstance().Database
		query := `
SELECT COUNT(DISTINCT pst.performer_id)
FROM performer_scene_tags pst
JOIN tags t ON pst.tag_id = t.id
WHERE LOWER(TRIM(t.name)) IN (?, ?)
  AND pst.performer_id NOT IN (
    SELECT DISTINCT pst2.performer_id
    FROM performer_scene_tags pst2
    JOIN tags t2 ON pst2.tag_id = t2.id
    WHERE LOWER(TRIM(t2.name)) IN (?, ?)
  )`
		args := []interface{}{
			strings.ToLower(bottomTagName),
			strings.ToLower(oralBottomTagName),
			strings.ToLower(topTagName),
			strings.ToLower(oralTopTagName),
		}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersLenientTopCount returns the number of performers who have both top and oral bottom tags, but no bottom tag.
func (r *queryResolver) PerformersLenientTopCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		topTagName := "top"
		bottomTagName := "bottom"
		oralBottomTagName := "oralbottom"
		if sceneTagAliases != nil {
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
				oralBottomTagName = ob
			}
		}

		db := manager.GetInstance().Database
		query := `
SELECT COUNT(DISTINCT pst.performer_id)
FROM performer_scene_tags pst
JOIN tags t ON pst.tag_id = t.id
WHERE LOWER(TRIM(t.name)) = ?
  AND pst.performer_id IN (
    SELECT DISTINCT pst2.performer_id
    FROM performer_scene_tags pst2
    JOIN tags t2 ON pst2.tag_id = t2.id
    WHERE LOWER(TRIM(t2.name)) = ?
  )
  AND pst.performer_id NOT IN (
    SELECT DISTINCT pst3.performer_id
    FROM performer_scene_tags pst3
    JOIN tags t3 ON pst3.tag_id = t3.id
    WHERE LOWER(TRIM(t3.name)) = ?
  )`
		args := []interface{}{
			strings.ToLower(topTagName),
			strings.ToLower(oralBottomTagName),
			strings.ToLower(bottomTagName),
		}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersLenientBottomCount returns the number of performers who have both bottom and oral top tags, but no top tag.
func (r *queryResolver) PerformersLenientBottomCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		topTagName := "top"
		bottomTagName := "bottom"
		oralTopTagName := "oraltop"
		if sceneTagAliases != nil {
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
				oralTopTagName = ot
			}
		}

		db := manager.GetInstance().Database
		query := `
SELECT COUNT(DISTINCT pst.performer_id)
FROM performer_scene_tags pst
JOIN tags t ON pst.tag_id = t.id
WHERE LOWER(TRIM(t.name)) = ?
  AND pst.performer_id IN (
    SELECT DISTINCT pst2.performer_id
    FROM performer_scene_tags pst2
    JOIN tags t2 ON pst2.tag_id = t2.id
    WHERE LOWER(TRIM(t2.name)) = ?
  )
  AND pst.performer_id NOT IN (
    SELECT DISTINCT pst3.performer_id
    FROM performer_scene_tags pst3
    JOIN tags t3 ON pst3.tag_id = t3.id
    WHERE LOWER(TRIM(t3.name)) = ?
  )`
		args := []interface{}{
			strings.ToLower(bottomTagName),
			strings.ToLower(oralTopTagName),
			strings.ToLower(topTagName),
		}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// PerformersSoloOnlyCount returns the number of performers who have the solo tag but no position tags.
func (r *queryResolver) PerformersSoloOnlyCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})
		soloTagName := "solo"
		topTagName := "top"
		bottomTagName := "bottom"
		oralTopTagName := "oraltop"
		oralBottomTagName := "oralbottom"
		if sceneTagAliases != nil {
			if s, ok := sceneTagAliases["solo"].(string); ok && s != "" {
				soloTagName = s
			}
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
				oralTopTagName = ot
			}
			if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
				oralBottomTagName = ob
			}
		}

		db := manager.GetInstance().Database
		query := `
SELECT COUNT(DISTINCT pst.performer_id)
FROM performer_scene_tags pst
JOIN tags t ON pst.tag_id = t.id
WHERE LOWER(TRIM(t.name)) = ?
  AND pst.performer_id NOT IN (
    SELECT DISTINCT pst2.performer_id
    FROM performer_scene_tags pst2
    JOIN tags t2 ON pst2.tag_id = t2.id
    WHERE LOWER(TRIM(t2.name)) IN (?, ?, ?, ?)
  )`
		args := []interface{}{
			strings.ToLower(soloTagName),
			strings.ToLower(topTagName),
			strings.ToLower(bottomTagName),
			strings.ToLower(oralTopTagName),
			strings.ToLower(oralBottomTagName),
		}
		_, rows, err := db.QuerySQL(ctx, query, args)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
} // PerformersOneSceneCount returns the number of performers who appear in exactly one scene.
func (r *queryResolver) PerformersOneSceneCount(ctx context.Context) (int, error) {
	var count int
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		db := manager.GetInstance().Database
		query := `
SELECT COUNT(*)
FROM (
  SELECT performer_id
  FROM performers_scenes
  GROUP BY performer_id
  HAVING COUNT(*) = 1
)`
		_, rows, err := db.QuerySQL(ctx, query, nil)
		if err != nil {
			return err
		}
		if len(rows) > 0 && len(rows[0]) > 0 {
			switch v := rows[0][0].(type) {
			case int64:
				count = int(v)
			case int:
				count = v
			case []byte:
				i, _ := strconv.Atoi(string(v))
				count = i
			case string:
				i, _ := strconv.Atoi(v)
				count = i
			default:
				i, _ := strconv.Atoi(fmt.Sprint(v))
				count = i
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *queryResolver) Stats(ctx context.Context) (*StatsResultType, error) {
	var ret StatsResultType
	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		repo := r.repository
		sceneQB := repo.Scene
		imageQB := repo.Image
		galleryQB := repo.Gallery
		studioQB := repo.Studio
		performerQB := repo.Performer
		movieQB := repo.Group
		tagQB := repo.Tag

		// embrace the error

		scenesCount, err := sceneQB.Count(ctx)
		if err != nil {
			return err
		}

		scenesSize, err := sceneQB.Size(ctx)
		if err != nil {
			return err
		}

		scenesDuration, err := sceneQB.Duration(ctx)
		if err != nil {
			return err
		}

		imageCount, err := imageQB.Count(ctx)
		if err != nil {
			return err
		}

		imageSize, err := imageQB.Size(ctx)
		if err != nil {
			return err
		}

		galleryCount, err := galleryQB.Count(ctx)
		if err != nil {
			return err
		}

		performersCount, err := performerQB.Count(ctx)
		if err != nil {
			return err
		}

		studiosCount, err := studioQB.Count(ctx)
		if err != nil {
			return err
		}

		groupsCount, err := movieQB.Count(ctx)
		if err != nil {
			return err
		}

		tagsCount, err := tagQB.Count(ctx)
		if err != nil {
			return err
		}

		scenesTotalOCount, err := sceneQB.GetAllOCount(ctx)
		if err != nil {
			return err
		}
		imagesTotalOCount, err := imageQB.OCount(ctx)
		if err != nil {
			return err
		}
		totalOCount := scenesTotalOCount + imagesTotalOCount

		totalPlayDuration, err := sceneQB.PlayDuration(ctx)
		if err != nil {
			return err
		}

		totalPlayCount, err := sceneQB.CountAllViews(ctx)
		if err != nil {
			return err
		}

		uniqueScenePlayCount, err := sceneQB.CountUniqueViews(ctx)
		if err != nil {
			return err
		}

		// Get scene category counts using configured tag names
		uiConfig := config.GetInstance().GetUIConfiguration()
		sceneTagAliases, _ := uiConfig["sceneTagAliases"].(map[string]interface{})

		topTagName := "top"
		bottomTagName := "bottom"
		oralTopTagName := "oraltop"
		oralBottomTagName := "oralbottom"
		soloTagName := "solo"
		facialGivenTagName := "facialgiven"
		facialReceivedTagName := "facialreceived"
		selfFacialTagName := "selffacial"

		if sceneTagAliases != nil {
			if t, ok := sceneTagAliases["top"].(string); ok && t != "" {
				topTagName = t
			}
			if b, ok := sceneTagAliases["bottom"].(string); ok && b != "" {
				bottomTagName = b
			}
			if ot, ok := sceneTagAliases["oraltop"].(string); ok && ot != "" {
				oralTopTagName = ot
			}
			if ob, ok := sceneTagAliases["oralbottom"].(string); ok && ob != "" {
				oralBottomTagName = ob
			}
			if s, ok := sceneTagAliases["solo"].(string); ok && s != "" {
				soloTagName = s
			}
			if fg, ok := sceneTagAliases["facialgiven"].(string); ok && fg != "" {
				facialGivenTagName = fg
			}
			if fr, ok := sceneTagAliases["facialreceived"].(string); ok && fr != "" {
				facialReceivedTagName = fr
			}
			if sf, ok := sceneTagAliases["selffacial"].(string); ok && sf != "" {
				selfFacialTagName = sf
			}
		}

		// Count sex scenes (scenes with top/bottom tags)
		sexSceneCount, err := scene.CountByPerformerSceneTags(ctx, sceneQB, tagQB, []string{topTagName, bottomTagName}, false)
		if err != nil {
			return err
		}

		// Count oral scenes (scenes with oral tags but not top/bottom)
		oralSceneCount, err := scene.CountByPerformerSceneTagsWithExclusions(ctx, sceneQB, tagQB, []string{oralTopTagName, oralBottomTagName}, []string{topTagName, bottomTagName})
		if err != nil {
			return err
		}

		// Count solo scenes (scenes with solo tags but not top/bottom/oral)
		soloSceneCount, err := scene.CountByPerformerSceneTagsWithExclusions(ctx, sceneQB, tagQB, []string{soloTagName}, []string{topTagName, bottomTagName, oralTopTagName, oralBottomTagName})
		if err != nil {
			return err
		}

		// Count facial scenes (scenes with facialgiven or facialreceived or selffacial tags)
		facialSceneCount, err := scene.CountByPerformerSceneTags(ctx, sceneQB, tagQB, []string{facialGivenTagName, facialReceivedTagName, selfFacialTagName}, false)
		if err != nil {
			return err
		}

		ret = StatsResultType{
			SceneCount:        scenesCount,
			ScenesSize:        scenesSize,
			ScenesDuration:    scenesDuration,
			ImageCount:        imageCount,
			ImagesSize:        imageSize,
			GalleryCount:      galleryCount,
			PerformerCount:    performersCount,
			StudioCount:       studiosCount,
			GroupCount:        groupsCount,
			MovieCount:        groupsCount,
			TagCount:          tagsCount,
			TotalOCount:       totalOCount,
			TotalPlayDuration: totalPlayDuration,
			TotalPlayCount:    totalPlayCount,
			ScenesPlayed:      uniqueScenePlayCount,
			SexSceneCount:     sexSceneCount,
			OralSceneCount:    oralSceneCount,
			SoloSceneCount:    soloSceneCount,
			FacialSceneCount:  facialSceneCount,
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return &ret, nil
}

func (r *queryResolver) Version(ctx context.Context) (*Version, error) {
	version, hash, buildtime := build.Version()

	return &Version{
		Version:   &version,
		Hash:      hash,
		BuildTime: buildtime,
	}, nil
}

func (r *queryResolver) Latestversion(ctx context.Context) (*LatestVersion, error) {
	latestRelease, err := GetLatestRelease(ctx)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			logger.Errorf("Error while retrieving latest version: %v", err)
		}
		return nil, err
	}
	logger.Infof("Retrieved latest version: %s (%s)", latestRelease.Version, latestRelease.ShortHash)

	return &LatestVersion{
		Version:     latestRelease.Version,
		Shorthash:   latestRelease.ShortHash,
		ReleaseDate: latestRelease.Date,
		URL:         latestRelease.Url,
	}, nil
}

func (r *mutationResolver) ExecSQL(ctx context.Context, sql string, args []interface{}) (*SQLExecResult, error) {
	var rowsAffected *int64
	var lastInsertID *int64

	db := manager.GetInstance().Database
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		rowsAffected, lastInsertID, err = db.ExecSQL(ctx, sql, args)
		return err
	}); err != nil {
		return nil, err
	}

	return &SQLExecResult{
		RowsAffected: rowsAffected,
		LastInsertID: lastInsertID,
	}, nil
}

func (r *mutationResolver) QuerySQL(ctx context.Context, sql string, args []interface{}) (*SQLQueryResult, error) {
	var cols []string
	var rows [][]interface{}

	db := manager.GetInstance().Database
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		cols, rows, err = db.QuerySQL(ctx, sql, args)
		return err
	}); err != nil {
		return nil, err
	}

	return &SQLQueryResult{
		Columns: cols,
		Rows:    rows,
	}, nil
}

// Get scene marker tags which show up under the video.
func (r *queryResolver) SceneMarkerTags(ctx context.Context, scene_id string) ([]*SceneMarkerTag, error) {
	sceneID, err := strconv.Atoi(scene_id)
	if err != nil {
		return nil, err
	}

	var keys []int
	tags := make(map[int]*SceneMarkerTag)

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		sceneMarkers, err := r.repository.SceneMarker.FindBySceneID(ctx, sceneID)
		if err != nil {
			return err
		}

		tqb := r.repository.Tag
		for _, sceneMarker := range sceneMarkers {
			markerPrimaryTag, err := tqb.Find(ctx, sceneMarker.PrimaryTagID)
			if err != nil {
				return err
			}

			if markerPrimaryTag == nil {
				return fmt.Errorf("tag with id %d not found", sceneMarker.PrimaryTagID)
			}

			_, hasKey := tags[markerPrimaryTag.ID]
			if !hasKey {
				sceneMarkerTag := &SceneMarkerTag{Tag: markerPrimaryTag}
				tags[markerPrimaryTag.ID] = sceneMarkerTag
				keys = append(keys, markerPrimaryTag.ID)
			}
			tags[markerPrimaryTag.ID].SceneMarkers = append(tags[markerPrimaryTag.ID].SceneMarkers, sceneMarker)
		}

		return nil
	}); err != nil {
		return nil, err
	}

	// Sort so that primary tags that show up earlier in the video are first.
	sort.Slice(keys, func(i, j int) bool {
		a := tags[keys[i]]
		b := tags[keys[j]]
		return a.SceneMarkers[0].Seconds < b.SceneMarkers[0].Seconds
	})

	var result []*SceneMarkerTag
	for _, key := range keys {
		result = append(result, tags[key])
	}

	return result, nil
}

// PerformerTagSceneCounts returns the number of scenes for each provided tag_id
// where the scene is associated with the given performer. Returned slice is in
// the same order as the provided tag_ids.
func (r *queryResolver) PerformerTagSceneCounts(ctx context.Context, performer_id string, tag_ids []string) ([]*PerformerTagSceneCount, error) {
	// parse performer id
	pid, err := strconv.Atoi(performer_id)
	if err != nil {
		return nil, err
	}

	if len(tag_ids) == 0 {
		return []*PerformerTagSceneCount{}, nil
	}

	// parse tag ids and build args
	args := make([]interface{}, 0, 1+len(tag_ids))
	args = append(args, pid)
	placeholders := make([]string, len(tag_ids))
	parsedIDs := make([]int, len(tag_ids))
	for i, tid := range tag_ids {
		id, err := strconv.Atoi(tid)
		if err != nil {
			return nil, err
		}
		parsedIDs[i] = id
		args = append(args, id)
		placeholders[i] = "?"
	}

	query := "SELECT tag_id, COUNT(DISTINCT scene_id) FROM performer_scene_tags WHERE performer_id = ? AND tag_id IN (" + strings.Join(placeholders, ",") + ") GROUP BY tag_id"

	db := manager.GetInstance().Database

	var rows [][]interface{}

	if err := r.withReadTxn(ctx, func(ctx context.Context) error {
		var err error
		_, rows, err = db.QuerySQL(ctx, query, args)
		return err
	}); err != nil {
		return nil, err
	}

	counts := make(map[int]int)
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}

		// tag_id may be returned as int64 or string/[]byte depending on driver
		var tagInt int
		switch v := row[0].(type) {
		case int64:
			tagInt = int(v)
		case int:
			tagInt = v
		case []byte:
			tagInt, _ = strconv.Atoi(string(v))
		case string:
			tagInt, _ = strconv.Atoi(v)
		default:
			tagInt, _ = strconv.Atoi(fmt.Sprint(v))
		}

		var cnt int
		switch v := row[1].(type) {
		case int64:
			cnt = int(v)
		case int:
			cnt = v
		case []byte:
			cnt, _ = strconv.Atoi(string(v))
		case string:
			cnt, _ = strconv.Atoi(v)
		default:
			cnt, _ = strconv.Atoi(fmt.Sprint(v))
		}

		counts[tagInt] = cnt
	}

	var result []*PerformerTagSceneCount
	for _, id := range parsedIDs {
		c := counts[id]
		result = append(result, &PerformerTagSceneCount{
			TagID: strconv.Itoa(id),
			Count: c,
		})
	}

	return result, nil
}

func firstError(errs []error) error {
	for _, e := range errs {
		if e != nil {
			return e
		}
	}

	return nil
}
