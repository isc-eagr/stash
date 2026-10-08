package sitesync

// CUSTOM: NakedPapis. Local file names rarely carry the code, so codes come
// from the members video index, which links every download as
// /members/<kind>videos/videofiles1/papi<code>/<file>.

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strings"

	"golang.org/x/net/html"
)

const (
	npIndexURL    = "https://nakedpapis.com/members/%svideos/videos.html"
	npVideoDirURL = "https://nakedpapis.com/members/%svideos/videofiles1/papi%s/"
	npPicsURL     = "https://nakedpapis.com/members/%spics/pictures01/papi%s/"
)

// Public scene pages; older scenes live directly in nude-latin-men.
var npPublicURLs = []string{
	"https://nakedpapis.com/nude-latin-men/papi%[1]s/latino_men_%[1]s.html",
	"https://nakedpapis.com/nude-latin-men/latino_men_%[1]s.html",
}

// Members areas, most common first.
var npKinds = []string{"sex", "solo"}

var (
	npCodeRE       = regexp.MustCompile(`(?i)papi(\d+)`)
	npPublicCodeRE = regexp.MustCompile(`(?i)latino_men_(\d+)`)
	npVideoLinkRE  = regexp.MustCompile(`(?i)/members/(sex|solo)videos/videofiles1/papi(\d+)/([^/]+\.(?:mp4|m4v|mov|wmv|avi|mkv))$`)
	npFolderCodeRE = regexp.MustCompile(`(?i)(?:^|/)videofiles1/papi(\d+)/`)
	copySuffixRE   = regexp.MustCompile(`\s*\(\d+\)$`)
	// Multi-part file names: "<name>1-high", "<name>part2", "<name>-part1".
	qualitySuffixRE = regexp.MustCompile(`-(?:high|medium|low)$`)
	partSuffixRE    = regexp.MustCompile(`(?:-?part)?\d+$`)
	// Site notes after a name: "(part 2 of 2)" in the index, "NO PICTURES"
	// on scenes without a pictures set.
	nameNoteRE = regexp.MustCompile(`(?i)\s*(?:\((?:part\s*)?\d+\s*of\s*\d+\)?|no pictures)\s*$`)
)

type nakedPapis struct {
	client *Client
	kinds  map[string]string // code -> members area, once known
	names  map[string]string // code -> model name from the members index
}

func (s *nakedPapis) Name() string    { return "NakedPapis" }
func (s *nakedPapis) Client() *Client { return s.client }

func (s *nakedPapis) SceneCode(scene Scene) string {
	if m := npCodeRE.FindStringSubmatch(scene.Basename); m != nil {
		return m[1]
	}
	for _, u := range scene.URLs {
		re := npPublicCodeRE
		if strings.Contains(u, "/members/") {
			re = npCodeRE
		}
		if m := re.FindStringSubmatch(u); m != nil {
			return m[1]
		}
	}
	return ""
}

func (s *nakedPapis) Scrape(ctx context.Context, code string, _ Scene) (Metadata, error) {
	for _, kind := range s.kindOrder(code) {
		dirURL := fmt.Sprintf(npVideoDirURL, kind, code)
		doc, err := s.client.Page(ctx, dirURL+"?C=M;O=A", true)
		if errors.Is(err, ErrNotFound) {
			continue
		}
		if err != nil {
			return Metadata{}, err
		}
		entries, ok := ParseIndex(doc)
		if !ok {
			continue
		}
		s.kinds[code] = kind

		ret := Metadata{Date: EarliestDate(entries)}
		for _, pattern := range npPublicURLs {
			publicURL := fmt.Sprintf(pattern, code)
			if _, err := s.client.Page(ctx, publicURL, false); err == nil {
				ret.URLs = append(ret.URLs, publicURL)
				break
			}
		}
		if page := scenePageEntry(entries); page != "" {
			membersURL := dirURL + url.PathEscape(page)
			doc, err := s.client.Page(ctx, membersURL, true)
			switch {
			case err == nil:
				ret.Title, ret.Details = npScenePage(doc)
			case !errors.Is(err, ErrNotFound):
				return ret, err
			}
			ret.URLs = append(ret.URLs, membersURL)
		}
		// Older scenes have no scene page; the index still names them.
		if ret.Title == "" {
			ret.Title = s.indexName(ctx, code)
		}
		return ret, nil
	}
	return Metadata{}, ErrNotFound
}

// indexName returns the model name the members index shows for code, reading
// the index pages once per run.
func (s *nakedPapis) indexName(ctx context.Context, code string) string {
	if s.names == nil {
		s.names = map[string]string{}
		for _, kind := range npKinds {
			if doc, err := s.client.Page(ctx, fmt.Sprintf(npIndexURL, kind), true); err == nil {
				maps.Copy(s.names, npIndexNames(doc))
			}
		}
	}
	return s.names[code]
}

func (s *nakedPapis) PicsFolder(code string) string { return "papi" + code }

func (s *nakedPapis) Pics(ctx context.Context, code string) (string, []string, error) {
	for _, kind := range s.kindOrder(code) {
		folderURL := fmt.Sprintf(npPicsURL, kind, code)
		doc, err := s.client.Page(ctx, folderURL, true)
		if errors.Is(err, ErrNotFound) {
			continue
		}
		if err != nil {
			return "", nil, err
		}
		if entries, ok := ParseIndex(doc); ok {
			return folderURL, picNames(entries, "papi"), nil
		}
	}
	return "", nil, ErrNotFound
}

// kindOrder tries the members area the code is known to be in first.
func (s *nakedPapis) kindOrder(code string) []string {
	if known := s.kinds[code]; known != "" {
		ret := []string{known}
		for _, k := range npKinds {
			if k != known {
				ret = append(ret, k)
			}
		}
		return ret
	}
	return npKinds
}

type npVideoLink struct {
	kind string
	code string
	url  string
}

// ResolveCodes matches scenes to the members index by file name. Older scenes
// are split into numbered part files, so a name with no exact match may match
// the parts of a multi-part scene with the part numbers removed. A name the
// site uses for several codes is settled by an exact file size match; codes
// in taken already belong to other scenes and are never offered again.
func (s *nakedPapis) ResolveCodes(ctx context.Context, scenes []Scene, taken map[string]bool) (Resolution, error) {
	byStem := map[string][]npVideoLink{}
	byJoined := map[string][]npVideoLink{}
	parts := map[string]map[string]bool{} // code -> distinct part file names
	for _, kind := range npKinds {
		indexURL := fmt.Sprintf(npIndexURL, kind)
		doc, err := s.client.Page(ctx, indexURL, true)
		if err != nil {
			return Resolution{}, fmt.Errorf("reading the %s videos index: %w", kind, err)
		}
		for _, link := range npVideoLinks(doc, indexURL) {
			stem := fileStem(path.Base(link.url))
			byStem[stem] = append(byStem[stem], link)
			if joined, part, ok := joinedStem(stem); ok {
				byJoined[joined] = append(byJoined[joined], link)
				if parts[link.code] == nil {
					parts[link.code] = map[string]bool{}
				}
				parts[link.code][part] = true
			}
		}
	}

	ret := Resolution{Codes: map[int]string{}, Ambiguous: map[int][]string{}, Taken: map[int][]string{}}
	sceneStems := map[string][]Scene{}
	for _, scene := range scenes {
		stem := fileStem(scene.Basename)
		sceneStems[stem] = append(sceneStems[stem], scene)
	}
	stems := make([]string, 0, len(sceneStems))
	for stem := range sceneStems {
		stems = append(stems, stem)
	}
	sort.Strings(stems)

	for _, stem := range stems {
		local := sceneStems[stem]
		candidates := byStem[stem]
		if len(candidates) == 0 {
			for _, link := range byJoined[stem] {
				if len(parts[link.code]) > 1 {
					candidates = append(candidates, link)
				}
			}
		}
		links := openLinks(candidates, taken)
		if len(links) == 0 {
			for _, scene := range local {
				if len(candidates) == 0 {
					ret.Unmatched = append(ret.Unmatched, scene.ID)
					continue
				}
				for _, link := range openLinks(candidates, nil) {
					ret.Taken[scene.ID] = append(ret.Taken[scene.ID], link.code)
				}
			}
			continue
		}
		if len(local) == 1 && len(links) == 1 {
			s.assign(&ret, local[0].ID, links[0])
			continue
		}

		matched, err := s.matchBySize(ctx, local, links)
		if err != nil {
			return Resolution{}, err
		}
		for _, scene := range local {
			if link, ok := matched[scene.ID]; ok {
				s.assign(&ret, scene.ID, link)
				continue
			}
			for _, link := range links {
				ret.Ambiguous[scene.ID] = append(ret.Ambiguous[scene.ID], link.code)
			}
		}
	}
	sort.Ints(ret.Unmatched)
	return ret, nil
}

func (s *nakedPapis) assign(ret *Resolution, sceneID int, link npVideoLink) {
	ret.Codes[sceneID] = link.code
	s.kinds[link.code] = link.kind
}

// matchBySize pairs a scene with a link only when exactly one link has the
// scene's exact byte size and no other scene has that size too.
func (s *nakedPapis) matchBySize(ctx context.Context, local []Scene, links []npVideoLink) (map[int]npVideoLink, error) {
	sizes := make([]int64, len(links))
	for i, link := range links {
		size, err := s.client.Size(ctx, link.url, true)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return nil, err
		}
		sizes[i] = size
	}

	ret := map[int]npVideoLink{}
	for _, scene := range local {
		var match []int
		for i, size := range sizes {
			if size > 0 && size == scene.Size {
				match = append(match, i)
			}
		}
		if len(match) != 1 {
			continue
		}
		sameSize := 0
		for _, other := range local {
			if other.Size == scene.Size {
				sameSize++
			}
		}
		if sameSize == 1 {
			ret[scene.ID] = links[match[0]]
		}
	}
	return ret, nil
}

// openLinks drops links to taken codes and repeats of the same code.
func openLinks(links []npVideoLink, taken map[string]bool) []npVideoLink {
	var ret []npVideoLink
	seen := map[string]bool{}
	for _, link := range links {
		if taken[link.code] || seen[link.code] {
			continue
		}
		seen[link.code] = true
		ret = append(ret, link)
	}
	return ret
}

// npVideoLinks collects every members video download linked from doc.
func npVideoLinks(doc *html.Node, pageURL string) []npVideoLink {
	base, err := url.Parse(pageURL)
	if err != nil {
		return nil
	}
	var ret []npVideoLink
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			for _, a := range n.Attr {
				ref, err := url.Parse(strings.TrimSpace(a.Val))
				if err != nil || a.Val == "" {
					continue
				}
				abs := base.ResolveReference(ref)
				abs.RawQuery, abs.Fragment = "", ""
				p, err := url.PathUnescape(abs.EscapedPath())
				if err != nil {
					continue
				}
				if m := npVideoLinkRE.FindStringSubmatch(p); m != nil {
					ret = append(ret, npVideoLink{kind: strings.ToLower(m[1]), code: m[2], url: abs.String()})
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return ret
}

// npIndexNames maps codes to the model names in the members index. Scenes
// sit in columns: a row of names followed by a row whose cells each hold one
// scene's links in a nested table.
func npIndexNames(doc *html.Node) map[string]string {
	ret := map[string]string{}
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "tr" {
			if prev := previousElement(n); prev != nil && prev.Data == "tr" {
				cells, names := rowCells(n), rowCells(prev)
				if len(cells) == len(names) {
					for i, cell := range cells {
						code := singleFolderCode(cell)
						if code == "" || findFirst(cell, "table") == nil || findFirst(names[i], "table") != nil {
							continue
						}
						if name := nameNoteRE.ReplaceAllString(nodeText(names[i]), ""); name != "" {
							ret[code] = name
						}
					}
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return ret
}

// singleFolderCode returns the code all of n's members video links point to,
// or "" when they point to none or several.
func singleFolderCode(n *html.Node) string {
	code := ""
	var walk func(n *html.Node) bool
	walk = func(n *html.Node) bool {
		if n.Type == html.ElementNode && n.Data == "a" {
			if m := npFolderCodeRE.FindStringSubmatch(attr(n, "href")); m != nil {
				if code != "" && code != m[1] {
					return false
				}
				code = m[1]
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if !walk(c) {
				return false
			}
		}
		return true
	}
	if !walk(n) {
		return ""
	}
	return code
}

func previousElement(n *html.Node) *html.Node {
	for p := n.PrevSibling; p != nil; p = p.PrevSibling {
		if p.Type == html.ElementNode {
			return p
		}
	}
	return nil
}

func rowCells(tr *html.Node) []*html.Node {
	var ret []*html.Node
	for c := tr.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode && (c.Data == "td" || c.Data == "th") {
			ret = append(ret, c)
		}
	}
	return ret
}

// npScenePage reads a members scene page: the title is the first "name"
// element and the details the first non-empty "text" element.
func npScenePage(doc *html.Node) (title, details string) {
	if names := findByClass(doc, "name"); len(names) > 0 {
		title = nameNoteRE.ReplaceAllString(nodeText(names[0]), "")
	}
	for _, n := range findByClass(doc, "text") {
		if details = nodeText(n); details != "" {
			break
		}
	}
	return title, details
}

// scenePageEntry picks the members scene page, preferring the high quality one.
func scenePageEntry(entries []IndexEntry) string {
	first := ""
	for _, e := range entries {
		lower := strings.ToLower(e.Name)
		if !strings.HasSuffix(lower, ".html") {
			continue
		}
		if strings.HasSuffix(lower, "-high.html") {
			return e.Name
		}
		if first == "" {
			first = e.Name
		}
	}
	return first
}

// joinedStem removes a quality suffix and a trailing part number, so
// "polaco-pablo1-high" and "negro&omarpart2" become "polaco-pablo" and
// "negro&omar". part is the name without the quality suffix; ok is false when
// there is no part number.
func joinedStem(stem string) (joined, part string, ok bool) {
	part = qualitySuffixRE.ReplaceAllString(stem, "")
	joined = strings.TrimRight(partSuffixRE.ReplaceAllString(part, ""), "-")
	return joined, part, joined != part && joined != ""
}

// fileStem lowercases a file name and drops its extension and any Windows
// copy suffix such as " (2)".
func fileStem(name string) string {
	stem := strings.ToLower(strings.TrimSpace(name))
	stem = strings.TrimSuffix(stem, path.Ext(stem))
	return strings.TrimSpace(copySuffixRE.ReplaceAllString(stem, ""))
}
