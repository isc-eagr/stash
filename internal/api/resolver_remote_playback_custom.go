package api

// CUSTOM: GraphQL surface for paired mobile remote playback.

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/stashapp/stash/pkg/models"
)

func (r *queryResolver) RemotePlaybackState(ctx context.Context, playerID string) (*RemotePlaybackState, error) {
	if err := validateRemotePlaybackTokenCustom("player ID", playerID); err != nil {
		return nil, err
	}
	return remotePlaybackHub.state(playerID), nil
}

func (r *mutationResolver) RemotePlaybackUpdate(ctx context.Context, input RemotePlaybackStateInput) (*RemotePlaybackState, error) {
	return remotePlaybackHub.update(input)
}

func (r *mutationResolver) RemotePlaybackDisconnect(ctx context.Context, playerID string, sessionID string) (bool, error) {
	if err := validateRemotePlaybackTokenCustom("player ID", playerID); err != nil {
		return false, err
	}
	if err := validateRemotePlaybackTokenCustom("session ID", sessionID); err != nil {
		return false, err
	}
	return remotePlaybackHub.disconnect(playerID, sessionID), nil
}

func (r *mutationResolver) RemotePlaybackRequestO(ctx context.Context, input RemotePlaybackORequestInput) (*RemotePlaybackCommand, error) {
	return remotePlaybackHub.request(input)
}

func (r *mutationResolver) RemotePlaybackRecordO(ctx context.Context, input RemotePlaybackORecordInput) (*RemotePlaybackOResult, error) {
	remotePlaybackHub.recordMutex.Lock()
	defer remotePlaybackHub.recordMutex.Unlock()
	if existing, err := remotePlaybackHub.validateRecord(input); err != nil {
		return nil, err
	} else if existing != nil {
		return existing, nil
	}

	sceneID, err := strconv.Atoi(input.SceneID)
	if err != nil {
		return nil, fmt.Errorf("converting scene id: %w", err)
	}
	// A release playing on the scene records the O like its local O button.
	var count int
	if releaseID := remotePlaybackReleaseIDCustom(input.ReleaseID); releaseID != "" {
		if count, err = r.recordRemoteReleaseOCustom(ctx, sceneID, releaseID, input.VideoTimestamp); err != nil {
			return nil, err
		}
	} else {
		ctx = models.WithHistoryMutationCountOnlyCustom(ctx)
		updatedTimes, err := r.recordSceneOAtTimestampCustom(ctx, sceneID, input.VideoTimestamp)
		if err != nil {
			return nil, err
		}
		count = models.HistoryMutationResultCountCustom(ctx, len(updatedTimes))
	}
	result := &RemotePlaybackOResult{
		CommandID: input.CommandID, PlayerID: input.PlayerID,
		SceneID: input.SceneID, ReleaseID: input.ReleaseID, VideoTimestamp: input.VideoTimestamp,
		Count: count, RecordedAt: time.Now().Format(time.RFC3339Nano), sessionID: input.SessionID,
	}
	remotePlaybackHub.complete(result)
	return result, nil
}

func (r *mutationResolver) RemotePlaybackPairingCreate(ctx context.Context, playerID string) (string, error) {
	return remotePlaybackHub.createPairing(playerID)
}

func (r *mutationResolver) RemotePlaybackPairingRedeem(ctx context.Context, token string) (string, error) {
	return remotePlaybackHub.redeemPairing(token)
}

func (r *subscriptionResolver) RemotePlaybackCommandSubscribe(ctx context.Context, playerID string) (<-chan *RemotePlaybackCommand, error) {
	if err := validateRemotePlaybackTokenCustom("player ID", playerID); err != nil {
		return nil, err
	}
	return remotePlaybackHub.subscribeCommands(ctx, playerID), nil
}

func (r *subscriptionResolver) RemotePlaybackOResultSubscribe(ctx context.Context, playerID string) (<-chan *RemotePlaybackOResult, error) {
	if err := validateRemotePlaybackTokenCustom("player ID", playerID); err != nil {
		return nil, err
	}
	return remotePlaybackHub.subscribeResults(ctx, playerID), nil
}
