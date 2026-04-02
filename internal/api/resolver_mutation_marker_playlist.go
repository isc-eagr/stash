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

func (r *mutationResolver) MarkerPlaylistUpdate(ctx context.Context, input MarkerPlaylistUpdateInput) (*MarkerPlaylist, error) {
	var playlist *MarkerPlaylist

	err := r.withTxn(ctx, func(ctx context.Context) error {
		updates := []string{}
		args := []interface{}{}

		if input.Name != nil {
			updates = append(updates, "name = ?")
			args = append(args, *input.Name)
		}

		if input.MarkerIds != nil {
			markerIDsJSON, err := json.Marshal(input.MarkerIds)
			if err != nil {
				return fmt.Errorf("marshaling marker IDs: %w", err)
			}
			updates = append(updates, "marker_ids = ?")
			args = append(args, string(markerIDsJSON))
		}

		if len(updates) == 0 {
			return nil // Nothing to update
		}

		updates = append(updates, "updated_at = CURRENT_TIMESTAMP")
		args = append(args, input.ID)

		query := fmt.Sprintf("UPDATE marker_playlists SET %s WHERE id = ?",
			updates[0])
		for i := 1; i < len(updates); i++ {
			query = fmt.Sprintf("%s, %s", query, updates[i])
		}

		_, err := sqlite.DBWrapper.Exec(ctx, query, args...)
		if err != nil {
			return err
		}

		// Read the updated playlist within the same transaction
		var row markerPlaylistRow
		getQuery := `SELECT id, name, marker_ids, created_at, updated_at FROM marker_playlists WHERE id = ?`
		if err := sqlite.DBWrapper.Get(ctx, &row, getQuery, input.ID); err != nil {
			return err
		}

		playlist = &MarkerPlaylist{
			ID:        input.ID,
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
