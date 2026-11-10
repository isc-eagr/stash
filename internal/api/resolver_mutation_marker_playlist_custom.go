package api

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/pkg/sqlite"
	"github.com/stashapp/stash/pkg/utils"
)

func (r *mutationResolver) MarkerPlaylistCreate(ctx context.Context, input MarkerPlaylistCreateInput) (*MarkerPlaylist, error) {
	// Convert marker IDs to JSON
	markerIDsJSON, err := json.Marshal(input.MarkerIds)
	if err != nil {
		return nil, fmt.Errorf("marshaling marker IDs: %w", err)
	}

	var playlist *MarkerPlaylist

	err = r.withTxn(ctx, func(ctx context.Context) error {
		query := `INSERT INTO marker_playlists (name, marker_ids, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
		result, err := sqlite.DBWrapper.Exec(ctx, query, input.Name, string(markerIDsJSON))
		if err != nil {
			return fmt.Errorf("creating marker playlist: %w", err)
		}

		playlistID, err := result.LastInsertId()
		if err != nil {
			return err
		}

		// Read the created playlist within the same transaction
		var row markerPlaylistRow
		getQuery := `SELECT id, name, marker_ids, created_at, updated_at FROM marker_playlists WHERE id = ?`
		if err := sqlite.DBWrapper.Get(ctx, &row, getQuery, playlistID); err != nil {
			return err
		}

		playlist = &MarkerPlaylist{
			ID:        strconv.FormatInt(playlistID, 10),
			Name:      row.Name,
			MarkerIDs: []string{},
		}

		playlist.CreatedAt, _ = utils.ParseDateStringAsTime(row.CreatedAt)
		playlist.UpdatedAt, _ = utils.ParseDateStringAsTime(row.UpdatedAt)

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

func (r *mutationResolver) MarkerPlaylistDestroy(ctx context.Context, id string) (bool, error) {
	err := r.withTxn(ctx, func(ctx context.Context) error {
		query := `DELETE FROM marker_playlists WHERE id = ?`
		_, err := sqlite.DBWrapper.Exec(ctx, query, id)
		return err
	})

	if err != nil {
		return false, err
	}

	return true, nil
}
