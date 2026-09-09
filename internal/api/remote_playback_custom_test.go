package api

// CUSTOM: Regression coverage for pairing, player ownership and remote O receipts.

import (
	"context"
	"math"
	"strconv"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
)

func remoteTestStateCustom() RemotePlaybackStateInput {
	return RemotePlaybackStateInput{PlayerID: "player-0123456789", SessionID: "session-0123456789", SceneID: "42", SceneTitle: "Test scene", VideoTimestamp: 12, Duration: 120, PlaybackRate: 1, Status: "playing"}
}

func remoteTestRequestCustom(h *remotePlaybackHubCustom, state RemotePlaybackStateInput) RemotePlaybackORequestInput {
	return RemotePlaybackORequestInput{CommandID: h.serverID + "_" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "_command-0123456789", PlayerID: state.PlayerID, SessionID: state.SessionID, ExpectedSceneID: state.SceneID}
}

func remoteTestRecordCustom(request RemotePlaybackORequestInput) RemotePlaybackORecordInput {
	return RemotePlaybackORecordInput{CommandID: request.CommandID, PlayerID: request.PlayerID, SessionID: request.SessionID, SceneID: request.ExpectedSceneID, VideoTimestamp: 13.25}
}

func remoteReceiveCustom[T any](t *testing.T, ch <-chan T) T {
	t.Helper()
	select {
	case value, ok := <-ch:
		if !ok {
			t.Fatal("subscription closed unexpectedly")
		}
		return value
	case <-time.After(time.Second):
		t.Fatal("subscription did not deliver")
		var zero T
		return zero
	}
}

func TestRemotePlaybackPairingCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	player := remoteTestStateCustom().PlayerID
	token, err := h.createPairing(player)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := h.redeemPairing(token); err != nil || got != player {
		t.Fatalf("redeem = %q, %v", got, err)
	}
	if _, err := h.redeemPairing(token); err == nil {
		t.Fatal("pairing token was reusable")
	}
	old, err := h.createPairing(player)
	if err != nil {
		t.Fatal(err)
	}
	token, err = h.createPairing(player)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := h.redeemPairing(old); err == nil {
		t.Fatal("replacement left previous token valid")
	}
	h.pairings[token] = remotePairingCustom{playerID: player, expires: time.Now().Add(-time.Second)}
	if _, err := h.redeemPairing(token); err == nil {
		t.Fatal("expired pairing was accepted")
	}
}

func TestRemotePlaybackRestartRejectsOldRequestCustom(t *testing.T) {
	previous := newRemotePlaybackHubCustom()
	restarted := newRemotePlaybackHubCustom()
	state := remoteTestStateCustom()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	restarted.subscribeCommands(ctx, state.PlayerID)
	if _, err := restarted.update(state); err != nil {
		t.Fatal(err)
	}
	if _, err := restarted.request(remoteTestRequestCustom(previous, state)); err == nil {
		t.Fatal("request from previous process could be recorded again")
	}
	if _, err := restarted.request(remoteTestRequestCustom(restarted, state)); err != nil {
		t.Fatal(err)
	}
}

func TestRemotePlaybackEvictedReceiptCannotBecomeNewTapCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	state := remoteTestStateCustom()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	h.subscribeCommands(ctx, state.PlayerID)
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	request := remoteTestRequestCustom(h, state)
	request.CommandID = h.serverID + "_" + strconv.FormatInt(time.Now().Add(-25*time.Hour).UnixMilli(), 10) + "_old-command"
	if _, err := h.request(request); err == nil {
		t.Fatal("an old command without a receipt was accepted as a new tap")
	}
}

func TestRemotePlaybackOwnershipCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	state := remoteTestStateCustom()
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	other := state
	other.SessionID = "another-session-012345"
	if _, err := h.update(other); err == nil {
		t.Fatal("competing session took ownership")
	}
	if h.disconnect(state.PlayerID, other.SessionID) {
		t.Fatal("non-owner disconnected player")
	}
	if h.state(state.PlayerID) == nil {
		t.Fatal("non-owner removed player state")
	}
	if !h.disconnect(state.PlayerID, state.SessionID) {
		t.Fatal("owner could not disconnect")
	}
	if _, err := h.update(other); err != nil {
		t.Fatal(err)
	}
	h.stateAt[state.PlayerID] = time.Now().Add(-remotePlaybackStateTTL - time.Second)
	if h.state(state.PlayerID) != nil {
		t.Fatal("stale state remained online")
	}
	if _, err := h.update(state); err != nil {
		t.Fatalf("stale ownership blocked a new session: %v", err)
	}
}

func TestRemotePlaybackStateValidationCustom(t *testing.T) {
	cases := map[string]func(*RemotePlaybackStateInput){
		"negative timestamp": func(s *RemotePlaybackStateInput) { s.VideoTimestamp = -1 },
		"NaN timestamp":      func(s *RemotePlaybackStateInput) { s.VideoTimestamp = math.NaN() },
		"infinite timestamp": func(s *RemotePlaybackStateInput) { s.VideoTimestamp = math.Inf(1) },
		"negative duration":  func(s *RemotePlaybackStateInput) { s.Duration = -1 },
		"infinite duration":  func(s *RemotePlaybackStateInput) { s.Duration = math.Inf(1) },
		"beyond duration":    func(s *RemotePlaybackStateInput) { s.VideoTimestamp = s.Duration + 2 },
		"zero rate":          func(s *RemotePlaybackStateInput) { s.PlaybackRate = 0 },
		"NaN rate":           func(s *RemotePlaybackStateInput) { s.PlaybackRate = math.NaN() },
		"unknown status":     func(s *RemotePlaybackStateInput) { s.Status = "seeking" },
		"missing scene":      func(s *RemotePlaybackStateInput) { s.SceneID = " " },
		"invalid player":     func(s *RemotePlaybackStateInput) { s.PlayerID = "invalid" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			state := remoteTestStateCustom()
			mutate(&state)
			if _, err := newRemotePlaybackHubCustom().update(state); err == nil {
				t.Fatal("invalid state accepted")
			}
		})
	}
}

func TestRemotePlaybackCommandAndReceiptCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	state := remoteTestStateCustom()
	commands := h.subscribeCommands(ctx, state.PlayerID)
	results := h.subscribeResults(ctx, state.PlayerID)
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	request := remoteTestRequestCustom(h, state)
	if _, err := h.request(request); err != nil {
		t.Fatal(err)
	}
	if got := remoteReceiveCustom(t, commands); got.CommandID != request.CommandID || got.ExpectedSceneID != state.SceneID {
		t.Fatalf("wrong command: %+v", got)
	}
	if _, err := h.request(request); err != nil {
		t.Fatalf("retry: %v", err)
	}
	select {
	case <-commands:
		t.Fatal("retry delivered duplicate pending command")
	default:
	}
	mismatch := request
	mismatch.ExpectedSceneID = "43"
	if _, err := h.request(mismatch); err == nil {
		t.Fatal("command ID reused for another scene")
	}
	record := remoteTestRecordCustom(request)
	if previous, err := h.validateRecord(record); err != nil || previous != nil {
		t.Fatalf("valid record: %+v, %v", previous, err)
	}
	wrong := record
	wrong.SessionID = "another-session-012345"
	if _, err := h.validateRecord(wrong); err == nil {
		t.Fatal("wrong session record accepted")
	}
	receipt := &RemotePlaybackOResult{CommandID: record.CommandID, PlayerID: record.PlayerID, SceneID: record.SceneID, VideoTimestamp: record.VideoTimestamp, Count: 3, RecordedAt: time.Now().Format(time.RFC3339Nano), sessionID: record.SessionID}
	h.complete(receipt)
	if got := remoteReceiveCustom(t, results); *got != *receipt {
		t.Fatalf("wrong receipt: %+v", got)
	}
	// A retry after scene changes must replay the original receipt, never write a second O.
	state.SceneID = "43"
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	if previous, err := h.validateRecord(record); err != nil || previous == nil || *previous != *receipt {
		t.Fatalf("record retry: %+v, %v", previous, err)
	}
	if _, err := h.validateRecord(wrong); err == nil {
		t.Fatal("receipt exposed to mismatching session")
	}
	if _, err := h.request(request); err != nil {
		t.Fatalf("request receipt replay: %v", err)
	}
	if got := remoteReceiveCustom(t, results); *got != *receipt {
		t.Fatalf("wrong replay: %+v", got)
	}
	if _, err := h.request(mismatch); err == nil {
		t.Fatal("completed command reused for another scene")
	}
}

func TestRemotePlaybackRejectUnavailableCustom(t *testing.T) {
	for _, unavailable := range []string{"offline", "stale", "buffering", "unready", "wrong session", "wrong scene", "not listening"} {
		t.Run(unavailable, func(t *testing.T) {
			h := newRemotePlaybackHubCustom()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			state := remoteTestStateCustom()
			request := remoteTestRequestCustom(h, state)
			if unavailable != "not listening" {
				h.subscribeCommands(ctx, state.PlayerID)
			}
			switch unavailable {
			case "buffering":
				state.Status = "buffering"
			case "unready":
				state.Duration = 0
			case "wrong session":
				request.SessionID = "another-session-012345"
			case "wrong scene":
				request.ExpectedSceneID = "43"
			}
			if unavailable != "offline" {
				if _, err := h.update(state); err != nil {
					t.Fatal(err)
				}
			}
			if unavailable == "stale" {
				h.stateAt[state.PlayerID] = time.Now().Add(-remotePlaybackStateTTL - time.Second)
			}
			if _, err := h.request(request); err == nil {
				t.Fatal("unavailable player accepted a command")
			}
		})
	}
}

func TestRemotePlaybackRejectRecordCustom(t *testing.T) {
	for _, invalid := range []string{"expired command", "stale player", "scene changed", "buffering", "unready", "negative", "NaN", "infinite", "beyond duration"} {
		t.Run(invalid, func(t *testing.T) {
			h := newRemotePlaybackHubCustom()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			state := remoteTestStateCustom()
			h.subscribeCommands(ctx, state.PlayerID)
			if _, err := h.update(state); err != nil {
				t.Fatal(err)
			}
			request := remoteTestRequestCustom(h, state)
			if _, err := h.request(request); err != nil {
				t.Fatal(err)
			}
			record := remoteTestRecordCustom(request)
			switch invalid {
			case "expired command":
				h.pending[request.CommandID].createdAt = time.Now().Add(-remotePlaybackCommandTTL - time.Second)
			case "stale player":
				h.stateAt[state.PlayerID] = time.Now().Add(-remotePlaybackStateTTL - time.Second)
			case "scene changed":
				state.SceneID = "43"
			case "buffering":
				state.Status = "buffering"
			case "unready":
				state.Duration = 0
			case "negative":
				record.VideoTimestamp = -1
			case "NaN":
				record.VideoTimestamp = math.NaN()
			case "infinite":
				record.VideoTimestamp = math.Inf(1)
			case "beyond duration":
				record.VideoTimestamp = state.Duration + 2
			}
			if invalid == "scene changed" || invalid == "buffering" || invalid == "unready" {
				if _, err := h.update(state); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := h.validateRecord(record); err == nil {
				t.Fatal("invalid record accepted")
			}
		})
	}
}

func TestRemotePlaybackCanceledSubscriptionsCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	ctx, cancel := context.WithCancel(context.Background())
	player := remoteTestStateCustom().PlayerID
	states := h.subscribeState(ctx, player)
	commands := h.subscribeCommands(ctx, player)
	results := h.subscribeResults(ctx, player)
	cancel()
	select {
	case _, ok := <-states:
		if ok {
			t.Fatal("state subscription remained open")
		}
	case <-time.After(time.Second):
		t.Fatal("state subscription did not close")
	}
	select {
	case _, ok := <-commands:
		if ok {
			t.Fatal("command subscription remained open")
		}
	case <-time.After(time.Second):
		t.Fatal("command subscription did not close")
	}
	select {
	case _, ok := <-results:
		if ok {
			t.Fatal("result subscription remained open")
		}
	case <-time.After(time.Second):
		t.Fatal("result subscription did not close")
	}
	h.mutex.Lock()
	defer h.mutex.Unlock()
	if len(h.stateSubscribers) != 0 || len(h.commandSubscribers) != 0 || len(h.resultSubscribers) != 0 {
		t.Fatal("canceled subscriber was retained")
	}
}

func TestRemotePlaybackExpiredRequestCannotRetryCustom(t *testing.T) {
	h := newRemotePlaybackHubCustom()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	state := remoteTestStateCustom()
	commands := h.subscribeCommands(ctx, state.PlayerID)
	if _, err := h.update(state); err != nil {
		t.Fatal(err)
	}
	request := remoteTestRequestCustom(h, state)
	if _, err := h.request(request); err != nil {
		t.Fatal(err)
	}
	remoteReceiveCustom(t, commands)
	h.pending[request.CommandID].createdAt = time.Now().Add(-remotePlaybackCommandTTL - time.Second)
	if _, err := h.request(request); err == nil {
		t.Fatal("expired retry could record a later timestamp")
	}
	select {
	case <-commands:
		t.Fatal("expired retry redelivered a command")
	default:
	}
}

func TestRemotePlaybackConcurrentRecordWritesOnceCustom(t *testing.T) {
	// Exercise the actual resolver transaction: simultaneous retries must share
	// one database mutation and its count-only result.
	originalHub := remotePlaybackHub
	remotePlaybackHub = newRemotePlaybackHubCustom()
	defer func() { remotePlaybackHub = originalHub }()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	state := remoteTestStateCustom()
	remotePlaybackHub.subscribeCommands(ctx, state.PlayerID)
	if _, err := remotePlaybackHub.update(state); err != nil {
		t.Fatal(err)
	}
	request := remoteTestRequestCustom(remotePlaybackHub, state)
	if _, err := remotePlaybackHub.request(request); err != nil {
		t.Fatal(err)
	}
	record := remoteTestRecordCustom(request)
	db := mocks.NewDatabase()
	db.Scene.On("GetOCount", mock.Anything, 42).Return(6, nil).Once()
	db.Scene.On("AddOAtVideoTimestamp", mock.Anything, 42, record.VideoTimestamp).
		Run(func(args mock.Arguments) {
			models.SetHistoryMutationResultCountCustom(args.Get(0).(context.Context), 7)
		}).Return([]time.Time(nil), nil).Once()
	db.RatingScore.On("AdjustRatingsForSceneOCountChangeCustom", mock.Anything, 42, 6, 7).Return(nil).Once()
	r := &mutationResolver{newResolver(db)}
	type outcome struct {
		result *RemotePlaybackOResult
		err    error
	}
	outcomes := make(chan outcome, 16)
	start := make(chan struct{})
	for i := 0; i < cap(outcomes); i++ {
		go func() {
			<-start
			result, err := r.RemotePlaybackRecordO(ctx, record)
			outcomes <- outcome{result, err}
		}()
	}
	close(start)
	var first *RemotePlaybackOResult
	for i := 0; i < cap(outcomes); i++ {
		got := remoteReceiveCustom(t, outcomes)
		if got.err != nil {
			t.Fatal(got.err)
		}
		if got.result == nil || got.result.Count != 7 || got.result.VideoTimestamp != record.VideoTimestamp {
			t.Fatalf("wrong persisted receipt: %+v", got.result)
		}
		if first == nil {
			first = got.result
		} else if *first != *got.result {
			t.Fatal("concurrent callers received different receipts")
		}
	}
	db.Scene.AssertExpectations(t)
	db.RatingScore.AssertExpectations(t)
}
