package sitesync

// CUSTOM: Bilatinmen. Codes come from "<code>-high" file names; the public
// preview page has the title and the members pictures folder has the date.

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

const (
	blmPreviewURL = "https://bilatinmen.com/latin_men_preview/model%s/latin_men_preview_%s.php"
	blmPicsURL    = "https://bilatinmen.com/members/latin_men_pictures/pictures_%s/%s/"
	// Codes up to this one live in pictures_08, later ones in pictures_09.
	blmLastPictures08Code = 1100
)

var (
	blmFileCodeRE = regexp.MustCompile(`^(\d+)-high`)
	blmURLCodeRE  = regexp.MustCompile(`(?i)latin_men_preview_(\d+)|/model(\d+)/`)
)

type bilatinmen struct {
	client *Client
}

func (s *bilatinmen) Name() string    { return "Bilatinmen" }
func (s *bilatinmen) Client() *Client { return s.client }

func (s *bilatinmen) SceneCode(scene Scene) string {
	if m := blmFileCodeRE.FindStringSubmatch(scene.Basename); m != nil {
		return m[1]
	}
	for _, u := range scene.URLs {
		if m := blmURLCodeRE.FindStringSubmatch(u); m != nil {
			return m[1] + m[2]
		}
	}
	return ""
}

func (s *bilatinmen) Scrape(ctx context.Context, code string, _ Scene) (Metadata, error) {
	previewURL := fmt.Sprintf(blmPreviewURL, code, code)
	doc, err := s.client.Page(ctx, previewURL, false)
	if err != nil {
		return Metadata{}, err
	}
	names := findByClass(doc, "modelName")
	if len(names) == 0 || nodeText(names[0]) == "" {
		return Metadata{}, ErrNotFound
	}
	ret := Metadata{Title: nodeText(names[0]), URLs: []string{previewURL}}

	// The date is members-only; a refused login leaves it empty.
	listing, err := s.client.Page(ctx, s.picsURL(code), true)
	switch {
	case err == nil:
		if entries, ok := ParseIndex(listing); ok {
			ret.Date = EarliestDate(entries)
		}
	case !errors.Is(err, ErrUnauthorized) && !errors.Is(err, ErrNotFound):
		return ret, err
	}
	return ret, nil
}

// PicsFolder is "model<code>" for numbered scenes; extras such as "extra142"
// use their code as the folder name.
func (s *bilatinmen) PicsFolder(code string) string {
	if _, err := strconv.Atoi(code); err == nil {
		return "model" + code
	}
	return code
}

func (s *bilatinmen) Pics(ctx context.Context, code string) (string, []string, error) {
	folderURL := s.picsURL(code)
	doc, err := s.client.Page(ctx, folderURL, true)
	if err != nil {
		return "", nil, err
	}
	entries, ok := ParseIndex(doc)
	if !ok {
		return "", nil, ErrNotFound
	}
	return folderURL, picNames(entries, strings.TrimRightFunc(s.PicsFolder(code), unicode.IsDigit)), nil
}

func (s *bilatinmen) picsURL(code string) string {
	set := "09"
	if n, err := strconv.Atoi(code); err == nil && n <= blmLastPictures08Code {
		set = "08"
	}
	return fmt.Sprintf(blmPicsURL, set, s.PicsFolder(code))
}
