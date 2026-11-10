package api

import (
	"context"
	"testing"
	"time"
)

func TestRemoteLoopSelectionCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	state := remoteTestStateCustom()
	state.LoopEnabled = true
	state.LoopRevision = "configuration-1"
	state.LoopSegments = []*RemoteLoopSegmentInput{{ID: "a", Start: 1, End: 2}, {ID: "b", Start: 3, End: 4}, {ID: "c", Start: 5, End: 6}}
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	commands := h.subscribeCommands(ctx, state.PlayerID)
	input := RemoteLoopSelectionInput{PlayerID: state.PlayerID, SessionID: state.SessionID, ExpectedSceneID: state.SceneID, LoopRevision: state.LoopRevision, SelectedSegmentIDs: []string{"a", "c"}}
	for _, ids := range [][]string{{"a", "c"}, {"b"}, {}} {
		input.SelectedSegmentIDs = ids
		if ok, err := h.selectSegments(input); !ok || err != nil {
			t.Fatalf("selection failed: %v", err)
		}
		command := remoteReceiveCustom(t, commands)
		if command.SelectedSegmentIDs == nil || len(command.SelectedSegmentIDs) != len(ids) || command.LoopRevision == nil {
			t.Fatal("selection lost, including empty clear command")
		}
		for i, id := range ids {
			if command.SelectedSegmentIDs[i] != id {
				t.Fatal("selection order changed")
			}
		}
		if _, err := h.validateRecord(RemotePlaybackORecordInput{CommandID: command.CommandID, PlayerID: state.PlayerID, SessionID: state.SessionID, SceneID: state.SceneID}); err == nil {
			t.Fatal("loop command could record O")
		}
	}
	if len(h.pending) != 0 || len(h.results) != 0 {
		t.Fatal("loop selection entered O receipt storage")
	}
	for _, change := range []func(*RemoteLoopSelectionInput){
		func(i *RemoteLoopSelectionInput) { i.SessionID = "other-session" },
		func(i *RemoteLoopSelectionInput) { i.ExpectedSceneID = "43" },
		func(i *RemoteLoopSelectionInput) { i.LoopRevision = "stale" },
		func(i *RemoteLoopSelectionInput) { i.SelectedSegmentIDs = []string{"missing"} },
		func(i *RemoteLoopSelectionInput) { i.SelectedSegmentIDs = []string{"a", "a"} },
	} {
		invalid := input
		change(&invalid)
		if _, err := h.selectSegments(invalid); err == nil {
			t.Fatal("invalid command accepted")
		}
	}
	state.LoopEnabled = false
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	if _, err := h.selectSegments(input); err == nil {
		t.Fatal("disabled loop accepted selection")
	}
	state.LoopEnabled = true
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	h.stateAt[state.PlayerID] = time.Now().Add(-10 * time.Second)
	if _, err := h.selectSegments(input); err == nil {
		t.Fatal("offline player accepted selection")
	}
}

func TestRemoteLoopStateCopiesCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	input := remoteTestStateCustom()
	input.LoopSegments = []*RemoteLoopSegmentInput{{ID: "a", Start: 1, End: 2}}
	input.SelectedSegmentIDs = []string{"a"}
	state, err := h.update(input)
	if err != nil {
		t.Fatal(err)
	}
	input.LoopSegments[0].ID = "changed"
	input.SelectedSegmentIDs[0] = "changed"
	state.LoopSegments[0].ID = "changed"
	state.SelectedSegmentIDs[0] = "changed"
	copy := h.state(input.PlayerID)
	if copy.LoopSegments[0].ID != "a" || copy.SelectedSegmentIDs[0] != "a" {
		t.Fatal("caller mutated hub state")
	}
}
