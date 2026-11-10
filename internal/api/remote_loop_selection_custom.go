package api

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// CUSTOM: Loop commands share the paired transport but never enter O recording.
type RemoteLoopSegment struct {
	ID    string  `json:"id"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Title string  `json:"title"`
}
type RemoteLoopSegmentInput = RemoteLoopSegment
type RemoteLoopSelectionInput struct {
	PlayerID           string   `json:"player_id"`
	SessionID          string   `json:"session_id"`
	ExpectedSceneID    string   `json:"expected_scene_id"`
	LoopRevision       string   `json:"loop_revision"`
	SelectedSegmentIDs []string `json:"selected_segment_ids"`
}

func (r *mutationResolver) RemotePlaybackSelectSegments(ctx context.Context, input RemoteLoopSelectionInput) (bool, error) {
	return remotePlaybackHub.selectSegments(input)
}

func (h *remotePlaybackHubCustom) selectSegments(input RemoteLoopSelectionInput) (bool, error) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.cleanupLocked(time.Now())
	state := h.states[input.PlayerID]
	if state == nil || state.SessionID != input.SessionID || state.SceneID != input.ExpectedSceneID {
		return false, errors.New("player changed or went offline; refresh and try again")
	}
	if !state.LoopEnabled || state.LoopRevision != input.LoopRevision {
		return false, errors.New("loop changed; refresh and try again")
	}
	valid := make(map[string]bool)
	for _, segment := range state.LoopSegments {
		valid[segment.ID] = true
	}
	selected := make([]string, 0, len(input.SelectedSegmentIDs))
	for _, id := range input.SelectedSegmentIDs {
		if !valid[id] {
			return false, errors.New("invalid or duplicate loop segment")
		}
		valid[id] = false
		selected = append(selected, id)
	}
	revision := input.LoopRevision
	command := &RemotePlaybackCommand{
		CommandID: fmt.Sprintf("loop-%d", time.Now().UnixNano()), PlayerID: input.PlayerID,
		SessionID: input.SessionID, ExpectedSceneID: input.ExpectedSceneID,
		SelectedSegmentIDs: selected, LoopRevision: &revision,
	}
	delivered := false
	for _, subscriber := range h.commandSubscribers[input.PlayerID] {
		select {
		case subscriber <- copyRemotePlaybackCommandCustom(command):
			delivered = true
		default:
		}
	}
	if !delivered {
		return false, errors.New("player is not listening or is busy")
	}
	return true, nil
}
