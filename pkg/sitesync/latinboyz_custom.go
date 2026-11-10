package sitesync

// CUSTOM: LatinBoyz. Everything comes from the public WordPress posts: the
// scene's own latinboyz.com URL or a cached public post index matched by
// image and trailer codes. Pictures are not downloaded; their folders are
// added by hand, named after the members zip files.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/html"
)

const (
	lbzHost     = "latinboyz.com"
	lbzIndexURL = "https://latinboyz.com/wp-json/wp/v2/posts?per_page=100&page=%d&orderby=id&order=asc&_fields=link,content"
)

var (
	// File names put the code after a letter prefix: HD2224, am245v2,
	// wmv1069-3000HD, NEWam1798, 1700HD.
	lbzFileCodeRE   = regexp.MustCompile(`^[A-Za-z]*(\d{3,})`)
	lbzMediaCodeRE  = regexp.MustCompile(`(?i)(?:^|[-_])(?:am|HD|wmv)(\d{3,})`)
	ErrCodeConflict = errors.New("conflicting scene codes")
	ErrAmbiguous    = errors.New("more than one public scene matches")
	// A pictures folder name part holding the code: am2224 or 1455.
	lbzFolderPartRE = regexp.MustCompile(`(?i)^(?:am)?(\d{3,})$`)
	// Post paragraphs that link to the members area or credit the photographer.
	lbzBoilerplate = []string{"MEMBERS", "NOT A MEMBER", "Photography"}
)

type latinboyz struct {
	client   *Client
	index    map[string][]string
	indexed  bool
	indexErr error
}

func (s *latinboyz) Name() string    { return "LatinBoyz" }
func (s *latinboyz) Client() *Client { return s.client }

func (s *latinboyz) SceneCode(scene Scene) string {
	if m := lbzFileCodeRE.FindStringSubmatch(strings.TrimSpace(scene.Basename)); m != nil {
		return m[1]
	}
	return ""
}

func (s *latinboyz) HasSceneURL(scene Scene) bool {
	return lbzPostURL(scene.URLs) != ""
}

func (s *latinboyz) Scrape(ctx context.Context, code string, scene Scene) (Metadata, error) {
	if fileCode := s.SceneCode(scene); code != "" && fileCode != "" && code != fileCode {
		return Metadata{}, fmt.Errorf("%w: Code is %s but the filename names %s; check Code or the filename", ErrCodeConflict, code, fileCode)
	}
	for _, raw := range scene.URLs {
		if postURL := lbzPostURL([]string{raw}); postURL != "" {
			md, err := s.scrapePost(ctx, postURL, code)
			if !errors.Is(err, ErrNotFound) {
				return md, err
			}
		}
	}
	postURL, err := s.findPost(ctx, code)
	if err != nil {
		return Metadata{}, err
	}
	return s.scrapePost(ctx, postURL, code)
}

func (s *latinboyz) scrapePost(ctx context.Context, postURL, code string) (Metadata, error) {
	doc, err := s.client.Page(ctx, postURL, false)
	if err != nil {
		return Metadata{}, err
	}
	ret := lbzPost(doc)
	if ret.Title == "" {
		return Metadata{}, ErrNotFound
	}
	// A title that names nobody stays as the site wrote it.
	if names := lbzCleanTitle(ret.Title); names != "" {
		ret.Title = names
	}
	var codes []string
	if contents := findByClass(doc, "entry-content"); len(contents) > 0 {
		codes = lbzMediaCodes(contents[0])
	}
	if len(codes) > 1 || (len(codes) == 1 && code != "" && codes[0] != code) {
		return Metadata{}, fmt.Errorf("%w: Code %q, public page codes %s; check Code or URLs", ErrCodeConflict, code, strings.Join(codes, ", "))
	}
	if len(codes) == 1 {
		ret.Code = codes[0]
	}
	for _, link := range findAll(doc, "link") {
		if attr(link, "rel") == "canonical" {
			if canonical := lbzPostURL([]string{attr(link, "href")}); canonical != "" {
				postURL = canonical
			}
		}
	}
	ret.URLs = []string{postURL}
	return ret, nil
}

// findPost reads the complete public index once per run, including failures.
// A partial index must never turn an ambiguous code into a unique match.
func (s *latinboyz) findPost(ctx context.Context, code string) (string, error) {
	if code == "" || strings.Trim(code, "0123456789") != "" {
		return "", ErrNotFound
	}
	if !s.indexed {
		s.indexed = true
		s.indexErr = s.loadIndex(ctx)
	}
	if s.indexErr != nil {
		return "", s.indexErr
	}
	links := s.index[code]
	if len(links) > 1 {
		return "", fmt.Errorf("%w for code %s; add the correct public scene URL in Scenes > Edit > URLs", ErrAmbiguous, code)
	}
	if len(links) == 0 {
		return "", ErrNotFound
	}
	return links[0], nil
}

func (s *latinboyz) loadIndex(ctx context.Context) error {
	index := map[string][]string{}
	for page := 1; ; page++ {
		body, headers, err := s.client.body(ctx, fmt.Sprintf(lbzIndexURL, page), false)
		if err != nil {
			return fmt.Errorf("reading public post index page %d: %w", page, err)
		}
		var posts []struct {
			Link    string `json:"link"`
			Content struct {
				Rendered string `json:"rendered"`
			} `json:"content"`
		}
		if err := json.Unmarshal(body, &posts); err != nil {
			return fmt.Errorf("reading public post index page %d: %w", page, err)
		}
		for _, post := range posts {
			link := lbzPostURL([]string{post.Link})
			if link == "" {
				continue
			}
			doc, err := html.Parse(strings.NewReader(post.Content.Rendered))
			if err != nil {
				return err
			}
			for _, code := range lbzMediaCodes(doc) {
				if !slices.Contains(index[code], link) {
					index[code] = append(index[code], link)
				}
			}
		}
		pages, err := strconv.Atoi(headers.Get("X-WP-TotalPages"))
		if (err == nil && page >= pages) || (err != nil && len(posts) < 100) {
			break
		}
		if len(posts) == 0 {
			return errors.New("public post index ended before its last page")
		}
	}
	s.index = index
	return nil
}

// lbzMediaCodes reads codes only from actual image/video filenames, never
// arbitrary paragraph numbers, dates, dimensions, or related page links.
func lbzMediaCodes(doc *html.Node) []string {
	var codes []string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			for _, a := range n.Attr {
				switch a.Key {
				case "src", "href", "poster", "srcset", "data-src", "data-srcset":
				default:
					continue
				}
				for _, raw := range strings.FieldsFunc(a.Val, func(r rune) bool { return r == ',' || r == ' ' || r == '\n' || r == '\t' }) {
					u, err := url.Parse(raw)
					if err != nil {
						continue
					}
					if u.Host != "" && strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.") != lbzHost {
						continue
					}
					name := path.Base(u.Path)
					switch strings.ToLower(path.Ext(name)) {
					case ".jpg", ".jpeg", ".png", ".webp", ".mp4", ".wmv", ".mov", ".m4v", ".webm":
					default:
						continue
					}
					if m := lbzMediaCodeRE.FindStringSubmatch(name); m != nil && !slices.Contains(codes, m[1]) {
						codes = append(codes, m[1])
					}
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	slices.Sort(codes)
	return codes
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
		post := strings.Trim(u.Path, "/")
		if strings.TrimPrefix(strings.ToLower(u.Host), "www.") == lbzHost && u.User == nil && post != "" && !strings.Contains(post, "/") && post != "join" {
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
