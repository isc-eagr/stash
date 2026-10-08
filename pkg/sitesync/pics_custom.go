package sitesync

// CUSTOM: Members pictures download.

import (
	"context"
	"errors"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
)

// stagingSuffix marks a pictures folder whose download has not finished.
const stagingSuffix = ".part"

// PicsDir is where code's images live under picsPath.
func PicsDir(site PicsSite, picsPath, code string) string {
	return filepath.Join(picsPath, site.PicsFolder(code))
}

// FoldersByCode maps each code to the folders under picsPath named with it,
// in name order.
func FoldersByCode(site FolderCoder, picsPath string) (map[string][]string, error) {
	entries, err := os.ReadDir(picsPath)
	if err != nil {
		return nil, err
	}
	ret := map[string][]string{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if code := site.FolderCode(e.Name()); code != "" {
			ret[code] = append(ret[code], filepath.Join(picsPath, e.Name()))
		}
	}
	return ret, nil
}

// DownloadPics fetches code's images into PicsDir unless that folder already
// exists, and reports whether it created the folder. Files go to a staging
// folder renamed into place only after every image arrived, so an existing
// folder always holds a complete download and an interrupted one resumes.
// An empty folder, left by an older downloader that failed, is retried.
func DownloadPics(ctx context.Context, site PicsSite, picsPath, code string) (bool, error) {
	dir := PicsDir(site, picsPath, code)
	empty := false
	if entries, err := os.ReadDir(dir); err == nil {
		if len(entries) > 0 {
			return false, nil
		}
		empty = true
	} else if !errors.Is(err, fs.ErrNotExist) {
		return false, err
	}

	folderURL, names, err := site.Pics(ctx, code)
	if err != nil {
		return false, err
	}
	if len(names) == 0 {
		return false, ErrNotFound
	}

	staging := dir + stagingSuffix
	if err := os.MkdirAll(staging, 0o755); err != nil {
		return false, err
	}
	for _, name := range names {
		dest := filepath.Join(staging, name)
		if _, err := os.Stat(dest); err == nil {
			continue
		}
		if err := site.Client().Download(ctx, folderURL+url.PathEscape(name), dest, true); err != nil {
			return false, err
		}
	}
	if empty {
		if err := os.Remove(dir); err != nil {
			return false, err
		}
	}
	if err := os.Rename(staging, dir); err != nil {
		return false, err
	}
	return true, nil
}
