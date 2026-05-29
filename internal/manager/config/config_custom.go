package config

// CUSTOM: Marker preview quality setting - controls whether marker video/webp previews
// are generated at source resolution or downscaled to 640px.

const (
	MarkerPreviewSourceQuality        = "marker_preview_source_quality"
	markerPreviewSourceQualityDefault = false
)

// GetMarkerPreviewSourceQuality returns true if marker previews should be generated
// at the source video's original resolution instead of being downscaled to 640px.
func (i *Config) GetMarkerPreviewSourceQuality() bool {
	return i.getBool(MarkerPreviewSourceQuality)
}
