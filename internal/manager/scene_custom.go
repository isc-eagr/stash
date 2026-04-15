package manager

// CUSTOM: This entire file contains custom additions for scene release streaming.

import (
	"net/url"

	"github.com/stashapp/stash/pkg/ffmpeg"
	"github.com/stashapp/stash/pkg/models"
)

// GetReleaseStreamPaths returns the stream endpoints for a scene release.
// This is a simplified version of GetSceneStreamPaths for releases.
func GetReleaseStreamPaths(primaryFile *models.VideoFile, directStreamURL *url.URL, maxStreamingTranscodeSize models.StreamingResolutionEnum) ([]*SceneStreamEndpoint, error) {
	if primaryFile == nil {
		return nil, nil
	}

	// convert StreamingResolutionEnum to ResolutionEnum
	maxStreamingResolution := models.ResolutionEnum(maxStreamingTranscodeSize)
	sceneResolution := models.GetMinResolution(primaryFile)
	includeSceneStreamPath := func(streamingResolution models.StreamingResolutionEnum) bool {
		var minResolution int
		if streamingResolution == models.StreamingResolutionEnumOriginal {
			minResolution = sceneResolution
		} else {
			convertedRes := models.ResolutionEnum(streamingResolution)
			minResolution = convertedRes.GetMinResolution()

			if sceneResolution != 0 && sceneResolution < minResolution {
				return false
			}
		}

		if maxStreamingTranscodeSize == models.StreamingResolutionEnumOriginal {
			return true
		}

		return maxStreamingResolution.GetMinResolution() >= minResolution
	}

	makeStreamEndpoint := func(t endpointType, resolution models.StreamingResolutionEnum) *SceneStreamEndpoint {
		url := *directStreamURL
		url.Path += t.extension

		label := t.label

		if resolution != "" {
			v := url.Query()
			v.Set("resolution", resolution.String())
			url.RawQuery = v.Encode()

			switch resolution {
			case models.StreamingResolutionEnumFourK:
				label += " 4K (2160p)"
			case models.StreamingResolutionEnumFullHd:
				label += " Full HD (1080p)"
			case models.StreamingResolutionEnumStandardHd:
				label += " HD (720p)"
			case models.StreamingResolutionEnumStandard:
				label += " Standard (480p)"
			case models.StreamingResolutionEnumLow:
				label += " Low (240p)"
			}
		}

		return &SceneStreamEndpoint{
			URL:      url.String(),
			MimeType: &t.mimeType,
			Label:    &label,
		}
	}

	var endpoints []*SceneStreamEndpoint

	// direct stream should only apply when the audio codec is supported
	audioCodec := ffmpeg.MissingUnsupported
	if primaryFile.AudioCodec != "" {
		audioCodec = ffmpeg.ProbeAudioCodec(primaryFile.AudioCodec)
	}

	container, _ := GetVideoFileContainer(primaryFile)

	if ffmpeg.IsValidAudioForContainer(audioCodec, container) {
		endpoints = append(endpoints, makeStreamEndpoint(directEndpointType, ""))
	}

	// only add mkv stream endpoint if the container is an mkv already
	if container == ffmpeg.Matroska {
		endpoints = append(endpoints, makeStreamEndpoint(mkvEndpointType, ""))
	}

	mp4Streams := []*SceneStreamEndpoint{}
	webmStreams := []*SceneStreamEndpoint{}

	if includeSceneStreamPath(models.StreamingResolutionEnumOriginal) {
		mp4Streams = append(mp4Streams, makeStreamEndpoint(mp4EndpointType, models.StreamingResolutionEnumOriginal))
		webmStreams = append(webmStreams, makeStreamEndpoint(webmEndpointType, models.StreamingResolutionEnumOriginal))
	}

	if includeSceneStreamPath(models.StreamingResolutionEnumFourK) {
		mp4Streams = append(mp4Streams, makeStreamEndpoint(mp4EndpointType, models.StreamingResolutionEnumFourK))
		webmStreams = append(webmStreams, makeStreamEndpoint(webmEndpointType, models.StreamingResolutionEnumFourK))
	}

	if includeSceneStreamPath(models.StreamingResolutionEnumFullHd) {
		mp4Streams = append(mp4Streams, makeStreamEndpoint(mp4EndpointType, models.StreamingResolutionEnumFullHd))
		webmStreams = append(webmStreams, makeStreamEndpoint(webmEndpointType, models.StreamingResolutionEnumFullHd))
	}

	if includeSceneStreamPath(models.StreamingResolutionEnumStandardHd) {
		mp4Streams = append(mp4Streams, makeStreamEndpoint(mp4EndpointType, models.StreamingResolutionEnumStandardHd))
		webmStreams = append(webmStreams, makeStreamEndpoint(webmEndpointType, models.StreamingResolutionEnumStandardHd))
	}

	if includeSceneStreamPath(models.StreamingResolutionEnumStandard) {
		mp4Streams = append(mp4Streams, makeStreamEndpoint(mp4EndpointType, models.StreamingResolutionEnumStandard))
		webmStreams = append(webmStreams, makeStreamEndpoint(webmEndpointType, models.StreamingResolutionEnumStandard))
	}

	if includeSceneStreamPath(models.StreamingResolutionEnumLow) {
		mp4Streams = append(mp4Streams, makeStreamEndpoint(mp4EndpointType, models.StreamingResolutionEnumLow))
		webmStreams = append(webmStreams, makeStreamEndpoint(webmEndpointType, models.StreamingResolutionEnumLow))
	}

	endpoints = append(endpoints, mp4Streams...)
	endpoints = append(endpoints, webmStreams...)

	return endpoints, nil
}
