package manager

// CUSTOM: Generate screenshots for timestamped scene O events.

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
)

type sceneOEventScreenshot struct {
	ID             int
	SceneID        int
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

func (t *GenerateOScreenshotTask) Start(ctx context.Context) {
	var scene *models.Scene
	r := t.repository
	if err := r.WithReadTxn(ctx, func(ctx context.Context) error {
		var err error
		scene, err = r.Scene.Find(ctx, t.Event.SceneID)
		if err != nil {
			return err
		}
		if scene == nil {
			return fmt.Errorf("scene with id %d not found", t.Event.SceneID)
		}

		return scene.LoadPrimaryFile(ctx, r.File)
	}); err != nil {
		logger.Errorf("error finding scene for O screenshot generation: %v", err)
		return
	}

	videoFile := scene.Files.Primary()
	if videoFile == nil {
		return
	}

	if t.Event.VideoTimestamp < 0 || t.Event.VideoTimestamp > float64(videoFile.Duration) {
		logger.Warnf("[generator] O timestamp %.2f seconds is outside video duration %.2f seconds, skipping", t.Event.VideoTimestamp, float64(videoFile.Duration))
		return
	}

	sceneHash := scene.GetHash(t.fileNamingAlgorithm)
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

	for _, event := range events {
		if job.IsCancelled(ctx) {
			return
		}

		scene, err := j.repository.Scene.Find(ctx, event.SceneID)
		if err != nil {
			logger.Errorf("error finding scene for O screenshot generation: %s", err.Error())
			return
		}
		if scene == nil {
			continue
		}

		task := &GenerateOScreenshotTask{
			repository:          j.repository,
			Event:               event,
			Overwrite:           j.overwrite,
			fileNamingAlgorithm: j.fileNamingAlgo,
			generator:           g,
		}

		if task.required(scene.GetHash(j.fileNamingAlgo)) {
			j.totals.oScreenshots++
			j.totals.tasks++
			queue <- task
		}
	}
}

func (j *GenerateJob) queueSceneOScreenshotJobs(ctx context.Context, g *generate.Generator, scene *models.Scene, queue chan<- Task) {
	events, err := j.findOScreenshotEvents(ctx, []int{scene.ID}, nil)
	if err != nil {
		logger.Errorf("error finding O events for screenshot generation: %s", err.Error())
		return
	}

	for _, event := range events {
		task := &GenerateOScreenshotTask{
			repository:          j.repository,
			Event:               event,
			Overwrite:           j.overwrite,
			fileNamingAlgorithm: j.fileNamingAlgo,
			generator:           g,
		}

		if task.required(scene.GetHash(j.fileNamingAlgo)) {
			j.totals.oScreenshots++
			j.totals.tasks++
			queue <- task
		}
	}
}

func (j *GenerateJob) findOScreenshotEvents(ctx context.Context, sceneIDs []int, paths []string) ([]sceneOEventScreenshot, error) {
	query := `
SELECT od.rowid, od.scene_id, od.video_timestamp
FROM scenes_o_dates od
JOIN scenes s ON s.id = od.scene_id
WHERE od.video_timestamp IS NOT NULL`
	args := []interface{}{}

	if len(sceneIDs) > 0 {
		query += " AND od.scene_id IN ("
		for i, sceneID := range sceneIDs {
			if i > 0 {
				query += ", "
			}
			query += "?"
			args = append(args, sceneID)
		}
		query += ")"
	}

	if len(paths) > 0 {
		query += " AND EXISTS (SELECT 1 FROM scenes_files sf JOIN files f ON f.id = sf.file_id JOIN folders fo ON fo.id = f.parent_folder_id WHERE sf.scene_id = s.id"
		for i, path := range paths {
			if i == 0 {
				query += " AND (fo.path LIKE ? OR (fo.path || ? || f.basename) LIKE ?"
			} else {
				query += " OR fo.path LIKE ? OR (fo.path || ? || f.basename) LIKE ?"
			}
			pathPattern := path + "%"
			args = append(args, pathPattern, string(filepath.Separator), pathPattern)
		}
		query += "))"
	}

	query += " ORDER BY od.rowid ASC"

	_, rows, err := instance.Database.QuerySQL(ctx, query, args)
	if err != nil {
		return nil, err
	}

	events := make([]sceneOEventScreenshot, 0, len(rows))
	for _, row := range rows {
		if len(row) < 3 {
			continue
		}

		events = append(events, sceneOEventScreenshot{
			ID:             oScreenshotIntValue(row[0]),
			SceneID:        oScreenshotIntValue(row[1]),
			VideoTimestamp: oScreenshotFloatValue(row[2]),
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
