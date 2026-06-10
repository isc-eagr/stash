package models

// CUSTOM: begin - rating criteria filters
type RatingScoreCriterionFilterInput struct {
	Key   string               `json:"key"`
	Value *FloatCriterionInput `json:"value"`
}

type RatingScorePresenceFilterInput struct {
	Key   string `json:"key"`
	Value bool   `json:"value"`
}

type RatingCriteriaFilterInput struct {
	Criteria  []*RatingScoreCriterionFilterInput `json:"criteria"`
	Bonuses   []*RatingScorePresenceFilterInput  `json:"bonuses"`
	Penalties []*RatingScorePresenceFilterInput  `json:"penalties"`
}

// CUSTOM: end
