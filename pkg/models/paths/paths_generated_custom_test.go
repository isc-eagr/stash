package paths

import (
	"path/filepath"
	"testing"
)

func TestGetOScreenshotPath(t *testing.T) {
	paths := NewPaths(filepath.Join("root", "generated"), filepath.Join("root", "blobs"))

	got := paths.Generated.GetOScreenshotPath("scenehash", 42)
	want := filepath.Join("root", "generated", "o_screenshots", "scenehash", "42.jpg")

	if got != want {
		t.Fatalf("GetOScreenshotPath() = %q, want %q", got, want)
	}
}
