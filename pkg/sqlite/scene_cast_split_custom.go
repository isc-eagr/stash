package sqlite

import (
	"context"
	"fmt"
	"strings"
)

const scenePerformerCountsChunkCustom = 500

// ScenePerformerCountsCustom returns the vato count of each scene, as the
// scene performer_count filter counts it. Scenes without vatos are left out.
func ScenePerformerCountsCustom(ctx context.Context, sceneIDs []int) (map[int]int, error) {
	ret := make(map[int]int, len(sceneIDs))
	for start := 0; start < len(sceneIDs); start += scenePerformerCountsChunkCustom {
		chunk := sceneIDs[start:min(start+scenePerformerCountsChunkCustom, len(sceneIDs))]
		args := make([]interface{}, len(chunk))
		for i, id := range chunk {
			args[i] = id
		}
		query := fmt.Sprintf(
			"SELECT %[1]s, COUNT(DISTINCT %[2]s) AS count FROM %[3]s WHERE %[1]s IN (%[4]s) GROUP BY %[1]s",
			sceneIDColumn, performerIDColumn, performersScenesTable,
			strings.TrimSuffix(strings.Repeat("?,", len(chunk)), ","),
		)
		var rows []struct {
			SceneID int `db:"scene_id"`
			Count   int `db:"count"`
		}
		if err := dbWrapper.Select(ctx, &rows, query, args...); err != nil {
			return nil, fmt.Errorf("counting scene vatos: %w", err)
		}
		for _, row := range rows {
			ret[row.SceneID] = row.Count
		}
	}
	return ret, nil
}
