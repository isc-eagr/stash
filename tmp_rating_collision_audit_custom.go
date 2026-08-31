package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type collision struct {
	SceneID      int    `json:"scene_id"`
	SharedID     int    `json:"shared_numeric_id"`
	LeftSection  string `json:"left_section"`
	LeftKey      string `json:"left_key"`
	RightSection string `json:"right_section"`
	RightKey     string `json:"right_key"`
}

type report struct {
	SelfCollisionSceneCount int         `json:"self_collision_scene_count"`
	SelfCollisionPairCount  int         `json:"self_collision_pair_count"`
	GoatCollisionSceneCount int         `json:"goat_collision_scene_count"`
	AtRiskSceneCount        int         `json:"cross_entity_at_risk_scene_count"`
	SelfCollisionSceneIDs   []int       `json:"self_collision_scene_ids"`
	GoatCollisionSceneIDs   []int       `json:"goat_collision_scene_ids"`
	Collisions              []collision `json:"self_collisions"`
}

const allScores = `
	SELECT id, entity_type, entity_id, 'criterion' AS section, key FROM rating_criteria_scores
	UNION ALL
	SELECT id, entity_type, entity_id, 'bonus' AS section, key FROM rating_bonus_scores
	UNION ALL
	SELECT id, entity_type, entity_id, 'penalty' AS section, key FROM rating_penalty_scores
`

func main() {
	db, err := sql.Open("sqlite3", "file:C:/Users/ing_e/.stash/stash-go.sqlite?mode=ro&_busy_timeout=5000")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query(`
		WITH scores AS (` + allScores + `)
		SELECT a.entity_id, a.id, a.section, a.key, b.section, b.key
		FROM scores a
		JOIN scores b
		  ON b.id = a.id
		 AND b.entity_type = a.entity_type
		 AND b.entity_id = a.entity_id
		 AND b.section > a.section
		WHERE a.entity_type = 'scene'
		ORDER BY a.entity_id, a.id, a.section, b.section
	`)
	if err != nil {
		log.Fatal(err)
	}

	selfScenes := map[int]struct{}{}
	goatScenes := map[int]struct{}{}
	var collisions []collision
	for rows.Next() {
		var item collision
		if err := rows.Scan(&item.SceneID, &item.SharedID, &item.LeftSection, &item.LeftKey, &item.RightSection, &item.RightKey); err != nil {
			log.Fatal(err)
		}
		collisions = append(collisions, item)
		selfScenes[item.SceneID] = struct{}{}
		if item.LeftKey == "goatElement" || item.RightKey == "goatElement" {
			goatScenes[item.SceneID] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		log.Fatal(err)
	}

	var atRiskCount int
	err = db.QueryRow(`
		WITH scores AS (` + allScores + `)
		SELECT COUNT(DISTINCT a.entity_id)
		FROM scores a
		WHERE a.entity_type = 'scene'
		  AND EXISTS (
			SELECT 1 FROM scores b
			WHERE b.id = a.id AND b.section <> a.section
		  )
	`).Scan(&atRiskCount)
	if err != nil {
		log.Fatal(err)
	}

	toSortedIDs := func(values map[int]struct{}) []int {
		ret := make([]int, 0, len(values))
		for value := range values {
			ret = append(ret, value)
		}
		sort.Ints(ret)
		return ret
	}

	result := report{
		SelfCollisionSceneCount: len(selfScenes),
		SelfCollisionPairCount:  len(collisions),
		GoatCollisionSceneCount: len(goatScenes),
		AtRiskSceneCount:        atRiskCount,
		SelfCollisionSceneIDs:   toSortedIDs(selfScenes),
		GoatCollisionSceneIDs:   toSortedIDs(goatScenes),
		Collisions:              collisions,
	}

	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(strings.TrimSpace(string(encoded)))
}
