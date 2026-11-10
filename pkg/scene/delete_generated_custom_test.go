package scene

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
)

func TestReleaseGeneratedFilesUseTheirVideoFingerprintCustom(t *testing.T) {
	video := &models.VideoFile{BaseFile: &models.BaseFile{Fingerprints: models.Fingerprints{
		{Type: models.FingerprintTypeMD5, Fingerprint: "release-md5"},
		{Type: models.FingerprintTypeOshash, Fingerprint: int64(0x1234)},
	}}}
	scene := sceneForReleaseGeneratedFilesCustom(video)
	if got := scene.GetHash(models.HashAlgorithmMd5); got != "release-md5" {
		t.Fatalf("release MD5 hash = %q", got)
	}
	if got := scene.GetHash(models.HashAlgorithmOshash); got != "1234" {
		t.Fatalf("release oshash = %q", got)
	}
}
