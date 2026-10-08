package sitesync

// CUSTOM: HTTP access to the studio sites.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"golang.org/x/net/html"
)

var (
	ErrNotFound     = errors.New("not found on the site")
	ErrUnauthorized = errors.New("members area refused the credentials")
)

const (
	userAgent      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
	requestTimeout = 2 * time.Minute
)

// Client fetches pages one at a time with a pause between requests and keeps
// parsed pages for the run, so a listing read for metadata is not fetched
// again for downloads.
type Client struct {
	http     *http.Client
	username string
	password string
	delay    time.Duration

	mu      sync.Mutex
	last    time.Time
	pages   map[string]*html.Node
	refused bool
}

func NewClient(username, password string, delay time.Duration) *Client {
	return &Client{
		http:     &http.Client{Timeout: requestTimeout},
		username: username,
		password: password,
		delay:    delay,
		pages:    map[string]*html.Node{},
	}
}

func (c *Client) HasCredentials() bool {
	return c.username != "" && c.password != ""
}

// MembersUnavailable reports whether members requests fail without being
// sent: no credentials are configured, or the site already refused them.
func (c *Client) MembersUnavailable() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.refused || !c.HasCredentials()
}

// Page returns the parsed page at url. members sends the credentials; once
// they are missing or refused it fails with ErrUnauthorized and sends nothing.
func (c *Client) Page(ctx context.Context, url string, members bool) (*html.Node, error) {
	c.mu.Lock()
	doc, cached := c.pages[url]
	c.mu.Unlock()
	if cached {
		return doc, nil
	}

	resp, err := c.get(ctx, url, members)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err = html.Parse(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("parsing %s: %w", url, err)
	}
	c.mu.Lock()
	c.pages[url] = doc
	c.mu.Unlock()
	return doc, nil
}

// Body returns the content at url, read whole.
func (c *Client) Body(ctx context.Context, url string, members bool) ([]byte, error) {
	resp, err := c.get(ctx, url, members)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", url, err)
	}
	return data, nil
}

// Size returns the byte size the site reports for url, or -1 when unknown.
func (c *Client) Size(ctx context.Context, url string, members bool) (int64, error) {
	resp, err := c.request(ctx, http.MethodHead, url, members)
	if err != nil {
		return -1, err
	}
	resp.Body.Close()
	return resp.ContentLength, nil
}

// Download saves url to dest through a temporary file, so an interrupted
// download never leaves a truncated file at dest.
func (c *Client) Download(ctx context.Context, url, dest string, members bool) error {
	resp, err := c.get(ctx, url, members)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	tmp := dest + ".part"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, resp.Body)
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		os.Remove(tmp)
		return fmt.Errorf("downloading %s: %w", url, err)
	}
	return os.Rename(tmp, dest)
}

func (c *Client) get(ctx context.Context, url string, members bool) (*http.Response, error) {
	return c.request(ctx, http.MethodGet, url, members)
}

func (c *Client) request(ctx context.Context, method, url string, members bool) (*http.Response, error) {
	if members && c.MembersUnavailable() {
		return nil, ErrUnauthorized
	}
	if err := c.wait(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	if members {
		req.SetBasicAuth(c.username, c.password)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		resp.Body.Close()
		c.mu.Lock()
		c.refused = true
		c.mu.Unlock()
		return nil, ErrUnauthorized
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden:
		resp.Body.Close()
		return nil, ErrNotFound
	case resp.StatusCode >= 300:
		resp.Body.Close()
		return nil, fmt.Errorf("%s returned %s", url, resp.Status)
	}
	return resp, nil
}

// wait spaces requests by the client's delay.
func (c *Client) wait(ctx context.Context) error {
	c.mu.Lock()
	next := c.last.Add(c.delay)
	now := time.Now()
	if next.Before(now) {
		next = now
	}
	c.last = next
	c.mu.Unlock()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(time.Until(next)):
		return nil
	}
}
