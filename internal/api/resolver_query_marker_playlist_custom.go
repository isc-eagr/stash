package api

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/stashapp/stash/pkg/sqlite"
	"github.com/stashapp/stash/pkg/utils"
)

// MarkerPlaylist represents a saved marker playlist
type MarkerPlaylist struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	MarkerIDs []string  `json:"marker_ids"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type markerPlaylistRow struct {
	ID            int    `db:"id"`
	Name          string `db:"name"`
	MarkerIDsJSON string `db:"marker_ids"`
	CreatedAt     string `db:"created_at"`
	UpdatedAt     string `db:"updated_at"`
}

func (r *queryResolver) FindMarkerPlaylist(ctx context.Context, id string) (*MarkerPlaylist, error) {
	var row markerPlaylistRow
	var playlist *MarkerPlaylist

	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		query := `SELECT id, name, marker_ids, created_at, updated_at FROM marker_playlists WHERE id = ?`
		if err := sqlite.DBWrapper.Get(ctx, &row, query, id); err != nil {
			return err
		}

		playlist = &MarkerPlaylist{
			ID:        strconv.Itoa(row.ID),
			Name:      row.Name,
			MarkerIDs: []string{}, // Initialize empty array to avoid null
		}

		playlist.CreatedAt, _ = utils.ParseDateStringAsTime(row.CreatedAt)
		playlist.UpdatedAt, _ = utils.ParseDateStringAsTime(row.UpdatedAt)

		// Parse marker IDs from JSON
		if row.MarkerIDsJSON != "" {
			if err := json.Unmarshal([]byte(row.MarkerIDsJSON), &playlist.MarkerIDs); err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return playlist, nil
}

func (r *queryResolver) FindMarkerPlaylists(ctx context.Context) ([]*MarkerPlaylist, error) {
	var rows []markerPlaylistRow
	playlists := make([]*MarkerPlaylist, 0) // Initialize as empty slice, not nil

	err := r.withReadTxn(ctx, func(ctx context.Context) error {
		query := `SELECT id, name, marker_ids, created_at, updated_at FROM marker_playlists ORDER BY created_at DESC`
		if err := sqlite.DBWrapper.Select(ctx, &rows, query); err != nil {
			return err
		}

		for _, row := range rows {
			playlist := &MarkerPlaylist{
				ID:        strconv.Itoa(row.ID),
				Name:      row.Name,
				MarkerIDs: []string{}, // Initialize empty array to avoid null
			}

			playlist.CreatedAt, _ = utils.ParseDateStringAsTime(row.CreatedAt)
			playlist.UpdatedAt, _ = utils.ParseDateStringAsTime(row.UpdatedAt)

			// Parse marker IDs from JSON
			if row.MarkerIDsJSON != "" {
				if err := json.Unmarshal([]byte(row.MarkerIDsJSON), &playlist.MarkerIDs); err != nil {
					return err
				}
			}

			playlists = append(playlists, playlist)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return playlists, nil
}
