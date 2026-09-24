import React, { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { releaseMutationCacheRefreshCustom } from "src/core/sceneReleaseCache_custom";
import { useToast } from "src/hooks/Toast";
import { isReleaseMarkerSeekableCustom } from "./sceneReleaseMarkerSeek_custom";

interface IProps {
  release: GQL.SceneReleaseDataFragment;
  kind: "markers" | "negative";
  onSeek: (seconds: number) => void;
}

const timestamp = (seconds: number) => `${Math.round(seconds * 10) / 10}s`;

interface IMarkerDraftCustom {
  title: string;
  seconds: string;
  endSeconds: string;
  primaryTagID: string;
  tagIDs: string[];
  topIDs: string[];
  bottomIDs: string[];
}

interface INegativeDraftCustom {
  name: string;
  start: string;
  end: string;
}

const markerDraftCustom = (
  release: GQL.SceneReleaseDataFragment,
  marker?: GQL.SceneMarkerDataFragment
): IMarkerDraftCustom => ({
  title: marker?.title ?? "",
  seconds: marker?.seconds.toString() ?? "0",
  endSeconds: marker?.end_seconds?.toString() ?? "",
  primaryTagID: marker?.primary_tag.id ?? release.tags[0]?.id ?? "",
  tagIDs: marker?.tags.map((tag) => tag.id) ?? [],
  topIDs: marker?.top_performers.map((performer) => performer.id) ?? [],
  bottomIDs: marker?.bottom_performers.map((performer) => performer.id) ?? [],
});

const toggleIDCustom = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];

export const SceneReleaseMarkersCustom: React.FC<IProps> = ({
  release,
  kind,
  onSeek,
}) => {
  const Toast = useToast();
  const [editingMarker, setEditingMarker] =
    useState<GQL.SceneMarkerDataFragment>();
  const [draft, setDraft] = useState<IMarkerDraftCustom>();
  const [deleteMarkerID, setDeleteMarkerID] = useState<string>();
  const [negativeDraft, setNegativeDraft] = useState<INegativeDraftCustom>();
  const [editingNegativeID, setEditingNegativeID] = useState<string>();
  const [deleteNegativeID, setDeleteNegativeID] = useState<string>();
  const [saveMarker, { loading: saving }] =
    GQL.useSceneReleaseMarkerSaveMutation(releaseMutationCacheRefreshCustom);
  const [destroyMarker, { loading: deleting }] =
    GQL.useSceneReleaseMarkerDestroyMutation(releaseMutationCacheRefreshCustom);
  const [saveNegative, { loading: savingNegative }] =
    GQL.useSceneReleaseNegativeMarkerSaveMutation(
      releaseMutationCacheRefreshCustom
    );
  const [destroyNegative, { loading: deletingNegative }] =
    GQL.useSceneReleaseNegativeMarkerDestroyMutation(
      releaseMutationCacheRefreshCustom
    );
  const openNegativeForm = (id?: string) => {
    const existing = release.negative_markers.find((item) => item.id === id);
    setEditingNegativeID(id);
    setNegativeDraft({
      name: existing?.name ?? "",
      start: existing?.start_seconds.toString() ?? "0",
      end: existing?.end_seconds.toString() ?? "",
    });
  };
  const handleSaveNegative = async () => {
    if (!negativeDraft) return;
    const start = Number(negativeDraft.start);
    const end = Number(negativeDraft.end);
    if (
      !negativeDraft.end.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start
    ) {
      Toast.error("Enter a valid skip range");
      return;
    }
    try {
      await saveNegative({
        variables: {
          input: {
            release_id: release.id,
            id: editingNegativeID,
            name: negativeDraft.name,
            start_seconds: start,
            end_seconds: end,
          },
        },
      });
      setNegativeDraft(undefined);
      setEditingNegativeID(undefined);
    } catch (error) {
      Toast.error(error);
    }
  };
  const handleDeleteNegative = async () => {
    if (!deleteNegativeID) return;
    try {
      await destroyNegative({
        variables: { release_id: release.id, marker_id: deleteNegativeID },
      });
      setDeleteNegativeID(undefined);
    } catch (error) {
      Toast.error(error);
    }
  };
  const openMarkerForm = (marker?: GQL.SceneMarkerDataFragment) => {
    setEditingMarker(marker);
    setDraft(markerDraftCustom(release, marker));
  };
  const tagOptions = new Map<string, string>();
  release.tags.forEach((tag) => tagOptions.set(tag.id, tag.name));
  if (editingMarker) {
    tagOptions.set(
      editingMarker.primary_tag.id,
      editingMarker.primary_tag.name
    );
    editingMarker.tags.forEach((tag) => tagOptions.set(tag.id, tag.name));
  }
  const performerOptions = new Map<string, string>();
  release.performers.forEach((performer) =>
    performerOptions.set(performer.id, performer.name)
  );
  editingMarker?.top_performers.forEach((performer) =>
    performerOptions.set(performer.id, performer.name)
  );
  editingMarker?.bottom_performers.forEach((performer) =>
    performerOptions.set(performer.id, performer.name)
  );

  const handleSaveMarker = async () => {
    if (!draft) return;
    const seconds = Number(draft.seconds);
    const endSeconds = draft.endSeconds.trim()
      ? Number(draft.endSeconds)
      : null;
    if (
      !draft.primaryTagID ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      (endSeconds != null &&
        (!Number.isFinite(endSeconds) || endSeconds < seconds))
    ) {
      Toast.error("Enter a valid marker tag and time range");
      return;
    }
    try {
      await saveMarker({
        variables: {
          input: {
            release_id: release.id,
            id: editingMarker?.id,
            title: draft.title,
            seconds,
            end_seconds: endSeconds,
            primary_tag_id: draft.primaryTagID,
            tag_ids: draft.tagIDs.filter((id) => id !== draft.primaryTagID),
            top_performer_ids: draft.topIDs,
            bottom_performer_ids: draft.bottomIDs,
          },
        },
      });
      setDraft(undefined);
      setEditingMarker(undefined);
    } catch (error) {
      Toast.error(error);
    }
  };

  const handleDeleteMarker = async () => {
    if (!deleteMarkerID) return;
    try {
      await destroyMarker({
        variables: { release_id: release.id, marker_id: deleteMarkerID },
      });
      setDeleteMarkerID(undefined);
    } catch (error) {
      Toast.error(error);
    }
  };
  const markers =
    kind === "markers"
      ? release.scene_markers.map((marker) => ({
          id: marker.id,
          label: marker.title || marker.primary_tag.name,
          start: marker.seconds,
          end: marker.end_seconds,
        }))
      : release.negative_markers.map((marker) => ({
          id: marker.id,
          label: marker.name || "Skip",
          start: marker.start_seconds,
          end: marker.end_seconds,
        }));
  const duration = release.files[0]?.duration;

  return (
    <div className="p-3" aria-label={`${release.title || "Release"} ${kind}`}>
      {kind === "markers" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openMarkerForm()}
          disabled={tagOptions.size === 0}
          title={
            tagOptions.size === 0 ? "Assign a release tag first" : undefined
          }
          className="mb-2"
        >
          Add marker
        </Button>
      )}
      {kind === "negative" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openNegativeForm()}
          className="mb-2"
        >
          Add skip range
        </Button>
      )}
      {markers.length === 0 ? (
        <span className="text-muted">No release {kind} yet.</span>
      ) : (
        <div className="d-flex flex-column align-items-start">
          {markers.map((marker) => (
            <div key={marker.id} className="d-flex align-items-center">
              <Button
                variant="link"
                className="text-left"
                onClick={() => onSeek(marker.start)}
                disabled={
                  !isReleaseMarkerSeekableCustom(marker.start, duration)
                }
                title={
                  duration != null && marker.start > duration
                    ? "Timestamp is beyond this release's video"
                    : undefined
                }
              >
                {timestamp(marker.start)}
                {marker.end != null && `–${timestamp(marker.end)}`} ·{" "}
                {marker.label}
              </Button>
              {kind === "markers" && (
                <>
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() =>
                      openMarkerForm(
                        release.scene_markers.find(
                          (item) => item.id === marker.id
                        )
                      )
                    }
                    aria-label={`Edit ${marker.label}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => setDeleteMarkerID(marker.id)}
                    aria-label={`Delete ${marker.label}`}
                  >
                    Delete
                  </Button>
                </>
              )}
              {kind === "negative" && (
                <>
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => openNegativeForm(marker.id)}
                    aria-label={`Edit ${marker.label}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => setDeleteNegativeID(marker.id)}
                    aria-label={`Delete ${marker.label}`}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal show={draft !== undefined} onHide={() => setDraft(undefined)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingMarker ? "Edit release marker" : "Add release marker"}
          </Modal.Title>
        </Modal.Header>
        {draft && (
          <Modal.Body>
            <Form.Group>
              <Form.Label>Title</Form.Label>
              <Form.Control
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Start (seconds)</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="any"
                value={draft.seconds}
                onChange={(event) =>
                  setDraft({ ...draft, seconds: event.target.value })
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>End (seconds)</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="any"
                value={draft.endSeconds}
                onChange={(event) =>
                  setDraft({ ...draft, endSeconds: event.target.value })
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Primary tag</Form.Label>
              <Form.Control
                as="select"
                value={draft.primaryTagID}
                onChange={(event) =>
                  setDraft({ ...draft, primaryTagID: event.target.value })
                }
              >
                {[...tagOptions].map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
            <Form.Group>
              <Form.Label>Other tags</Form.Label>
              {[...tagOptions]
                .filter(([id]) => id !== draft.primaryTagID)
                .map(([id, name]) => (
                  <Form.Check
                    key={id}
                    label={name}
                    checked={draft.tagIDs.includes(id)}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        tagIDs: toggleIDCustom(draft.tagIDs, id),
                      })
                    }
                  />
                ))}
            </Form.Group>
            {["top", "bottom"].map((role) => (
              <Form.Group key={role}>
                <Form.Label>
                  {role === "top" ? "Top performers" : "Bottom performers"}
                </Form.Label>
                {[...performerOptions].map(([id, name]) => {
                  const ids = role === "top" ? draft.topIDs : draft.bottomIDs;
                  return (
                    <Form.Check
                      key={id}
                      label={name}
                      checked={ids.includes(id)}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          [role === "top" ? "topIDs" : "bottomIDs"]:
                            toggleIDCustom(ids, id),
                        })
                      }
                    />
                  );
                })}
              </Form.Group>
            ))}
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDraft(undefined)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={saving}
            onClick={handleSaveMarker}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal
        show={deleteMarkerID !== undefined}
        onHide={() => setDeleteMarkerID(undefined)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete release marker?</Modal.Title>
        </Modal.Header>
        <Modal.Body>This removes only the marker on this release.</Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeleteMarkerID(undefined)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={handleDeleteMarker}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal
        show={negativeDraft !== undefined}
        onHide={() => setNegativeDraft(undefined)}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingNegativeID
              ? "Edit release skip range"
              : "Add release skip range"}
          </Modal.Title>
        </Modal.Header>
        {negativeDraft && (
          <Modal.Body>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={negativeDraft.name}
                onChange={(event) =>
                  setNegativeDraft({
                    ...negativeDraft,
                    name: event.target.value,
                  })
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Start (seconds)</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="any"
                value={negativeDraft.start}
                onChange={(event) =>
                  setNegativeDraft({
                    ...negativeDraft,
                    start: event.target.value,
                  })
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>End (seconds)</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="any"
                value={negativeDraft.end}
                onChange={(event) =>
                  setNegativeDraft({
                    ...negativeDraft,
                    end: event.target.value,
                  })
                }
              />
            </Form.Group>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setNegativeDraft(undefined)}
          >
            Cancel
          </Button>
          <Button disabled={savingNegative} onClick={handleSaveNegative}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal
        show={deleteNegativeID !== undefined}
        onHide={() => setDeleteNegativeID(undefined)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete release skip range?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This removes only the skip range on this release.
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeleteNegativeID(undefined)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deletingNegative}
            onClick={handleDeleteNegative}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
