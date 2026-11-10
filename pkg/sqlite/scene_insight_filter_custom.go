package sqlite

import (
	"context"
	"encoding/json"
)

// One JSON parameter keeps large coverage snapshots below SQLite's bind limit.
func insightSceneIDsCriterionHandler(ids []string) criterionHandlerFunc {
	return func(_ context.Context, f *filterBuilder) {
		if ids == nil {
			return
		}
		encoded, _ := json.Marshal(ids)
		f.addWhere("scenes.id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))", string(encoded))
	}
}
