package api

import (
	"strings"
	"testing"

	"github.com/stashapp/stash/internal/api/urlbuilders"
	"github.com/stashapp/stash/pkg/models"
)

func TestReleaseMarkerUsesReleaseAssetPathCustom(t *testing.T) {
	releaseID := 8
	marker := &models.SceneMarker{ID: 11, SceneID: 2, ReleaseID: &releaseID}
	builder := urlbuilders.NewSceneMarkerURLBuilder("http://localhost", marker)
	if got := builder.GetScreenshotURL(); got != "http://localhost/scene-release/8/scene_marker/11/screenshot" {
		t.Fatalf("release marker screenshot URL = %q", got)
	}
	video := &models.VideoFile{BaseFile: &models.BaseFile{Fingerprints: models.Fingerprints{
		{Type: models.FingerprintTypeMD5, Fingerprint: "release-md5"},
		{Type: models.FingerprintTypeOshash, Fingerprint: int64(0x1234)},
	}}}
	if got := releaseMarkerVideoHashCustom(video, models.HashAlgorithmMd5); got != "release-md5" {
		t.Fatalf("release marker MD5 hash = %q", got)
	}
	if got := releaseMarkerVideoHashCustom(video, models.HashAlgorithmOshash); got != "1234" {
		t.Fatalf("release marker oshash = %q", got)
	}
}

func TestReleaseMediaPathsStayOnReleaseCustom(t *testing.T) {
	paths := releaseMediaPathsCustom(&SceneReleasePaths{}, "http://localhost", 8, "release-md5")
	checks := map[string]*string{
		"preview":   paths.Preview,
		"webp":      paths.Webp,
		"vtt":       paths.Vtt,
		"sprite":    paths.Sprite,
		"funscript": paths.Funscript,
		"heatmap":   paths.InteractiveHeatmap,
		"caption":   paths.Caption,
	}
	for name, value := range checks {
		if value == nil || !strings.HasPrefix(*value, "http://localhost/scene-release/8/") {
			t.Fatalf("%s path should use the release owner, got %v", name, value)
		}
	}
	if *paths.Vtt != "http://localhost/scene-release/8/release-md5_thumbs.vtt" || *paths.Sprite != "http://localhost/scene-release/8/release-md5_sprite.jpg" {
		t.Fatalf("release sprite paths do not preserve relative VTT links: %v %v", *paths.Vtt, *paths.Sprite)
	}
	withoutHash := releaseMediaPathsCustom(&SceneReleasePaths{}, "http://localhost", 8, "")
	if withoutHash.Vtt != nil || withoutHash.Sprite != nil {
		t.Fatal("fingerprint-dependent media should be absent without a hash")
	}
}
