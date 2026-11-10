package sqlite

import "fmt"

// CUSTOM: Performer-list average scene rating sort. This expression mirrors
// the scene eligibility rules used by performerRatingAdvisorStats so the list
// order matches the Overall Scene Rating shown on performer details.
func performerSceneAverageRatingExprCustom() string {
	return `(
	SELECT AVG(performer_rating_scene.rating)
	FROM scenes performer_rating_scene
	JOIN performers_scenes performer_rating_link
		ON performer_rating_link.scene_id = performer_rating_scene.id
	WHERE performer_rating_link.performer_id = performers.id
		AND (
			EXISTS (
				SELECT 1 FROM rating_criteria_scores performer_rating_score
				WHERE performer_rating_score.entity_type = 'scene'
					AND performer_rating_score.entity_id = performer_rating_scene.id
					AND performer_rating_score.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability')
			)
			OR (
				(
					SELECT COUNT(DISTINCT performer_rating_ps.performer_id)
					FROM performers_scenes performer_rating_ps
					WHERE performer_rating_ps.scene_id = performer_rating_scene.id
				) BETWEEN 2 AND 3
				AND NOT EXISTS (
					SELECT 1 FROM rating_criteria_scores performer_rating_score
					WHERE performer_rating_score.entity_type = 'scene'
						AND performer_rating_score.entity_id = performer_rating_scene.id
						AND performer_rating_score.key IN ('soloPerformerAppeal', 'soloPerformance', 'soloUsability')
				)
				AND EXISTS (
					SELECT 1 FROM rating_criteria_scores performer_rating_score
					WHERE performer_rating_score.entity_type = 'scene'
						AND performer_rating_score.entity_id = performer_rating_scene.id
						AND performer_rating_score.key IN ('topAttractiveness', 'bottomAttractiveness', 'chemistry', 'payoff', 'standout')
				)
			)
			OR (
				(
					SELECT COUNT(DISTINCT performer_rating_ps.performer_id)
					FROM performers_scenes performer_rating_ps
					WHERE performer_rating_ps.scene_id = performer_rating_scene.id
				) >= 4
				AND EXISTS (
					SELECT 1 FROM rating_criteria_scores performer_rating_score
					WHERE performer_rating_score.entity_type = 'scene'
						AND performer_rating_score.entity_id = performer_rating_scene.id
						AND performer_rating_score.key IN ('groupTopAttractiveness', 'groupEnergy', 'groupPayoff', 'groupUsability')
				)
			)
		)
)`
}

func (qb *PerformerStore) sortBySceneAverageRatingCustom(direction string) string {
	return fmt.Sprintf(" ORDER BY %s %s", performerSceneAverageRatingExprCustom(), getSortDirection(direction))
}
