import { useApolloClient } from "@apollo/client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as GQL from "src/core/generated-graphql";
import type { VideoJsPlayer } from "video.js";
import { showRemoteToastCustom } from "./remoteToast_custom";
import {
  PlaybackSnapshot,
  remoteCommandMatchesCustom,
  remoteIdCustom,
  remotePlayerIdCustom,
  remoteSnapshotValidCustom,
} from "./remotePlayback_custom";

export function useRemotePlayerCustom(
  identity: string,
  readSnapshot: () => PlaybackSnapshot | undefined,
  getPlayer?: () => VideoJsPlayer | undefined
) {
  const client = useApolloClient();
  const [playerId] = useState(remotePlayerIdCustom);
  // A scene/source change invalidates commands already in flight.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessionId = useMemo(() => remoteIdCustom(), [identity]);
  const currentSession = useRef(sessionId);
  currentSession.current = sessionId;
  const [enabled, setEnabled] = useState(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const readRef = useRef(readSnapshot);
  readRef.current = readSnapshot;
  const playerRef = useRef(getPlayer);
  playerRef.current = getPlayer;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let updating = false;
    let clearToast: (() => void) | undefined;
    const handled = new Set<string>();
    const subscription = client
      .subscribe<GQL.RemotePlaybackCommandSubscribeSubscription>({
        query: GQL.RemotePlaybackCommandSubscribeDocument,
        variables: { player_id: playerId },
      })
      .subscribe({
        next: ({ data }) => {
          const command = data?.remotePlaybackCommandSubscribe;
          const snapshot = readRef.current();
          // Loop selection is independent of recording readiness (including seeking).
          if (command?.selected_segment_ids != null) {
            if (
              !disposed &&
              currentSession.current === sessionId &&
              command.session_id === sessionId &&
              snapshot?.scene_id === command.expected_scene_id
            ) {
              const player = playerRef.current?.();
              if (player && !player.isDisposed()) {
                player
                  .multiSegmentLoop?.()
                  .selectRemoteSegments(
                    command.selected_segment_ids,
                    command.loop_revision ?? ""
                  );
              }
            }
            return;
          }
          if (
            disposed ||
            currentSession.current !== sessionId ||
            !command ||
            !snapshot ||
            handled.has(command.command_id) ||
            !remoteCommandMatchesCustom(sessionId, snapshot, command)
          )
            return;
          handled.add(command.command_id);
          if (handled.size > 100) handled.delete(handled.values().next().value);
          void client
            .mutate<GQL.RemotePlaybackRecordOMutation>({
              mutation: GQL.RemotePlaybackRecordODocument,
              variables: {
                input: {
                  command_id: command.command_id,
                  player_id: playerId,
                  session_id: sessionId,
                  scene_id: snapshot.scene_id,
                  video_timestamp: command.video_timestamp,
                },
              },
            })
            .then(({ data: recordedData }) => {
              const result = recordedData?.remotePlaybackRecordO;
              if (!result) {
                handled.delete(command.command_id);
                if (!disposed)
                  setError("The player did not receive an O receipt.");
                return;
              }
              if (!disposed && currentSession.current === sessionId) {
                clearToast?.();
                clearToast = showRemoteToastCustom(
                  "O recorded",
                  playerRef.current?.()?.el()
                );
              }
              if (!disposed)
                setConfirmation(
                  `O recorded at ${result.video_timestamp.toFixed(3)} seconds.`
                );
              // Fetch the canonical history/rating so the player timeline updates too.
              const cacheId = client.cache.identify({
                __typename: "Scene",
                id: result.scene_id,
              });
              for (const fieldName of [
                "o_counter",
                "o_history",
                "o_timestamps",
                "rating100",
              ]) {
                client.cache.evict({ id: cacheId, fieldName });
              }
              void client
                .refetchQueries({ include: [GQL.FindSceneDocument] })
                .catch(() => undefined);
            })
            .catch((err: Error) => {
              handled.delete(command.command_id);
              if (!disposed) setError(err.message);
            });
        },
        error: (err) => {
          if (!disposed) setError(err.message);
        },
      });
    const update = async () => {
      if (disposed || updating || currentSession.current !== sessionId) return;
      const snapshot = readRef.current();
      if (!snapshot || !remoteSnapshotValidCustom(snapshot)) return;
      updating = true;
      const player = playerRef.current?.();
      const loopState =
        player && !player.isDisposed()
          ? player.multiSegmentLoop?.().getRemoteLoopState()
          : undefined;
      try {
        queue.current = queue.current
          .catch(() => undefined)
          .then(() => {
            if (disposed || currentSession.current !== sessionId) return;
            return client.mutate({
              mutation: GQL.RemotePlaybackUpdateDocument,
              variables: {
                input: {
                  ...snapshot,
                  ...loopState,
                  player_id: playerId,
                  session_id: sessionId,
                },
              },
            });
          });
        await queue.current;
        if (!disposed) setError("");
      } catch (err) {
        if (!disposed) setError((err as Error).message);
      } finally {
        updating = false;
      }
    };
    void update();
    const timer = window.setInterval(() => void update(), 1000);
    return () => {
      disposed = true;
      clearToast?.();
      window.clearInterval(timer);
      subscription.unsubscribe();
      queue.current = queue.current
        .catch(() => undefined)
        .then(() =>
          client.mutate({
            mutation: GQL.RemotePlaybackDisconnectDocument,
            variables: { player_id: playerId, session_id: sessionId },
          })
        )
        .catch(() => undefined);
    };
  }, [client, playerId, sessionId, enabled]);

  return { playerId, error, confirmation, enabled, setEnabled };
}
