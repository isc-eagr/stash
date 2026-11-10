// Package sitesync scrapes studio sites for the studio site sync task: sites
// that publish scenes as plain members-area folders (Bilatinmen, NakedPapis)
// and LatinBoyz, whose public posts hold everything the task fills.
package sitesync

// CUSTOM: Apache directory listing parser.

import (
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/html"
)

// IndexEntry is one file or folder of an Apache directory listing.
type IndexEntry struct {
	Name     string
	Modified time.Time // zero when the row shows no date
}

var indexDateRE = regexp.MustCompile(`\d{4}-\d{2}-\d{2} \d{2}:\d{2}`)

const indexDateLayout = "2006-01-02 15:04"

// ParseIndex reads an Apache autoindex page in table or <pre> layout. ok is
// false when the page is not a listing; the sites answer a missing folder with
// a 200 error page.
func ParseIndex(doc *html.Node) (entries []IndexEntry, ok bool) {
	if !strings.HasPrefix(strings.TrimSpace(nodeText(findFirst(doc, "h1"))), "Index of") {
		return nil, false
	}

	var current *IndexEntry
	var text strings.Builder
	flush := func() {
		if current == nil {
			return
		}
		if m := indexDateRE.FindString(text.String()); m != "" {
			current.Modified, _ = time.Parse(indexDateLayout, m)
		}
		entries = append(entries, *current)
		current = nil
	}

	// A row's date follows its link in document order in both layouts.
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "a" {
			if name := indexEntryName(attr(n, "href"), nodeText(n)); name != "" {
				flush()
				current = &IndexEntry{Name: name}
				text.Reset()
				return
			}
		}
		if n.Type == html.TextNode && current != nil {
			text.WriteString(n.Data)
			text.WriteByte(' ')
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	flush()
	return entries, true
}

// indexEntryName returns the decoded name an href points to, or "" for sort
// links and the parent folder. Listings link entries relatively; a saved copy
// links them absolutely, so an absolute link counts only when its text is the
// name it points to.
func indexEntryName(href, text string) string {
	if strings.Contains(href, "://") {
		u, err := url.Parse(href)
		if err != nil || u.RawQuery != "" {
			return ""
		}
		name := path.Base(strings.TrimSuffix(u.Path, "/"))
		if name != strings.TrimSuffix(text, "/") {
			return ""
		}
		return name
	}
	if href == "" || strings.ContainsAny(href[:1], "?/#") || strings.HasPrefix(href, "..") {
		return ""
	}
	name, err := url.PathUnescape(strings.TrimSuffix(href, "/"))
	if err != nil {
		return ""
	}
	return name
}

// EarliestDate returns the oldest modification date in the listing as
// YYYY-MM-DD, or "" when no row has a date.
func EarliestDate(entries []IndexEntry) string {
	var earliest time.Time
	for _, e := range entries {
		if !e.Modified.IsZero() && (earliest.IsZero() || e.Modified.Before(earliest)) {
			earliest = e.Modified
		}
	}
	if earliest.IsZero() {
		return ""
	}
	return earliest.Format("2006-01-02")
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func findFirst(n *html.Node, tag string) *html.Node {
	if n.Type == html.ElementNode && n.Data == tag {
		return n
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if found := findFirst(c, tag); found != nil {
			return found
		}
	}
	return nil
}

// findAll returns the tag elements in document order.
func findAll(n *html.Node, tag string) []*html.Node {
	var ret []*html.Node
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == tag {
			ret = append(ret, n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return ret
}

// findByClass returns elements carrying class, in document order.
func findByClass(n *html.Node, class string) []*html.Node {
	var ret []*html.Node
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			for _, c := range strings.Fields(attr(n, "class")) {
				if c == class {
					ret = append(ret, n)
					break
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return ret
}

// nodeText returns n's text with whitespace collapsed.
func nodeText(n *html.Node) string {
	if n == nil {
		return ""
	}
	var b strings.Builder
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			b.WriteString(n.Data)
			b.WriteByte(' ')
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return strings.Join(strings.Fields(b.String()), " ")
}

// inlineText returns n's text as a reader sees it, with whitespace collapsed:
// unlike nodeText, inline elements such as links add no spaces.
func inlineText(n *html.Node) string {
	var b strings.Builder
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		switch {
		case n.Type == html.TextNode:
			b.WriteString(n.Data)
		case n.Type == html.ElementNode && n.Data == "br":
			b.WriteByte(' ')
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return strings.Join(strings.Fields(b.String()), " ")
}
