package gevi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/antchfx/htmlquery"
	xhtml "golang.org/x/net/html"
)

const (
	DefaultBaseURL         = "https://gayeroticvideoindex.com/"
	DefaultCacheFileName   = "gevi_latest_custom.json"
	DefaultImageDirName    = "gevi_latest_images_custom"
	DefaultRetentionYears  = 2
	DefaultRefreshInterval = 6 * time.Hour
	maxImageBytes          = 20 << 20
)

type ItemKind string

const (
	ItemKindScene     ItemKind = "scene"
	ItemKindPerformer ItemKind = "performer"
)

type Item struct {
	Kind        ItemKind  `json:"kind"`
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Studio      string    `json:"studio,omitempty"`
	SourceLabel string    `json:"source_label,omitempty"`
	URL         string    `json:"url"`
	ImageURL    string    `json:"image_url"`
	ImagePath   string    `json:"image_path,omitempty"`
	ThumbURL    string    `json:"thumb_url,omitempty"`
	Performers  []string  `json:"performers,omitempty"`
	Date        string    `json:"date,omitempty"`
	FirstSeenAt time.Time `json:"first_seen_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
}

type Cache struct {
	UpdatedAt  time.Time `json:"updated_at"`
	Scenes     []Item    `json:"scenes"`
	Performers []Item    `json:"performers"`
	LastError  string    `json:"last_error,omitempty"`
}

type Client struct {
	BaseURL         string
	CachePath       string
	ImageDir        string
	HTTPClient      *http.Client
	RefreshInterval time.Duration
	RetentionYears  int
	MaxScenes       int
	MaxPerformers   int
	DetailDelay     time.Duration
	UserAgent       string
	Now             func() time.Time

	mu sync.Mutex
}

type imageDownloadStatusError struct {
	statusCode int
	imageURL   string
}

func (e *imageDownloadStatusError) Error() string {
	return fmt.Sprintf("unexpected status %d downloading %s", e.statusCode, e.imageURL)
}

func NewClient(cachePath string) *Client {
	imageDir := ""
	if cachePath != "" {
		imageDir = ImageDirPath(filepath.Dir(cachePath))
	}

	return &Client{
		BaseURL:         DefaultBaseURL,
		CachePath:       cachePath,
		ImageDir:        imageDir,
		HTTPClient:      &http.Client{Timeout: 20 * time.Second},
		RefreshInterval: DefaultRefreshInterval,
		RetentionYears:  DefaultRetentionYears,
		MaxScenes:       48,
		MaxPerformers:   48,
		DetailDelay:     150 * time.Millisecond,
		UserAgent:       "StashCustomGEVILatest/0.1 (+local personal use)",
		Now:             time.Now,
	}
}

func CachePath(baseDir string) string {
	return filepath.Join(baseDir, DefaultCacheFileName)
}

func ImageDirPath(baseDir string) string {
	return filepath.Join(baseDir, DefaultImageDirName)
}

func (c *Client) Latest(ctx context.Context, force bool) (*Cache, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	cached, cacheErr := c.readCache()
	if cacheErr != nil && !errors.Is(cacheErr, os.ErrNotExist) {
		return nil, cacheErr
	}

	if cached != nil {
		changed := c.prune(cached, now)
		imagesChanged, err := c.ensureLocalImages(ctx, cached)
		if err != nil {
			cached.LastError = err.Error()
			changed = true
		} else if cached.LastError != "" {
			cached.LastError = ""
			changed = true
		}
		changed = changed || imagesChanged
		if changed {
			if err := c.writeCache(cached); err != nil {
				return nil, err
			}
			if err := c.cleanupLocalImages(cached); err != nil {
				return nil, err
			}
		}
		if !force && now.Sub(cached.UpdatedAt) < c.RefreshInterval {
			return cached, nil
		}
	}

	refreshed, err := c.refreshLocked(ctx, cached, now)
	if err != nil {
		if cached != nil {
			cached.LastError = err.Error()
			return cached, nil
		}
		return nil, err
	}

	return refreshed, nil
}

func (c *Client) Refresh(ctx context.Context) (*Cache, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	cached, err := c.readCache()
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	return c.refreshLocked(ctx, cached, now)
}

func (c *Client) refreshLocked(ctx context.Context, existing *Cache, now time.Time) (*Cache, error) {
	fetched, err := c.fetch(ctx, now)
	if err != nil {
		return nil, err
	}

	merged := mergeCaches(existing, fetched, now)
	c.prune(merged, now)
	if _, err := c.ensureLocalImages(ctx, merged); err != nil {
		merged.LastError = err.Error()
	}
	sortItems(merged.Scenes)
	sortItems(merged.Performers)

	if err := c.writeCache(merged); err != nil {
		return nil, err
	}
	if err := c.cleanupLocalImages(merged); err != nil {
		return nil, err
	}

	return merged, nil
}

func (c *Client) fetch(ctx context.Context, now time.Time) (*Cache, error) {
	episodesHTML, err := c.fetchString(ctx, "newe")
	if err != nil {
		return nil, fmt.Errorf("fetching GEVI scenes: %w", err)
	}

	performersHTML, err := c.fetchString(ctx, "newp")
	if err != nil {
		return nil, fmt.Errorf("fetching GEVI performers: %w", err)
	}

	scenes, err := c.ParseScenes(episodesHTML, now)
	if err != nil {
		return nil, fmt.Errorf("parsing GEVI scenes: %w", err)
	}

	performers, err := c.ParsePerformers(performersHTML, now)
	if err != nil {
		return nil, fmt.Errorf("parsing GEVI performers: %w", err)
	}

	if c.MaxScenes > 0 && len(scenes) > c.MaxScenes {
		scenes = scenes[:c.MaxScenes]
	}
	if c.MaxPerformers > 0 && len(performers) > c.MaxPerformers {
		performers = performers[:c.MaxPerformers]
	}

	for i := range scenes {
		if i > 0 && c.DetailDelay > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(c.DetailDelay):
			}
		}

		detailHTML, err := c.fetchString(ctx, "episode/"+scenes[i].ID)
		if err != nil {
			continue
		}

		detail := c.ParseSceneDetail(scenes[i].ID, detailHTML)
		if detail.Date != "" {
			scenes[i].Date = detail.Date
		}
		if detail.ImageURL != "" {
			scenes[i].ImageURL = detail.ImageURL
		}
	}

	return &Cache{
		UpdatedAt:  now,
		Scenes:     scenes,
		Performers: performers,
	}, nil
}

func (c *Client) fetchString(ctx context.Context, path string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.absoluteURL(path), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", c.UserAgent)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("unexpected status %d from %s", resp.StatusCode, req.URL.String())
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (c *Client) ParseScenes(pageHTML string, now time.Time) ([]Item, error) {
	doc, err := htmlquery.Parse(strings.NewReader(pageHTML))
	if err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	var ret []Item
	for _, anchor := range htmlquery.Find(doc, "//a[starts-with(@href, 'episode/')]") {
		title := normalizeText(htmlquery.InnerText(anchor))
		if title == "" {
			continue
		}

		href := attr(anchor, "href")
		id := strings.TrimPrefix(href, "episode/")
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true

		container := nearestAncestorWithClass(anchor, "flex-grow")
		studio := ""
		thumbURL := ""
		var performers []string
		if container != nil {
			studio = firstMeaningfulDivText(container, title)
			if imgNode := htmlquery.FindOne(container, ".//img[contains(@src, 'Episodes')]"); imgNode != nil {
				thumbURL = c.absoluteURL(attr(imgNode, "src"))
			}
			for _, span := range htmlquery.Find(container, ".//span[contains(@class, 'whitespace-nowrap')]") {
				performer := normalizeText(htmlquery.InnerText(span))
				if performer != "" && performer != title {
					performers = appendUnique(performers, performer)
				}
			}
		}

		if thumbURL == "" {
			thumbURL = c.absoluteURL("images/Episodes/episode" + id + ".jpg")
		}

		ret = append(ret, Item{
			Kind:        ItemKindScene,
			ID:          id,
			Title:       title,
			Studio:      studio,
			URL:         c.absoluteURL(href),
			ImageURL:    thumbURL,
			ThumbURL:    thumbURL,
			Performers:  performers,
			FirstSeenAt: now,
			LastSeenAt:  now,
		})
	}

	return ret, nil
}

func (c *Client) ParsePerformers(pageHTML string, now time.Time) ([]Item, error) {
	doc, err := htmlquery.Parse(strings.NewReader(pageHTML))
	if err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	var ret []Item
	for _, anchor := range htmlquery.Find(doc, "//a[starts-with(@href, 'performer/')]") {
		name := normalizeText(htmlquery.InnerText(anchor))
		if name == "" {
			continue
		}

		href := attr(anchor, "href")
		id := strings.TrimPrefix(href, "performer/")
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true

		container := nearestAncestorWithClass(anchor, "w-52")
		imageURL := ""
		sourceLabel := ""
		if container != nil {
			if imgNode := htmlquery.FindOne(container, ".//img[starts-with(@src, 'revenue/') or starts-with(@src, '/revenue/')]"); imgNode != nil {
				imageURL = c.absoluteURL(attr(imgNode, "src"))
			}
			if sourceNode := htmlquery.FindOne(container, ".//a[starts-with(normalize-space(.), '@')]"); sourceNode != nil {
				sourceLabel = strings.TrimPrefix(normalizeText(htmlquery.InnerText(sourceNode)), "@ ")
			}
		}

		if imageURL == "" {
			continue
		}

		ret = append(ret, Item{
			Kind:        ItemKindPerformer,
			ID:          id,
			Title:       name,
			SourceLabel: sourceLabel,
			URL:         c.absoluteURL(href),
			ImageURL:    imageURL,
			FirstSeenAt: now,
			LastSeenAt:  now,
		})
	}

	return ret, nil
}

func (c *Client) ParseSceneDetail(id string, detailHTML string) Item {
	ret := Item{Kind: ItemKindScene, ID: id}

	dateMatch := regexp.MustCompile(`(?i)Date:\s*</span>\s*([0-9]{4}-[0-9]{2}-[0-9]{2})`).FindStringSubmatch(detailHTML)
	if len(dateMatch) == 2 {
		ret.Date = dateMatch[1]
	}

	doc, err := htmlquery.Parse(strings.NewReader(detailHTML))
	if err != nil {
		return ret
	}

	imageSrc := ""
	if node := htmlquery.FindOne(doc, fmt.Sprintf("//img[contains(@src, 'episode%sb.jpg')]", id)); node != nil {
		imageSrc = attr(node, "src")
	} else if node := htmlquery.FindOne(doc, "//img[contains(@class, 'hidden') and contains(@class, 'md:block')]"); node != nil {
		imageSrc = attr(node, "src")
	}

	if imageSrc != "" {
		ret.ImageURL = c.absoluteURL(imageSrc)
	}

	return ret
}

func mergeCaches(existing *Cache, fetched *Cache, now time.Time) *Cache {
	ret := &Cache{
		UpdatedAt:  fetched.UpdatedAt,
		Scenes:     mergeItems(existingItems(existing, ItemKindScene), fetched.Scenes, now),
		Performers: mergeItems(existingItems(existing, ItemKindPerformer), fetched.Performers, now),
	}
	return ret
}

func mergeItems(existing []Item, fetched []Item, now time.Time) []Item {
	byID := make(map[string]Item, len(existing))
	for _, item := range existing {
		byID[item.ID] = item
	}

	seen := make(map[string]bool, len(fetched))
	ret := make([]Item, 0, len(existing)+len(fetched))
	for _, item := range fetched {
		if old, ok := byID[item.ID]; ok {
			item.FirstSeenAt = old.FirstSeenAt
			if old.ImageURL == item.ImageURL && old.ImagePath != "" {
				item.ImagePath = old.ImagePath
			}
		}
		item.LastSeenAt = now
		seen[item.ID] = true
		ret = append(ret, item)
	}

	for _, item := range existing {
		if seen[item.ID] {
			continue
		}
		ret = append(ret, item)
	}

	return ret
}

func existingItems(existing *Cache, kind ItemKind) []Item {
	if existing == nil {
		return nil
	}
	if kind == ItemKindScene {
		return existing.Scenes
	}
	return existing.Performers
}

func (c *Client) prune(cache *Cache, now time.Time) bool {
	retentionYears := c.RetentionYears
	if retentionYears <= 0 {
		retentionYears = DefaultRetentionYears
	}
	cutoff := now.AddDate(-retentionYears, 0, 0)
	scenes := pruneItems(cache.Scenes, cutoff)
	performers := pruneItems(cache.Performers, cutoff)
	changed := len(scenes) != len(cache.Scenes) || len(performers) != len(cache.Performers)
	cache.Scenes = scenes
	cache.Performers = performers
	return changed
}

func pruneItems(items []Item, cutoff time.Time) []Item {
	ret := items[:0]
	for _, item := range items {
		if itemRetentionTime(item).Before(cutoff) {
			continue
		}
		ret = append(ret, item)
	}
	return ret
}

func sortItems(items []Item) {
	sort.SliceStable(items, func(i, j int) bool {
		return itemRetentionTime(items[i]).After(itemRetentionTime(items[j]))
	})
}

func itemRetentionTime(item Item) time.Time {
	if item.Date != "" {
		if parsed, err := time.Parse("2006-01-02", item.Date); err == nil {
			return parsed
		}
	}
	if !item.FirstSeenAt.IsZero() {
		return item.FirstSeenAt
	}
	return item.LastSeenAt
}

func (c *Client) readCache() (*Cache, error) {
	if c.CachePath == "" {
		return &Cache{}, nil
	}

	f, err := os.Open(c.CachePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var ret Cache
	if err := json.NewDecoder(f).Decode(&ret); err != nil {
		return nil, fmt.Errorf("reading GEVI cache: %w", err)
	}
	return &ret, nil
}

func (c *Client) writeCache(cache *Cache) error {
	if c.CachePath == "" {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(c.CachePath), 0755); err != nil {
		return err
	}

	tmpPath := c.CachePath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(cache); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}

	return os.Rename(tmpPath, c.CachePath)
}

func (c *Client) ensureLocalImages(ctx context.Context, cache *Cache) (bool, error) {
	if c.ImageDir == "" {
		return false, nil
	}
	if err := os.MkdirAll(c.ImageDir, 0755); err != nil {
		return false, err
	}

	changed := false
	var firstErr error
	for i := range cache.Scenes {
		itemChanged, err := c.ensureLocalImage(ctx, &cache.Scenes[i])
		changed = changed || itemChanged
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}
	for i := range cache.Performers {
		itemChanged, err := c.ensureLocalImage(ctx, &cache.Performers[i])
		changed = changed || itemChanged
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}

	return changed, firstErr
}

func (c *Client) ensureLocalImage(ctx context.Context, item *Item) (bool, error) {
	if item.ImageURL == "" {
		return false, nil
	}

	if item.ImagePath != "" {
		if _, err := os.Stat(c.LocalImagePath(item.ImagePath)); err == nil {
			return false, nil
		}
	}

	imagePath := localImageFileName(*item)
	fullPath := c.LocalImagePath(imagePath)
	if _, err := os.Stat(fullPath); err == nil {
		item.ImagePath = imagePath
		return true, nil
	}

	if err := c.downloadImage(ctx, item.ImageURL, fullPath); err != nil {
		var statusErr *imageDownloadStatusError
		if errors.As(err, &statusErr) && statusErr.statusCode == http.StatusNotFound {
			item.ImageURL = ""
			item.ImagePath = ""
			return true, nil
		}
		return false, err
	}

	item.ImagePath = imagePath
	return true, nil
}

func (c *Client) downloadImage(ctx context.Context, imageURL string, destination string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", c.UserAgent)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &imageDownloadStatusError{statusCode: resp.StatusCode, imageURL: imageURL}
	}
	if contentType := resp.Header.Get("Content-Type"); contentType != "" && !strings.HasPrefix(contentType, "image/") {
		return fmt.Errorf("unexpected content type %q downloading %s", contentType, imageURL)
	}

	tmpPath := destination + ".tmp"
	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	_, copyErr := io.Copy(out, io.LimitReader(resp.Body, maxImageBytes+1))
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(tmpPath)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return closeErr
	}

	if info, err := os.Stat(tmpPath); err == nil && info.Size() > maxImageBytes {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("image too large downloading %s", imageURL)
	}

	return os.Rename(tmpPath, destination)
}

func (c *Client) cleanupLocalImages(cache *Cache) error {
	if c.ImageDir == "" {
		return nil
	}

	entries, err := os.ReadDir(c.ImageDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	keep := make(map[string]bool)
	for _, item := range cache.Scenes {
		if item.ImagePath != "" {
			keep[item.ImagePath] = true
		}
	}
	for _, item := range cache.Performers {
		if item.ImagePath != "" {
			keep[item.ImagePath] = true
		}
	}

	for _, entry := range entries {
		if entry.IsDir() || keep[entry.Name()] {
			continue
		}
		if err := os.Remove(filepath.Join(c.ImageDir, entry.Name())); err != nil {
			return err
		}
	}

	return nil
}

func (c *Client) LocalImagePath(imagePath string) string {
	return filepath.Join(c.ImageDir, filepath.Base(imagePath))
}

func localImageFileName(item Item) string {
	ext := imageExtension(item.ImageURL)
	return sanitizeImageFilePart(string(item.Kind)) + "_" + sanitizeImageFilePart(item.ID) + ext
}

func imageExtension(imageURL string) string {
	if parsed, err := url.Parse(imageURL); err == nil {
		if ext := strings.ToLower(path.Ext(parsed.Path)); isAllowedImageExtension(ext) {
			return ext
		}
	}

	return ".jpg"
}

func isAllowedImageExtension(ext string) bool {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	default:
		return false
	}
}

func sanitizeImageFilePart(value string) string {
	var builder strings.Builder
	for _, r := range value {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			builder.WriteRune(r)
		}
	}
	if builder.Len() == 0 {
		return "item"
	}
	return builder.String()
}

func (c *Client) absoluteURL(raw string) string {
	baseURL := c.BaseURL
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}

	base, err := url.Parse(baseURL)
	if err != nil {
		return raw
	}
	ref, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	return base.ResolveReference(ref).String()
}

func (c *Client) now() time.Time {
	if c.Now != nil {
		return c.Now().UTC()
	}
	return time.Now().UTC()
}

func attr(node *xhtml.Node, name string) string {
	for _, attr := range node.Attr {
		if attr.Key == name {
			return attr.Val
		}
	}
	return ""
}

func nearestAncestorWithClass(node *xhtml.Node, className string) *xhtml.Node {
	for parent := node.Parent; parent != nil; parent = parent.Parent {
		if parent.Type == xhtml.ElementNode && parent.Data == "div" && hasClass(parent, className) {
			return parent
		}
	}
	return nil
}

func hasClass(node *xhtml.Node, className string) bool {
	for _, part := range strings.Fields(attr(node, "class")) {
		if part == className {
			return true
		}
	}
	return false
}

func firstMeaningfulDivText(container *xhtml.Node, skip string) string {
	for child := container.FirstChild; child != nil; child = child.NextSibling {
		if child.Type != xhtml.ElementNode || child.Data != "div" {
			continue
		}
		text := normalizeText(htmlquery.InnerText(child))
		if text != "" && text != skip && !strings.Contains(text, skip) {
			return text
		}
	}
	return ""
}

func normalizeText(value string) string {
	value = html.UnescapeString(value)
	return strings.Join(strings.Fields(value), " ")
}

func appendUnique(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}
