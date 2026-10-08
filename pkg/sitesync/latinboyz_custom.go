package sitesync

// CUSTOM: LatinBoyz. Everything comes from the public WordPress posts: the
// scene's own latinboyz.com URL or, for recent posts whose images carry
// am<code>, a site search. Pictures are not downloaded; their folders are
// added by hand, named after the members zip files.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/html"
)

const (
	lbzHost      = "latinboyz.com"
	lbzSearchURL = "https://latinboyz.com/wp-json/wp/v2/posts?search=am%s&per_page=20&_fields=link,content"
)

var (
	// File names put the code after a letter prefix: HD2224, am245v2,
	// wmv1069-3000HD, NEWam1798, 1700HD.
	lbzFileCodeRE = regexp.MustCompile(`^[A-Za-z]*(\d{3,})`)
	// A pictures folder name part holding the code: am2224 or 1455.
	lbzFolderPartRE = regexp.MustCompile(`(?i)^(?:am)?(\d{3,})$`)
	// Post paragraphs that link to the members area or credit the photographer.
	lbzBoilerplate = []string{"MEMBERS", "NOT A MEMBER", "Photography"}
)

type latinboyz struct {
	client *Client
}

func (s *latinboyz) Name() string    { return "LatinBoyz" }
func (s *latinboyz) Client() *Client { return s.client }

func (s *latinboyz) SceneCode(scene Scene) string {
	if m := lbzFileCodeRE.FindStringSubmatch(scene.Basename); m != nil {
		return m[1]
	}
	return ""
}

func (s *latinboyz) Scrape(ctx context.Context, code string, scene Scene) (Metadata, error) {
	postURL := lbzPostURL(scene.URLs)
	if postURL == "" {
		var err error
		if postURL, err = s.findPost(ctx, code); err != nil {
			return Metadata{}, err
		}
	}
	doc, err := s.client.Page(ctx, postURL, false)
	if err != nil {
		return Metadata{}, err
	}
	ret := lbzPost(doc)
	if ret.Title == "" {
		return Metadata{}, ErrNotFound
	}
	ret.URLs = []string{postURL}
	return ret, nil
}

// findPost searches the posts for am<code> and returns the only one whose
// content names exactly that code; the search also matches longer codes.
func (s *latinboyz) findPost(ctx context.Context, code string) (string, error) {
	if code == "" || strings.Trim(code, "0123456789") != "" {
		return "", ErrNotFound
	}
	body, err := s.client.Body(ctx, fmt.Sprintf(lbzSearchURL, code), false)
	if err != nil {
		return "", err
	}
	var posts []struct {
		Link    string `json:"link"`
		Content struct {
			Rendered string `json:"rendered"`
		} `json:"content"`
	}
	if err := json.Unmarshal(body, &posts); err != nil {
		return "", fmt.Errorf("reading the search for am%s: %w", code, err)
	}
	codeRE := regexp.MustCompile(`(?i)\bam` + code + `(?:\D|$)`)
	var links []string
	for _, p := range posts {
		if codeRE.MatchString(p.Content.Rendered) {
			links = append(links, p.Link)
		}
	}
	if len(links) != 1 {
		return "", ErrNotFound
	}
	return links[0], nil
}

// FolderCode reads the code from folder names such as
// "latinboyz-model-brian-am2224", "am1449", "latinboyz-model-1455-tempo"
// and copies like "latinboyz-model-gato-am2196 (1)".
func (s *latinboyz) FolderCode(name string) string {
	parts := strings.Split(copySuffixRE.ReplaceAllString(name, ""), "-")
	for i := len(parts) - 1; i >= 0; i-- {
		if m := lbzFolderPartRE.FindStringSubmatch(parts[i]); m != nil {
			return m[1]
		}
	}
	return ""
}

// lbzPostURL returns the first of urls pointing to a public post.
func lbzPostURL(urls []string) string {
	for _, raw := range urls {
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
			continue
		}
		if strings.TrimPrefix(strings.ToLower(u.Host), "www.") == lbzHost && strings.Trim(u.Path, "/") != "" {
			return raw
		}
	}
	return ""
}

// lbzPost reads a post: the title heading, the description paragraphs, and
// the publish date and image from its schema.org graph.
func lbzPost(doc *html.Node) Metadata {
	var ret Metadata
	if titles := findByClass(doc, "entry-title"); len(titles) > 0 {
		ret.Title = inlineText(titles[0])
	}
	if contents := findByClass(doc, "entry-content"); len(contents) > 0 {
		var paragraphs []string
		for c := contents[0].FirstChild; c != nil; c = c.NextSibling {
			if c.Type != html.ElementNode || c.Data != "p" {
				continue
			}
			if text := inlineText(c); text != "" && !lbzIsBoilerplate(text) {
				paragraphs = append(paragraphs, text)
			}
		}
		ret.Details = strings.Join(paragraphs, "\n")
	}
	ret.Date, ret.Cover = lbzSchema(doc)
	return ret
}

func lbzIsBoilerplate(text string) bool {
	for _, prefix := range lbzBoilerplate {
		if strings.HasPrefix(text, prefix) {
			return true
		}
	}
	return false
}

// lbzSchema reads the first publish date and image from the page's
// schema.org graph. Other JSON-LD blocks carry the last edit as their date.
func lbzSchema(doc *html.Node) (date, cover string) {
	for _, script := range findAll(doc, "script") {
		if attr(script, "type") != "application/ld+json" || script.FirstChild == nil {
			continue
		}
		var ld struct {
			Graph []struct {
				DatePublished string `json:"datePublished"`
				ThumbnailURL  string `json:"thumbnailUrl"`
			} `json:"@graph"`
		}
		if json.Unmarshal([]byte(script.FirstChild.Data), &ld) != nil {
			continue
		}
		for _, node := range ld.Graph {
			if day, _, _ := strings.Cut(node.DatePublished, "T"); date == "" {
				if _, err := time.Parse("2006-01-02", day); err == nil {
					date = day
				}
			}
			if cover == "" {
				cover = node.ThumbnailURL
			}
		}
		if date != "" || cover != "" {
			return date, cover
		}
	}
	return "", ""
}
