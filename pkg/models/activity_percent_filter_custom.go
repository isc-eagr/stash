package models

type ActivityPercentFilterInput struct {
	SexPercent  *IntCriterionInput `json:"sex_percent,omitempty"`
	OralPercent *IntCriterionInput `json:"oral_percent,omitempty"`
	SoloPercent *IntCriterionInput `json:"solo_percent,omitempty"`
}

type PerformerActivityPercentFilterInput struct {
	SexPercent        *IntCriterionInput `json:"sex_percent,omitempty"`
	OralPercent       *IntCriterionInput `json:"oral_percent,omitempty"`
	SoloPercent       *IntCriterionInput `json:"solo_percent,omitempty"`
	SexTopPercent     *IntCriterionInput `json:"sex_top_percent,omitempty"`
	SexBottomPercent  *IntCriterionInput `json:"sex_bottom_percent,omitempty"`
	OralTopPercent    *IntCriterionInput `json:"oral_top_percent,omitempty"`
	OralBottomPercent *IntCriterionInput `json:"oral_bottom_percent,omitempty"`
}
