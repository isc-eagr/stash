package sqlite

import (
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestEffectiveSceneDateSQLCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE scenes(id INTEGER PRIMARY KEY, date TEXT);
CREATE TABLE scene_releases(scene_id INTEGER, date TEXT);
INSERT INTO scenes VALUES (1, NULL), (2, '2025-01-01'), (3, NULL), (4, '9999-12-31');
INSERT INTO scene_releases VALUES (2, '2024-06-01'), (3, '2023-04-01'), (4, NULL);`); err != nil {
		t.Fatal(err)
	}
	query := fmt.Sprintf("SELECT %s FROM scenes WHERE id = ?", EffectiveSceneDateSQLCustom("scenes"))
	for _, tc := range []struct {
		id   int
		date sql.NullString
	}{
		{1, sql.NullString{}},
		{2, sql.NullString{String: "2024-06-01", Valid: true}},
		{3, sql.NullString{String: "2023-04-01", Valid: true}},
		{4, sql.NullString{String: "9999-12-31", Valid: true}},
	} {
		var got sql.NullString
		if err := db.QueryRow(query, tc.id).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != tc.date {
			t.Errorf("scene %d date = %+v, want %+v", tc.id, got, tc.date)
		}
	}
}
