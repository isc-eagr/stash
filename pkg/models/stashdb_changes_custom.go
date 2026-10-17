package models

// CUSTOM: StashDB Changes compares linked scenes and performers with StashDB.

import "time"

type StashDBChangesKindCustom string

const (
	StashDBChangesKindSceneCustom     StashDBChangesKindCustom = "scene"
	StashDBChangesKindPerformerCustom StashDBChangesKindCustom = "performer"
)

type StashDBChangeStatusCustom string

const (
	StashDBChangeStatusChangedCustom  StashDBChangeStatusCustom = "CHANGED"
	StashDBChangeStatusDeletedCustom  StashDBChangeStatusCustom = "DELETED"
	StashDBChangeStatusMergedCustom   StashDBChangeStatusCustom = "MERGED"
	StashDBChangeStatusNotFoundCustom StashDBChangeStatusCustom = "NOT_FOUND"
)

// StashDBChangesTargetCustom is a local scene or performer linked to StashDB.
type StashDBChangesTargetCustom struct {
	ID      int    `db:"id"`
	StashID string `db:"stash_id"`
}

// StashDBFieldChangeCustom is one field that differs from StashDB. Scalar
// fields set Local/Remote; list fields set Added (on StashDB, missing locally)
// and Removed (linked locally, no longer on StashDB).
type StashDBFieldChangeCustom struct {
	Field  string  `json:"field"`
	Local  *string `json:"local,omitempty"`
	Remote *string `json:"remote,omitempty"`
	// StashDB ID of the remote studio, used to apply it.
	RemoteID *string  `json:"remote_id,omitempty"`
	Added    []string `json:"added,omitempty"`
	// StashDB IDs of added performers and tags, in Added order. Reports saved
	// before IDs were stored have none.
	AddedIDs []string `json:"added_ids,omitempty"`
	Removed  []string `json:"removed,omitempty"`
}

type StashDBChangeCustom struct {
	ID      int
	StashID string
	Status  StashDBChangeStatusCustom
	// The StashDB ID now holding a merged entity.
	MergedIntoID *string
	Fields       []StashDBFieldChangeCustom
}

// StashDBChangesRunCustom is the latest check of one kind. Changes holds every
// entity that differs or is gone from StashDB; field exclusions apply on read.
type StashDBChangesRunCustom struct {
	Kind       StashDBChangesKindCustom
	StartedAt  time.Time
	FinishedAt time.Time
	Endpoint   string
	Checked    int
	Failed     int
	Cancelled  bool
	Changes    []StashDBChangeCustom
}
