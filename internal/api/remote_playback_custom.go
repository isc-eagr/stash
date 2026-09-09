package api

// CUSTOM: In-memory coordination for the paired mobile O remote. Playback
// sessions are deliberately ephemeral; the database remains the source of
// truth only for completed O records.

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	remotePlaybackStateTTL   = 5 * time.Second
	remotePlaybackCommandTTL = 30 * time.Second
)

type RemotePlaybackState struct {
	ServerID       string  `json:"server_id"`
	PlayerID       string  `json:"player_id"`
	SessionID      string  `json:"session_id"`
	SceneID        string  `json:"scene_id"`
	SceneTitle     string  `json:"scene_title"`
	VideoTimestamp float64 `json:"video_timestamp"`
	Duration       float64 `json:"duration"`
	PlaybackRate   float64 `json:"playback_rate"`
	Status         string  `json:"status"`
	UpdatedAt      string  `json:"updated_at"`
}

type RemotePlaybackStateInput struct {
	PlayerID       string  `json:"player_id"`
	SessionID      string  `json:"session_id"`
	SceneID        string  `json:"scene_id"`
	SceneTitle     string  `json:"scene_title"`
	VideoTimestamp float64 `json:"video_timestamp"`
	Duration       float64 `json:"duration"`
	PlaybackRate   float64 `json:"playback_rate"`
	Status         string  `json:"status"`
}

type RemotePlaybackORequestInput struct {
	CommandID       string `json:"command_id"`
	PlayerID        string `json:"player_id"`
	SessionID       string `json:"session_id"`
	ExpectedSceneID string `json:"expected_scene_id"`
}

type RemotePlaybackCommand struct {
	CommandID       string `json:"command_id"`
	PlayerID        string `json:"player_id"`
	SessionID       string `json:"session_id"`
	ExpectedSceneID string `json:"expected_scene_id"`
	createdAt       time.Time
}

type RemotePlaybackORecordInput struct {
	CommandID      string  `json:"command_id"`
	PlayerID       string  `json:"player_id"`
	SessionID      string  `json:"session_id"`
	SceneID        string  `json:"scene_id"`
	VideoTimestamp float64 `json:"video_timestamp"`
}

type RemotePlaybackOResult struct {
	CommandID      string  `json:"command_id"`
	PlayerID       string  `json:"player_id"`
	SceneID        string  `json:"scene_id"`
	VideoTimestamp float64 `json:"video_timestamp"`
	Count          int     `json:"count"`
	RecordedAt     string  `json:"recorded_at"`
	sessionID      string
}

type remotePairingCustom struct {
	playerID string
	expires  time.Time
}

type remotePlaybackHubCustom struct {
	serverID    string
	mutex       sync.Mutex
	recordMutex sync.Mutex // Serialize validation + database commit + receipt, including retries.
	pairings    map[string]remotePairingCustom

	states  map[string]*RemotePlaybackState
	stateAt map[string]time.Time
	pending map[string]*RemotePlaybackCommand
	results map[string]*RemotePlaybackOResult

	nextSubscriberID   uint64
	stateSubscribers   map[string]map[uint64]chan *RemotePlaybackState
	commandSubscribers map[string]map[uint64]chan *RemotePlaybackCommand
	resultSubscribers  map[string]map[uint64]chan *RemotePlaybackOResult
}

func newRemotePlaybackHubCustom() *remotePlaybackHubCustom {
	var serverBytes [16]byte
	if _, err := rand.Read(serverBytes[:]); err != nil {
		panic(fmt.Sprintf("remote playback identity: %v", err))
	}
	return &remotePlaybackHubCustom{
		serverID:           hex.EncodeToString(serverBytes[:]),
		pairings:           make(map[string]remotePairingCustom),
		states:             make(map[string]*RemotePlaybackState),
		stateAt:            make(map[string]time.Time),
		pending:            make(map[string]*RemotePlaybackCommand),
		results:            make(map[string]*RemotePlaybackOResult),
		stateSubscribers:   make(map[string]map[uint64]chan *RemotePlaybackState),
		commandSubscribers: make(map[string]map[uint64]chan *RemotePlaybackCommand),
		resultSubscribers:  make(map[string]map[uint64]chan *RemotePlaybackOResult),
	}
}

var remotePlaybackHub = newRemotePlaybackHubCustom()

func validateRemotePlaybackTokenCustom(label, value string) error {
	if len(value) < 16 || len(value) > 128 {
		return fmt.Errorf("%s must be between 16 and 128 characters", label)
	}
	for _, character := range value {
		if (character < 'a' || character > 'z') &&
			(character < 'A' || character > 'Z') &&
			(character < '0' || character > '9') &&
			character != '-' && character != '_' {
			return fmt.Errorf("%s contains an invalid character", label)
		}
	}
	return nil
}

func validateRemotePlaybackStateCustom(input RemotePlaybackStateInput) error {
	if err := validateRemotePlaybackTokenCustom("player ID", input.PlayerID); err != nil {
		return err
	}
	if err := validateRemotePlaybackTokenCustom("session ID", input.SessionID); err != nil {
		return err
	}
	if strings.TrimSpace(input.SceneID) == "" {
		return errors.New("scene ID is required")
	}
	if !isFiniteNonNegativeCustom(input.VideoTimestamp) || !isFiniteNonNegativeCustom(input.Duration) {
		return errors.New("video timestamp and duration must be finite and non-negative")
	}
	if input.Duration > 0 && input.VideoTimestamp > input.Duration+1 {
		return errors.New("video timestamp is beyond the video duration")
	}
	if math.IsNaN(input.PlaybackRate) || math.IsInf(input.PlaybackRate, 0) || input.PlaybackRate <= 0 {
		return errors.New("playback rate must be finite and positive")
	}
	switch input.Status {
	case "playing", "paused", "buffering":
	default:
		return errors.New("playback status must be playing, paused, or buffering")
	}
	return nil
}

func isFiniteNonNegativeCustom(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0
}

func copyRemotePlaybackStateCustom(state *RemotePlaybackState) *RemotePlaybackState {
	if state == nil {
		return nil
	}
	copy := *state
	return &copy
}

func copyRemotePlaybackCommandCustom(command *RemotePlaybackCommand) *RemotePlaybackCommand {
	copy := *command
	return &copy
}

func copyRemotePlaybackResultCustom(result *RemotePlaybackOResult) *RemotePlaybackOResult {
	copy := *result
	return &copy
}

func (h *remotePlaybackHubCustom) cleanupLocked(now time.Time) {
	for token, pairing := range h.pairings {
		if now.After(pairing.expires) {
			delete(h.pairings, token)
		}
	}
	for id, result := range h.results {
		recorded, _ := time.Parse(time.RFC3339Nano, result.RecordedAt)
		if now.Sub(recorded) > 24*time.Hour {
			delete(h.results, id)
		}
	}
	for playerID, updatedAt := range h.stateAt {
		if now.Sub(updatedAt) > remotePlaybackStateTTL {
			delete(h.states, playerID)
			delete(h.stateAt, playerID)
		}
	}
	for commandID, command := range h.pending {
		// Retain expired IDs so a retry cannot become a new tap at a later time.
		if now.Sub(command.createdAt) > 24*time.Hour {
			delete(h.pending, commandID)
		}
	}
}

func (h *remotePlaybackHubCustom) update(input RemotePlaybackStateInput) (*RemotePlaybackState, error) {
	if err := validateRemotePlaybackStateCustom(input); err != nil {
		return nil, err
	}
	h.recordMutex.Lock()
	defer h.recordMutex.Unlock()
	now := time.Now()
	state := &RemotePlaybackState{
		ServerID: h.serverID,
		PlayerID: input.PlayerID, SessionID: input.SessionID,
		SceneID: input.SceneID, SceneTitle: strings.TrimSpace(input.SceneTitle),
		VideoTimestamp: input.VideoTimestamp, Duration: input.Duration,
		PlaybackRate: input.PlaybackRate, Status: input.Status,
		UpdatedAt: now.Format(time.RFC3339Nano),
	}

	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.cleanupLocked(now)
	if existing := h.states[input.PlayerID]; existing != nil && existing.SessionID != input.SessionID {
		return nil, errors.New("another tab or panel owns this remote; close it or turn off its remote control first")
	}
	if h.states[input.PlayerID] == nil && len(h.states) >= 256 {
		return nil, errors.New("too many active players")
	}
	h.states[input.PlayerID] = state
	h.stateAt[input.PlayerID] = now
	for _, subscriber := range h.stateSubscribers[input.PlayerID] {
		select {
		case subscriber <- copyRemotePlaybackStateCustom(state):
		default:
		}
	}
	return copyRemotePlaybackStateCustom(state), nil
}

func (h *remotePlaybackHubCustom) state(playerID string) *RemotePlaybackState {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.cleanupLocked(time.Now())
	return copyRemotePlaybackStateCustom(h.states[playerID])
}

func (h *remotePlaybackHubCustom) disconnect(playerID, sessionID string) bool {
	h.recordMutex.Lock()
	defer h.recordMutex.Unlock()
	h.mutex.Lock()
	defer h.mutex.Unlock()
	state := h.states[playerID]
	if state == nil || state.SessionID != sessionID {
		return false
	}
	delete(h.states, playerID)
	delete(h.stateAt, playerID)
	return true
}

func (h *remotePlaybackHubCustom) request(input RemotePlaybackORequestInput) (*RemotePlaybackCommand, error) {
	if err := validateRemotePlaybackTokenCustom("command ID", input.CommandID); err != nil {
		return nil, err
	}
	if !strings.HasPrefix(input.CommandID, h.serverID+"_") {
		return nil, errors.New("server restarted or command belongs to another server; check O history before recording again")
	}
	now := time.Now()
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.cleanupLocked(now)
	if result := h.results[input.CommandID]; result != nil {
		if result.PlayerID != input.PlayerID || result.sessionID != input.SessionID || result.SceneID != input.ExpectedSceneID {
			return nil, errors.New("command ID is already in use")
		}
		for _, subscriber := range h.resultSubscribers[input.PlayerID] {
			select {
			case subscriber <- copyRemotePlaybackResultCustom(result):
			default:
			}
		}
		return &RemotePlaybackCommand{CommandID: input.CommandID, PlayerID: input.PlayerID, SessionID: input.SessionID, ExpectedSceneID: input.ExpectedSceneID}, nil
	}
	if existing := h.pending[input.CommandID]; existing != nil {
		if existing.PlayerID == input.PlayerID && existing.SessionID == input.SessionID && existing.ExpectedSceneID == input.ExpectedSceneID {
			if now.Sub(existing.createdAt) > remotePlaybackCommandTTL {
				return nil, errors.New("remote command expired without a receipt; check O history before recording again")
			}
			return copyRemotePlaybackCommandCustom(existing), nil
		}
		return nil, errors.New("command ID is already in use")
	}
	// The time comes from the server's state heartbeat, avoiding phone clock skew.
	// Once receipts expire, an old ID must never be interpreted as a fresh tap.
	parts := strings.Split(input.CommandID, "_")
	if len(parts) != 3 {
		return nil, errors.New("invalid remote command ID")
	}
	issuedMillis, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || now.Sub(time.UnixMilli(issuedMillis)) > remotePlaybackCommandTTL || time.UnixMilli(issuedMillis).After(now.Add(time.Second)) {
		return nil, errors.New("remote command expired; check O history before recording again")
	}
	state := h.states[input.PlayerID]
	if state == nil {
		return nil, errors.New("paired player is offline")
	}
	if state.SessionID != input.SessionID || state.SceneID != input.ExpectedSceneID {
		return nil, errors.New("the player changed sessions or scenes; refresh and try again")
	}
	if state.Status == "buffering" || state.Duration <= 0 {
		return nil, errors.New("player is buffering or not ready")
	}
	if len(h.pending) >= 10000 || len(h.results) >= 10000 {
		return nil, errors.New("remote command capacity reached; try later")
	}
	subscribers := h.commandSubscribers[input.PlayerID]
	if len(subscribers) == 0 {
		return nil, errors.New("paired player is not listening for remote commands")
	}
	command := &RemotePlaybackCommand{
		CommandID: input.CommandID, PlayerID: input.PlayerID,
		SessionID: input.SessionID, ExpectedSceneID: input.ExpectedSceneID,
		createdAt: now,
	}
	delivered := false
	for _, subscriber := range subscribers {
		select {
		case subscriber <- copyRemotePlaybackCommandCustom(command):
			delivered = true
		default:
		}
	}
	if !delivered {
		return nil, errors.New("paired player command queue is busy")
	}
	h.pending[input.CommandID] = command
	return copyRemotePlaybackCommandCustom(command), nil
}

func (h *remotePlaybackHubCustom) validateRecord(input RemotePlaybackORecordInput) (*RemotePlaybackOResult, error) {
	if !isFiniteNonNegativeCustom(input.VideoTimestamp) {
		return nil, errors.New("video timestamp must be finite and non-negative")
	}
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.cleanupLocked(time.Now())
	if result := h.results[input.CommandID]; result != nil {
		if result.PlayerID != input.PlayerID || result.sessionID != input.SessionID || result.SceneID != input.SceneID {
			return nil, errors.New("command ID is already in use")
		}
		return copyRemotePlaybackResultCustom(result), nil
	}
	command := h.pending[input.CommandID]
	if command == nil || time.Since(command.createdAt) > remotePlaybackCommandTTL {
		return nil, errors.New("remote command is missing or expired")
	}
	if command.PlayerID != input.PlayerID || command.SessionID != input.SessionID || command.ExpectedSceneID != input.SceneID {
		return nil, errors.New("remote command does not match the active player session and scene")
	}
	state := h.states[input.PlayerID]
	if state == nil || state.SessionID != input.SessionID || state.SceneID != input.SceneID {
		return nil, errors.New("the player changed sessions or scenes before recording")
	}
	if state.Status == "buffering" || state.Duration <= 0 {
		return nil, errors.New("player is buffering or not ready")
	}
	if state.Duration > 0 && input.VideoTimestamp > state.Duration+1 {
		return nil, errors.New("video timestamp is beyond the active video duration")
	}
	return nil, nil
}

func (h *remotePlaybackHubCustom) complete(result *RemotePlaybackOResult) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	delete(h.pending, result.CommandID)
	h.results[result.CommandID] = result
	for _, subscriber := range h.resultSubscribers[result.PlayerID] {
		select {
		case subscriber <- copyRemotePlaybackResultCustom(result):
		default:
		}
	}
}

func addRemotePlaybackSubscriberCustom[T any](ctx context.Context, mutex *sync.Mutex, nextID *uint64, subscribers map[string]map[uint64]chan T, playerID string, buffer int) chan T {
	channel := make(chan T, buffer)
	mutex.Lock()
	*nextID++
	id := *nextID
	if subscribers[playerID] == nil {
		subscribers[playerID] = make(map[uint64]chan T)
	}
	subscribers[playerID][id] = channel
	mutex.Unlock()
	go func() {
		<-ctx.Done()
		mutex.Lock()
		delete(subscribers[playerID], id)
		if len(subscribers[playerID]) == 0 {
			delete(subscribers, playerID)
		}
		close(channel)
		mutex.Unlock()
	}()
	return channel
}

func (h *remotePlaybackHubCustom) subscribeState(ctx context.Context, playerID string) <-chan *RemotePlaybackState {
	channel := addRemotePlaybackSubscriberCustom(ctx, &h.mutex, &h.nextSubscriberID, h.stateSubscribers, playerID, 1)
	if state := h.state(playerID); state != nil {
		h.mutex.Lock()
		if ctx.Err() == nil {
			select {
			case channel <- state:
			default:
			}
		}
		h.mutex.Unlock()
	}
	return channel
}

func (h *remotePlaybackHubCustom) createPairing(playerID string) (string, error) {
	if err := validateRemotePlaybackTokenCustom("player ID", playerID); err != nil {
		return "", err
	}
	var bytes [24]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes[:])
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.cleanupLocked(time.Now())
	if len(h.pairings) >= 512 {
		return "", errors.New("too many pending pairings")
	}
	for previous, pairing := range h.pairings {
		if pairing.playerID == playerID {
			delete(h.pairings, previous)
		}
	}
	h.pairings[token] = remotePairingCustom{playerID: playerID, expires: time.Now().Add(5 * time.Minute)}
	return token, nil
}

func (h *remotePlaybackHubCustom) redeemPairing(token string) (string, error) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.cleanupLocked(time.Now())
	pairing, ok := h.pairings[token]
	if !ok {
		return "", errors.New("pairing code expired or already used; generate a new code on the player")
	}
	delete(h.pairings, token)
	return pairing.playerID, nil
}

func (h *remotePlaybackHubCustom) subscribeCommands(ctx context.Context, playerID string) <-chan *RemotePlaybackCommand {
	return addRemotePlaybackSubscriberCustom(ctx, &h.mutex, &h.nextSubscriberID, h.commandSubscribers, playerID, 8)
}

func (h *remotePlaybackHubCustom) subscribeResults(ctx context.Context, playerID string) <-chan *RemotePlaybackOResult {
	return addRemotePlaybackSubscriberCustom(ctx, &h.mutex, &h.nextSubscriberID, h.resultSubscribers, playerID, 8)
}
