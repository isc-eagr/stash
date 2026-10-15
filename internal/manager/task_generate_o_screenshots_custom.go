package manager

// CUSTOM: Generate screenshots for timestamped scene and release O events.

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"

	"github.com/stashapp/stash/pkg/fsutil"
	"github.com/stashapp/stash/pkg/job"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene/generate"
	"github.com/stashapp/stash/pkg/sqlite"
)

type sceneOEventScreenshot struct {
	ID             int
	SceneID        int
	ReleaseID      int // set for a release O; ID is then its release O rowid
	VideoTimestamp float64
}

type GenerateOScreenshotTask struct {
	repository          models.Repository
	Event               sceneOEventScreenshot
	Overwrite           bool
	fileNamingAlgorithm models.HashAlgorithm
	generator           *generate.Generator
}

func (t *GenerateOScreenshotTask) GetDescription() string {
	return fmt.Sprintf("Generating O screenshot for O ID %d", t.Event.ID)
}

// oScreenshotVideoCustom returns the file an O was recorded on and the hash
// naming its screenshot: the scene's primary file, or the release's.
func oScreenshotVideoCustom(ctx context.Context, r models.Repository, event sceneOEventScreenshot, algorithm models.HashAlgorithm) (*models.VideoFile, string, error) {
	if event.ReleaseID != 0 {
		files, err := r.SceneRelease.GetFiles(ctx, event.ReleaseID)
		if err != nil || len(files) == 0 {
			return nil, "", err
		}
		return files[0], models.ReleaseVideoHashCustom(files[0], algorithm), nil
	}
	scene, err := r.Scene.Find(ctx, event.SceneID)
	if err != nil {
		return nil, "", err
	}
	if scene == nil {
		return nil, "", fmt.Errorf("scene with id %d not found", event.SceneID)
	}
	if err := scene.LoadPrimaryFile(ctx, r.File); err != nil {
		return nil, "", err
	}
	return scene.Files.Primary(), scene.GetHash(algorithm), nil
}

func (t *GenerateOScreenshotTask) Start(ctx context.Context) {
	var videoFile *models.VideoFile
	var sceneHash string
	r := t.repository
	if err := r.WithReadTxn(ctx, func(ctx context.Context) error {
		var err error
		videoFile, sceneHash, err = oScreenshotVideoCustom(ctx, r, t.Event, t.fileNamingAlgorithm)
		return err
	}); err != nil {
		logger.Errorf("error finding video for O screenshot generation: %v", err)
		return
	}

	if videoFile == nil {
		return
	}

	if t.Event.VideoTimestamp < 0 || t.Event.VideoTimestamp > float64(videoFile.Duration) {
		logger.Warnf("[generator] O timestamp %.2f seconds is outside video duration %.2f seconds, skipping", t.Event.VideoTimestamp, float64(videoFile.Duration))
		return
	}

	output := instance.Paths.Generated.GetOScreenshotPath(sceneHash, t.Event.ID)
	if err := fsutil.EnsureDirAll(filepath.Dir(output)); err != nil {
		logger.Warnf("could not create the O screenshot folder (%v): %v", filepath.Dir(output), err)
		return
	}

	if err := t.generator.OScreenshot(context.TODO(), videoFile.Path, output, t.Event.VideoTimestamp, videoFile.Width); err != nil {
		logger.Errorf("[generator] failed to generate O screenshot: %v", err)
		logErrorOutput(err)
	}
}

func (t *GenerateOScreenshotTask) required(sceneHash string) bool {
	if sceneHash == "" {
		return false
	}

	if t.Overwrite {
		return true
	}

	imagePath := instance.Paths.Generated.GetOScreenshotPath(sceneHash, t.Event.ID)
	imageExists, _ := fsutil.FileExists(imagePath)

	return !imageExists
}

func (j *GenerateJob) queueOScreenshotTasks(ctx context.Context, g *generate.Generator, paths []string, queue chan<- Task) {
	events, err := j.findOScreenshotEvents(ctx, nil, paths)
	if err != nil {
		logger.Errorf("error finding O events for screenshot generation: %s", err.Error())
		return
	}
	j.queueOScreenshotEventTasks(ctx, g, events, queue)
}

// queueSceneOScreenshotJobs covers the scene's O's and its releases'.
func (j *GenerateJob) queueSceneOScreenshotJobs(ctx context.Context, g *generate.Generator, scene *models.Scene, queue chan<- Task) {
	events, err := j.findOScreenshotEvents(ctx, []int{scene.ID}, nil)
	if err != nil {
		logger.Errorf("error finding O events for screenshot generation: %s", err.Error())
		return
	}
	j.queueOScreenshotEventTasks(ctx, g, events, queue)
}

func (j *GenerateJob) queueOScreenshotEventTasks(ctx context.Context, g *generate.Generator, events []sceneOEventScreenshot, queue chan<- Task) {
	for _, event := range events {
		if job.IsCancelled(ctx) {
			return
		}

		_, hash, err := oScreenshotVideoCustom(ctx, j.repository, event, j.fileNamingAlgo)
		if err != nil {
			logger.Errorf("error finding video for O screenshot generation: %s", err.Error())
			return
		}

		task := &GenerateOScreenshotTask{
			repository:          j.repository,
			Event:               event,
			Overwrite:           j.overwrite,
			fileNamingAlgorithm: j.fileNamingAlgo,
			generator:           g,
		}

		if task.required(hash) {
			j.totals.oScreenshots++
			j.totals.tasks++
			queue <- task
		}
	}
}

// oScreenshotPathFilterCustom limits O events to owners with a file under one
// of paths; filesSQL selects the owner's file IDs.
func oScreenshotPathFilterCustom(filesSQL string, paths []string) (string, []interface{}) {
	if len(paths) == 0 {
		return "", nil
	}
	query := " AND EXISTS (SELECT 1 FROM files f JOIN folders fo ON fo.id = f.parent_folder_id WHERE f.id IN (" + filesSQL + ") AND ("
	args := []interface{}{}
	for i, path := range paths {
		if i > 0 {
			query += " OR "
		}
		query += "fo.path LIKE ? OR (fo.path || ? || f.basename) LIKE ?"
		pathPattern := path + "%"
		args = append(args, pathPattern, string(filepath.Separator), pathPattern)
	}
	return query + "))", args
}

func oScreenshotSceneFilterCustom(column string, sceneIDs []int) (string, []interface{}) {
	if len(sceneIDs) == 0 {
		return "", nil
	}
	query := " AND " + column + " IN ("
	args := make([]interface{}, len(sceneIDs))
	for i, sceneID := range sceneIDs {
		if i > 0 {
			query += ", "
		}
		query += "?"
		args[i] = sceneID
	}
	return query + ")", args
}

// oScreenshotEventsQueryCustom selects timestamped O's as (rowid, scene_id,
// release_id or 0, video_timestamp), optionally limited to scenes and paths.
// Release O's count for their parent scene.
func oScreenshotEventsQueryCustom(sceneIDs []int, paths []string, releaseReady bool) (string, []interface{}) {
	query := `
SELECT od.rowid, od.scene_id, 0, od.video_timestamp
FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
WHERE od.video_timestamp IS NOT NULL`
	sceneFilter, args := oScreenshotSceneFilterCustom("od.scene_id", sceneIDs)
	pathFilter, pathArgs := oScreenshotPathFilterCustom("SELECT sf.file_id FROM scenes_files sf WHERE sf.scene_id = s.id", paths)
	query += sceneFilter + pathFilter
	args = append(args, pathArgs...)

	if releaseReady {
		releaseSceneFilter, releaseArgs := oScreenshotSceneFilterCustom("rel.scene_id", sceneIDs)
		releasePathFilter, releasePathArgs := oScreenshotPathFilterCustom("SELECT rf.file_id FROM scene_release_files rf WHERE rf.release_id = rel.id", paths)
		query += `
UNION ALL
SELECT rod.rowid, rel.scene_id, rod.release_id, rod.video_timestamp
FROM scene_release_o_dates rod
JOIN scene_releases rel ON rel.id = rod.release_id
WHERE rod.video_timestamp IS NOT NULL` + releaseSceneFilter + releasePathFilter
		args = append(append(args, releaseArgs...), releasePathArgs...)
	}

	return query + " ORDER BY 3, 1", args
}

func (j *GenerateJob) findOScreenshotEvents(ctx context.Context, sceneIDs []int, paths []string) ([]sceneOEventScreenshot, error) {
	releaseReady, err := sqlite.ReleaseODatesReadyCustom(ctx)
	if err != nil {
		return nil, err
	}
	query, args := oScreenshotEventsQueryCustom(sceneIDs, paths, releaseReady)
	_, rows, err := instance.Database.QuerySQL(ctx, query, args)
	if err != nil {
		return nil, err
	}

	events := make([]sceneOEventScreenshot, 0, len(rows))
	for _, row := range rows {
		if len(row) < 4 {
			continue
		}

		events = append(events, sceneOEventScreenshot{
			ID:             oScreenshotIntValue(row[0]),
			SceneID:        oScreenshotIntValue(row[1]),
			ReleaseID:      oScreenshotIntValue(row[2]),
			VideoTimestamp: oScreenshotFloatValue(row[3]),
		})
	}

	return events, nil
}

func oScreenshotIntValue(value interface{}) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case []byte:
		i, _ := strconv.Atoi(string(v))
		return i
	case string:
		i, _ := strconv.Atoi(v)
		return i
	default:
		i, _ := strconv.Atoi(fmt.Sprint(value))
		return i
	}
}

func oScreenshotFloatValue(value interface{}) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case []byte:
		f, _ := strconv.ParseFloat(string(v), 64)
		return f
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	default:
		f, _ := strconv.ParseFloat(fmt.Sprint(value), 64)
		return f
	}
}
