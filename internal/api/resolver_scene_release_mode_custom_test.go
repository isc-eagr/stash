package api

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/stashapp/stash/pkg/models"
)

// fakeReleaseReaderCustom serves one release; unused methods panic through
// the nil embedded interface.
type fakeReleaseReaderCustom struct {
	models.SceneReleaseReaderWriter
	release    *models.SceneRelease
	urls       []string
	files      []*models.VideoFile
	stashIDs   []models.StashID
	setMatches []*int
}

func (f *fakeReleaseReaderCustom) Find(_ context.Context, id int) (*models.SceneRelease, error) {
	if f.release == nil || f.release.ID != id {
		return nil, nil
	}
	return f.release, nil
}

func (f *fakeReleaseReaderCustom) GetURLsCustom(context.Context, int) ([]string, error) {
	return f.urls, nil
}

func (f *fakeReleaseReaderCustom) GetFiles(context.Context, int) ([]*models.VideoFile, error) {
	return f.files, nil
}

func (f *fakeReleaseReaderCustom) GetStashIDsCustom(context.Context, int) ([]models.StashID, error) {
	return f.stashIDs, nil
}

func (f *fakeReleaseReaderCustom) SetStashDBMatchesCustom(_ context.Context, _ int, matches *int) error {
	f.setMatches = append(f.setMatches, matches)
	return nil
}

func releaseVideoFileCustom(id models.FileID, path, oshash, phash string) *models.VideoFile {
	return &models.VideoFile{BaseFile: &models.BaseFile{
		ID:   id,
		Path: path,
		Fingerprints: models.Fingerprints{
			{Type: models.FingerprintTypeOshash, Fingerprint: oshash},
			{Type: models.FingerprintTypePhash, Fingerprint: phash},
		},
	}}
}

func TestReleaseScrapeSceneCustom(t *testing.T) {
	date := models.Date{}
	studioID := 4
	qb := &fakeReleaseReaderCustom{
		release: &models.SceneRelease{ID: 9, SceneID: 3, Title: "Release cut", Code: "RC-1", Details: "details",
			Director: "dir", URL: "https://old.example", Date: &date, StudioID: &studioID},
		urls: []string{"https://one.example", "https://two.example"},
		files: []*models.VideoFile{
			releaseVideoFileCustom(21, "/media/release.mp4", "abc", "ffff"),
			releaseVideoFileCustom(22, "/media/release-alt.mp4", "def", "eeee"),
		},
	}
	scene, err := releaseScrapeSceneCustom(context.Background(), qb, 9)
	require.NoError(t, err)
	require.Equal(t, 3, scene.ID, "scrapers get the parent scene ID")
	require.Equal(t, "Release cut", scene.Title)
	require.Equal(t, "RC-1", scene.Code)
	require.Equal(t, "dir", scene.Director)
	require.Equal(t, "details", scene.Details)
	require.Equal(t, &date, scene.Date)
	require.Equal(t, &studioID, scene.StudioID)
	require.Equal(t, []string{"https://one.example", "https://two.example"}, scene.URLs.List())
	require.Len(t, scene.Files.List(), 2)
	require.Equal(t, "/media/release.mp4", scene.Path)
	require.Equal(t, "abc", scene.OSHash)
	require.Equal(t, models.FileID(21), *scene.PrimaryFileID)

	// The deprecated single URL is used only when the list is empty.
	qb.urls = nil
	qb.files = nil
	scene, err = releaseScrapeSceneCustom(context.Background(), qb, 9)
	require.NoError(t, err)
	require.Equal(t, []string{"https://old.example"}, scene.URLs.List())
	require.Empty(t, scene.Path)
	require.Nil(t, scene.PrimaryFileID)

	_, err = releaseScrapeSceneCustom(context.Background(), qb, 10)
	require.Error(t, err)
}

func TestReleaseFingerprintsCustom(t *testing.T) {
	qb := &fakeReleaseReaderCustom{
		release: &models.SceneRelease{ID: 9, SceneID: 3},
		files: []*models.VideoFile{
			releaseVideoFileCustom(21, "/a.mp4", "abc", "ffff"),
			releaseVideoFileCustom(22, "/b.mp4", "def", "eeee"),
		},
	}
	fps, err := releaseFingerprintsCustom(context.Background(), qb, 9)
	require.NoError(t, err)
	require.Len(t, fps, 4)
	require.Equal(t, "abc", fps[0].Value())
	require.Equal(t, "eeee", fps[3].Value())

	// No files: an input error, never the parent's fingerprints.
	qb.files = nil
	_, err = releaseFingerprintsCustom(context.Background(), qb, 9)
	require.ErrorIs(t, err, ErrInput)

	_, err = releaseFingerprintsCustom(context.Background(), qb, 10)
	require.Error(t, err)
}

func TestParseScrapeReleaseIDCustom(t *testing.T) {
	id, scene, bad := "9", "3", "x"
	got, err := parseScrapeReleaseIDCustom(ScrapeSingleSceneInput{ReleaseID: &id})
	require.NoError(t, err)
	require.Equal(t, 9, got)
	_, err = parseScrapeReleaseIDCustom(ScrapeSingleSceneInput{ReleaseID: &id, SceneID: &scene})
	require.ErrorIs(t, err, ErrInput)
	_, err = parseScrapeReleaseIDCustom(ScrapeSingleSceneInput{ReleaseID: &bad})
	require.ErrorIs(t, err, ErrInput)
}

func TestSetUpdatedReleaseStashDBMatchesCustom(t *testing.T) {
	seven := 7
	ctx := context.Background()

	qb := &fakeReleaseReaderCustom{}
	require.NoError(t, setUpdatedReleaseStashDBMatchesCustom(ctx, qb, 9, &seven, true))
	require.Equal(t, 0, *qb.setMatches[0], "no StashDB link left stores 0")

	qb = &fakeReleaseReaderCustom{stashIDs: []models.StashID{{Endpoint: "https://stashdb.org/graphql", StashID: "a"}}}
	require.NoError(t, setUpdatedReleaseStashDBMatchesCustom(ctx, qb, 9, &seven, true))
	require.Equal(t, 7, *qb.setMatches[0])

	qb = &fakeReleaseReaderCustom{}
	require.NoError(t, setUpdatedReleaseStashDBMatchesCustom(ctx, qb, 9, nil, false))
	require.Nil(t, qb.setMatches[0], "null clears the count")
}

func TestSceneOwnerFromInputCustom(t *testing.T) {
	three, nine, bad := "3", "9", "0"
	owner, err := sceneOwnerFromInputCustom("from", &three, nil)
	require.NoError(t, err)
	require.Equal(t, models.SceneOwnerCustom{SceneID: 3}, owner)
	owner, err = sceneOwnerFromInputCustom("to", nil, &nine)
	require.NoError(t, err)
	require.Equal(t, models.SceneOwnerCustom{ReleaseID: 9}, owner)
	for _, ids := range [][2]*string{{nil, nil}, {&three, &nine}, {&bad, nil}} {
		_, err = sceneOwnerFromInputCustom("from", ids[0], ids[1])
		require.ErrorIs(t, err, ErrInput)
	}
}

func TestGroupMarkersByPrimaryTagCustom(t *testing.T) {
	early := &models.Tag{ID: 5, Name: "Early"}
	late := &models.Tag{ID: 6, Name: "Late"}
	markers := []*models.SceneMarker{
		{ID: 1, Seconds: 50, PrimaryTagID: 6},
		{ID: 2, Seconds: 10, PrimaryTagID: 5},
		{ID: 3, Seconds: 60, PrimaryTagID: 6},
	}
	got, err := groupMarkersByPrimaryTagCustom(markers, []*models.Tag{late, early, late})
	require.NoError(t, err)
	require.Len(t, got, 2)
	require.Equal(t, early, got[0].Tag)
	require.Equal(t, late, got[1].Tag)
	require.Len(t, got[1].SceneMarkers, 2)

	_, err = groupMarkersByPrimaryTagCustom(markers[:1], []*models.Tag{nil})
	require.Error(t, err)
	require.False(t, errors.Is(err, ErrInput))
}
