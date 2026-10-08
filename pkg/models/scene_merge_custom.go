package models

// SceneMergeOptionsCustom holds the merge dialog's choices for fork-owned
// scene data.
type SceneMergeOptionsCustom struct {
	IncludeOHistory bool
	// Rows to keep from the destination and sources. Nil keeps every row
	// except exact duplicates.
	NegativeMarkerIDs []int
	LoopPresetIDs     []int
	// Scene whose value the destination keeps. Nil uses the default choice.
	RatingSceneID         *int
	StashDBMatchesSceneID *int
}
