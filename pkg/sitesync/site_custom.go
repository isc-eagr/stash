package sitesync

// CUSTOM: Site contract shared by the studio site sync providers.

import (
	"context"
	"strings"
	"unicode"
)

// Scene is what a site needs to know about a local scene.
type Scene struct {
	ID       int
	Basename string
	Size     int64
	URLs     []string
}

// Metadata is what a site publishes for a code. Fields it could not reach
// are empty.
type Metadata struct {
	Title   string
	Date    string // YYYY-MM-DD
	Details string
	URLs    []string
	Cover   string // image URL
}

type Site interface {
	Name() string
	// SceneCode reads the code from the scene's file name or URLs, or returns "".
	SceneCode(s Scene) string
	// Scrape returns ErrNotFound when the site has no scene for code. s is the
	// local scene, whose URLs may point to the site's page.
	Scrape(ctx context.Context, code string, s Scene) (Metadata, error)
	Client() *Client
}

// PicsSite downloads each code's members pictures into its own folder.
type PicsSite interface {
	Site
	// PicsFolder names the folder, under the pics path, holding code's images.
	PicsFolder(code string) string
	// Pics returns the members folder URL (with trailing slash) and the image
	// file names in it.
	Pics(ctx context.Context, code string) (folderURL string, names []string, err error)
}

// FolderCoder is a site whose pictures folders are added by hand and named
// with more than the code.
type FolderCoder interface {
	// FolderCode reads the code from a pictures folder name, or returns "".
	FolderCode(name string) string
}

// CodeResolver is a site whose file names do not carry the code, so codes
// come from matching file names against the site's own video links.
type CodeResolver interface {
	ResolveCodes(ctx context.Context, scenes []Scene, taken map[string]bool) (Resolution, error)
}

type Resolution struct {
	Codes map[int]string // scene ID -> code
	// Ambiguous maps scene ID -> candidate codes for names the site uses for
	// more than one scene that the file size could not settle.
	Ambiguous map[int][]string
	// Taken maps scene ID -> matching codes another scene already holds.
	Taken     map[int][]string
	Unmatched []int
}

// Config holds one site's settings from Settings > Custom.
type Config struct {
	Username string
	Password string
	PicsPath string
}

// Keys used in the UI configuration and to match studio names.
const (
	BilatinmenKey = "bilatinmen"
	NakedPapisKey = "nakedpapis"
	LatinboyzKey  = "latinboyz"
)

// SiteKey returns the site key matching a studio name, or "" when the studio
// has no site sync.
func SiteKey(studioName string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(studioName) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	switch key := b.String(); key {
	case BilatinmenKey, NakedPapisKey, LatinboyzKey:
		return key
	}
	return ""
}

// New returns the site for key, using client for every request.
func New(key string, client *Client) Site {
	switch key {
	case BilatinmenKey:
		return &bilatinmen{client: client}
	case NakedPapisKey:
		return &nakedPapis{client: client, kinds: map[string]string{}}
	case LatinboyzKey:
		return &latinboyz{client: client}
	}
	return nil
}

func isPicName(name, prefix string) bool {
	lower := strings.ToLower(name)
	return strings.HasPrefix(lower, prefix) && strings.HasSuffix(lower, ".jpg")
}

func picNames(entries []IndexEntry, prefix string) []string {
	var ret []string
	for _, e := range entries {
		if isPicName(e.Name, prefix) {
			ret = append(ret, e.Name)
		}
	}
	return ret
}
