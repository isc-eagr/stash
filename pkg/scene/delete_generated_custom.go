package scene

import "github.com/stashapp/stash/pkg/models"

// A release's generated media is keyed by its video fingerprint, even when
// that file was never the parent scene's primary file.
func sceneForReleaseGeneratedFilesCustom(video *models.VideoFile) *models.Scene {
	ret := &models.Scene{}
	if video == nil || video.BaseFile == nil {
		return ret
	}
	if fingerprint := video.Fingerprints.For(models.FingerprintTypeMD5); fingerprint != nil {
		ret.Checksum = fingerprint.Value()
	}
	if fingerprint := video.Fingerprints.For(models.FingerprintTypeOshash); fingerprint != nil {
		ret.OSHash = fingerprint.Value()
	}
	return ret
}
