import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { Alert, Button } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";

export default function RemoteLoopControls({
  state,
  online,
}: {
  state: GQL.RemotePlaybackState;
  online: boolean;
}) {
  const client = useApolloClient();
  const [selected, setSelected] = useState(state.selected_segment_ids);
  const desired = useRef(selected);
  const queue = useRef(Promise.resolve());
  const waitingUntil = useRef(0);
  const outstanding = useRef(0);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  useEffect(() => {
    if (outstanding.current) return;
    const matches =
      desired.current.length === state.selected_segment_ids.length &&
      desired.current.every((id) => state.selected_segment_ids.includes(id));
    if (!matches && Date.now() < waitingUntil.current) return;
    if (!matches && waitingUntil.current)
      setError("Selection was not confirmed. Try again.");
    waitingUntil.current = 0;
    desired.current = state.selected_segment_ids;
    setSelected(state.selected_segment_ids);
  }, [state]);

  function select(ids: string[]) {
    desired.current = ids;
    setSelected(ids);
    setError("");
    outstanding.current++;
    queue.current = queue.current.then(async () => {
      if (!mounted.current) return;
      try {
        const result =
          await client.mutate<GQL.RemotePlaybackSelectSegmentsMutation>({
            mutation: GQL.RemotePlaybackSelectSegmentsDocument,
            variables: {
              input: {
                player_id: state.player_id,
                session_id: state.session_id,
                expected_scene_id: state.scene_id,
                loop_revision: state.loop_revision,
                selected_segment_ids: ids,
              },
            },
          });
        if (!result.data?.remotePlaybackSelectSegments)
          throw new Error("Selection failed. Try again.");
        waitingUntil.current = Date.now() + 4000;
      } catch (err) {
        if (mounted.current) setError((err as Error).message);
        waitingUntil.current = 0;
      } finally {
        outstanding.current--;
      }
    });
  }

  return (
    <section className="mt-4" aria-label="Loop segments">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="h5 mb-0">Loop segments</h2>
        <Button
          variant="outline-secondary"
          disabled={!online || !selected.length}
          onClick={() => select([])}
        >
          Deselect all
        </Button>
      </div>
      <p className="text-muted">
        {selected.length
          ? `${selected.length} selected`
          : "Playing normal loop"}
      </p>
      <div className="d-flex flex-wrap" style={{ gap: 8 }}>
        {state.loop_segments.map((segment, index) => (
          <Button
            key={segment.id}
            variant={
              selected.includes(segment.id) ? "primary" : "outline-primary"
            }
            aria-label={`Loop segment ${index + 1}`}
            aria-pressed={selected.includes(segment.id)}
            disabled={!online}
            style={{
              minHeight: 48,
              flex: "1 1 45%",
              touchAction: "manipulation",
            }}
            onClick={() =>
              select(
                desired.current.includes(segment.id)
                  ? desired.current.filter((id) => id !== segment.id)
                  : [...desired.current, segment.id]
              )
            }
          >
            {index + 1}
          </Button>
        ))}
      </div>
      {error && (
        <Alert className="mt-2" variant="warning">
          {error}
        </Alert>
      )}
    </section>
  );
}
