package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestStatsCohortScopesCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
CREATE TABLE studios(id INTEGER PRIMARY KEY, parent_id INTEGER);
CREATE TABLE scenes(id INTEGER PRIMARY KEY, studio_id INTEGER, created_at TEXT, date TEXT, rating INTEGER);
CREATE TABLE performers(id INTEGER PRIMARY KEY, rating INTEGER);
CREATE TABLE performers_scenes(scene_id INTEGER, performer_id INTEGER);
CREATE TABLE scenes_o_dates(scene_id INTEGER, o_date TEXT);
CREATE TABLE rating_criteria_scores(entity_type TEXT, entity_id INTEGER, section TEXT, key TEXT, raw_value REAL, weighted_value REAL);
CREATE TABLE rating_bonus_scores(entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL, weighted_value REAL);
CREATE TABLE rating_penalty_scores(entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL, weighted_value REAL);
CREATE TABLE tags(id INTEGER PRIMARY KEY);
CREATE TABLE tags_relations(parent_id INTEGER, child_id INTEGER);
CREATE TABLE scene_markers(id INTEGER PRIMARY KEY, scene_id INTEGER, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags(scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_marker_performers(scene_marker_id INTEGER, performer_id INTEGER, role TEXT);
INSERT INTO studios VALUES(1,NULL),(2,1),(3,NULL);
INSERT INTO scenes VALUES(10,1,'2025-01-01 12:00:00',NULL,90),(20,2,'2025-02-01 12:00:00',NULL,70),(30,3,'2025-03-01 12:00:00',NULL,50);
INSERT INTO performers VALUES(1,90),(2,60),(3,80);
INSERT INTO performers_scenes VALUES(10,1),(10,2),(20,2);
INSERT INTO rating_criteria_scores VALUES('performer',1,'criterion','face',4,40),('performer',2,'criterion','face',2,20),('performer',3,'criterion','face',3,30),('scene',10,'criterion','soloPerformance',3,30),('scene',20,'criterion','soloPerformance',2,20);
INSERT INTO tags VALUES(1),(9);
INSERT INTO scene_markers VALUES(100,10,1),(200,20,1),(300,30,1);
INSERT INTO scene_marker_performers VALUES(100,1,'top'),(100,2,'top');
`)
	require.NoError(t, err)
	tests := []struct {
		name   string
		cohort *StatsCohortInput
		studio *string
		dates  *StatsDateRangeInput
		want   []int
	}{
		{name: "nil preserves all", want: []int{10, 20, 30}},
		{name: "scene selection", cohort: &StatsCohortInput{SceneIds: []string{"20"}}, want: []int{20}},
		{name: "empty scene selection", cohort: &StatsCohortInput{SceneIds: []string{}}, want: []int{}},
		{name: "selected vato scenes", cohort: &StatsCohortInput{PerformerIds: []string{"1"}}, want: []int{10}},
		{name: "empty vato selection", cohort: &StatsCohortInput{PerformerIds: []string{}}, want: []int{}},
		{name: "both intersect", cohort: &StatsCohortInput{SceneIds: []string{"20"}, PerformerIds: []string{"1"}}, want: []int{}},
		{name: "studio intersection", studio: statsCohortStringCustom("3"), cohort: &StatsCohortInput{SceneIds: []string{"10", "30"}}, want: []int{30}},
		{name: "date intersection", dates: statsDateRangeInputCustom("2025-02-01", "", StatsDateFieldAdded), cohort: &StatsCohortInput{SceneIds: []string{"10", "20"}}, want: []int{20}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scope, args, _, err := sceneStatsInputScopeCustom(tt.studio, nil, tt.dates, tt.cohort)
			require.NoError(t, err)
			rows, err := db.Query(scope+" SELECT id FROM selected_scenes ORDER BY id", args...)
			require.NoError(t, err)
			defer rows.Close()
			got := []int{}
			for rows.Next() {
				var id int
				require.NoError(t, rows.Scan(&id))
				got = append(got, id)
			}
			require.NoError(t, rows.Err())
			require.Equal(t, tt.want, got)
		})
	}
	// Large cohorts use one bound JSON value instead of one parameter per ID.
	largeIDs := make([]string, 1500)
	for i := range largeIDs {
		largeIDs[i] = "10"
	}
	largeScope, largeArgs, _, err := sceneStatsInputScopeCustom(nil, nil, nil, &StatsCohortInput{SceneIds: largeIDs})
	require.NoError(t, err)
	var largeCount int
	require.NoError(t, db.QueryRow(largeScope+" SELECT COUNT(*) FROM selected_scenes", largeArgs...).Scan(&largeCount))
	require.Equal(t, 1, largeCount)
	// Counts keep their existing per-top unit but are limited to the selected scenes.
	cohort := &StatsCohortInput{SceneIds: []string{"10"}}
	scope, args, _, err := sceneStatsInputScopeCustom(nil, nil, nil, cohort)
	require.NoError(t, err)
	var nuts int
	require.NoError(t, db.QueryRow(statsWeightedMarkerCountScopedQueryCustom(scope), append(args, 1, 9)...).Scan(&nuts))
	require.Equal(t, 2, nuts)
	// A selected co-star must not pull the other vato into rating averages; zero-scene profiles remain eligible.
	for _, ids := range [][]string{{"1"}, {"3"}, {}} {
		cohort = &StatsCohortInput{PerformerIds: ids}
		scope, args, _, err = sceneStatsInputScopeCustom(nil, nil, nil, cohort)
		require.NoError(t, err)
		stats := ratingAdvisorTestStatsFromQueryCustom(t, db, scopedRatingAdvisorStatsQueryCustom(scope, cohort), args...)
		require.Equal(t, len(ids), stats.Performers.EntityCount)
	}
}

func statsCohortStringCustom(value string) *string { return &value }

func TestStatsCohortRejectsInvalidIDsCustom(t *testing.T) {
	for _, ids := range [][]string{{"0"}, {"-1"}, {"1) OR 1=1"}} {
		_, _, _, err := sceneStatsInputScopeCustom(nil, nil, nil, &StatsCohortInput{SceneIds: ids})
		require.Error(t, err)
	}
}
