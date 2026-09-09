import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { Alert, Button } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import {
  remoteIdCustom,
  remoteTimeCustom,
  remotePendingCustom,
  remoteCommandIdCustom,
} from "./remotePlayback_custom";
import { Link } from "react-router-dom";

const pairingKey = "stash.remoteO.pairedPlayer";
const pendingKey = "stash.remoteO.pending";
type Pending = GQL.RemotePlaybackORequestInput;

export default function RemoteO() {
  const client = useApolloClient();
  const [playerId, setPlayerId] = useState(
    () => localStorage.getItem(pairingKey) ?? ""
  );
  const [state, setState] = useState<GQL.RemotePlaybackState | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState<Pending | undefined>(() =>
    remotePendingCustom(sessionStorage.getItem(pendingKey), playerId)
  );
  const pendingRef = useRef<Pending | undefined>(pending);
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "pair"
    );
    if (!token) return;
    setPairing(true);
    void client
      .mutate<GQL.RemotePlaybackPairingRedeemMutation>({
        mutation: GQL.RemotePlaybackPairingRedeemDocument,
        variables: { token },
      })
      .then(({ data }) => {
        if (!data?.remotePlaybackPairingRedeem)
          throw new Error("Pairing failed.");
        const id = data.remotePlaybackPairingRedeem;
        localStorage.setItem(pairingKey, id);
        if (pendingRef.current?.player_id !== id) {
          sessionStorage.removeItem(pendingKey);
          pendingRef.current = undefined;
          setPending(undefined);
        }
        setPlayerId(id);
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
        setConfirmation(
          "Paired. Bookmark this page or add it to your home screen."
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPairing(false));
  }, [client]);

  useEffect(() => {
    setState(null);
    setLastSeen(0);
    if (!playerId) return;
    let disposed = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await client.query<GQL.RemotePlaybackStateQuery>({
          query: GQL.RemotePlaybackStateDocument,
          variables: { player_id: playerId },
          fetchPolicy: "no-cache",
        });
        if (!disposed) {
          setState(result.data.remotePlaybackState ?? null);
          setLastSeen(Date.now());
        }
      } catch {
        if (!disposed) setLastSeen(0);
      } finally {
        polling = false;
      }
    };
    const results = client
      .subscribe<GQL.RemotePlaybackOResultSubscribeSubscription>({
        query: GQL.RemotePlaybackOResultSubscribeDocument,
        variables: { player_id: playerId },
      })
      .subscribe({
        next: ({ data }) => {
          const result = data?.remotePlaybackOResultSubscribe;
          if (!result || result.command_id !== pendingRef.current?.command_id)
            return;
          setConfirmation(
            `O recorded at ${remoteTimeCustom(
              result.video_timestamp
            )} (${result.video_timestamp.toFixed(3)} seconds).`
          );
          setPending(undefined);
          sessionStorage.removeItem(pendingKey);
          pendingRef.current = undefined;
          setBusy(false);
          setError("");
          try {
            navigator.vibrate?.(50);
          } catch {
            /* Haptics are optional. */
          }
        },
        error: () =>
          setError("Connection interrupted. Reopen this page to reconnect."),
      });
    void poll();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void poll();
    }, 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      results.unsubscribe();
    };
  }, [client, playerId]);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => {
      setBusy(false);
      setError(
        "No confirmation yet. Retry this tap to check its result safely."
      );
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [busy]);

  async function record() {
    if (busy || (!pendingRef.current && !state)) return;
    const request = pendingRef.current ?? {
      command_id: remoteCommandIdCustom(state!, remoteIdCustom()),
      player_id: playerId,
      session_id: state!.session_id,
      expected_scene_id: state!.scene_id,
    };
    pendingRef.current = request;
    sessionStorage.setItem(pendingKey, JSON.stringify(request));
    setPending(request);
    setBusy(true);
    setConfirmation("");
    setError("");
    try {
      await client.mutate({
        mutation: GQL.RemotePlaybackRequestODocument,
        variables: { input: request },
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const online = !!state && now - lastSeen < 4000;
  const available =
    online &&
    (state?.duration ?? 0) > 0 &&
    state?.status !== "buffering" &&
    !pairing;
  return (
    <main className="container text-center py-4" style={{ maxWidth: 560 }}>
      <h1>Remote O</h1>
      <div role="status" aria-live="polite">
        {pairing ? (
          <p>Pairing…</p>
        ) : !playerId ? (
          <p>
            On your player, open the scene’s <strong>File Info</strong> tab and
            choose “Pair phone for O”, then scan the code. After pairing, this
            page remembers the player for future sessions.
          </p>
        ) : (
          <>
            <h2 className="h4">
              {online ? state?.scene_title : "Waiting for your player"}
            </h2>
            <p>
              {online
                ? `${state?.status} · ${remoteTimeCustom(
                    state?.video_timestamp ?? 0
                  )}`
                : "Open a scene in your paired browser. Keep that tab connected."}
            </p>
          </>
        )}
        {confirmation && <Alert variant="success">{confirmation}</Alert>}
        {error && <Alert variant="warning">{error}</Alert>}
      </div>
      <Button
        variant="primary"
        disabled={busy || (!pending && !available)}
        onClick={() => void record()}
        aria-label={
          pending ? "Retry pending O tap" : "Record O at current player time"
        }
        style={{
          width: "100%",
          minHeight: "42vh",
          fontSize: pending ? "2rem" : "6rem",
          touchAction: "manipulation",
          borderRadius: 24,
        }}
      >
        {busy ? "Recording…" : pending ? "Retry this tap" : "O"}
      </Button>
      {pending && !busy && (
        <div className="mt-3">
          <p>
            A retry uses the same tap ID and cannot record a duplicate. If the
            result remains unknown, check the scene’s O history before starting
            another tap.
          </p>
          <Link
            to={`/scenes/${pending.expected_scene_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Check scene O history
          </Link>
          <Button
            variant="link"
            onClick={() => {
              pendingRef.current = undefined;
              setPending(undefined);
              sessionStorage.removeItem(pendingKey);
              setError("");
            }}
          >
            Checked history — start a new tap
          </Button>
        </div>
      )}
      {playerId && (
        <Button
          variant="link"
          className="mt-3"
          disabled={busy}
          onClick={() => {
            localStorage.removeItem(pairingKey);
            sessionStorage.removeItem(pendingKey);
            setPlayerId("");
            setPending(undefined);
            pendingRef.current = undefined;
            setError("");
            setConfirmation("");
          }}
        >
          Forget pairing / change player
        </Button>
      )}
    </main>
  );
}
