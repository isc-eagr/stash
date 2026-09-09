import { useApolloClient } from "@apollo/client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as GQL from "src/core/generated-graphql";
import {
  PlaybackSnapshot,
  remoteCommandMatchesCustom,
  remoteIdCustom,
  remotePlayerIdCustom,
  remoteSnapshotValidCustom,
} from "./remotePlayback_custom";

export function useRemotePlayerCustom(
  identity: string,
  readSnapshot: () => PlaybackSnapshot | undefined
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

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let updating = false;
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
                  video_timestamp: snapshot.video_timestamp,
                },
              },
            })
            .then(({ data: recordedData }) => {
              const result = recordedData?.remotePlaybackRecordO;
              if (!result) return;
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
