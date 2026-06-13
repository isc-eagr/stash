import React, { useMemo, useState, useEffect, useCallback } from "react"; // CUSTOM: added useMemo, useCallback
import { Button, Form } from "react-bootstrap"; // CUSTOM: added Form
import { faThLarge } from "@fortawesome/free-solid-svg-icons";
import { FormattedMessage } from "react-intl";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import { PrimaryTags } from "./PrimaryTags";
import { SceneMarkerForm } from "./SceneMarkerForm";
// CUSTOM: begin
import { markerTitle } from "src/core/markers";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";
// CUSTOM: end

interface ISceneMarkersPanelProps {
  sceneId: string;
  isVisible: boolean;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void; // CUSTOM
}

export const SceneMarkersPanel: React.FC<ISceneMarkersPanelProps> = ({
  sceneId,
  isVisible,
  onClickMarker,
  addMultiSegmentLoopSegments, // CUSTOM
}) => {
  const { data, loading } = GQL.useFindSceneMarkerTagsQuery({
    variables: { id: sceneId },
  });
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingMarker, setEditingMarker] =
    useState<GQL.SceneMarkerDataFragment>();
  // CUSTOM: begin – expandable cards, selection state, memoized callbacks & markers
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {}
  );

  const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<string>>(
    () => new Set()
  );

  const onOpenEditor = useCallback((marker?: GQL.SceneMarkerDataFragment) => {
    setIsEditorOpen(true);
    setEditingMarker(marker ?? undefined);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingMarker(undefined);
    setIsEditorOpen(false);
  }, []);

  const sceneMarkers = useMemo(
    () =>
      (data?.sceneMarkerTags.map((tag) => tag.scene_markers) ?? []).reduce(
        (prev, current) => [...prev, ...current],
        [] as GQL.SceneMarkerDataFragment[]
      ),
    [data?.sceneMarkerTags]
  );
  // CUSTOM: end

  // set up hotkeys
  useEffect(() => {
    if (!isVisible) return;

    Mousetrap.bind("n", () => onOpenEditor());

    return () => {
      Mousetrap.unbind("n");
    };
  });

  // CUSTOM: begin – marker selection & multi-segment loop
  // Keep selection in sync with currently-loaded markers
  useEffect(() => {
    const validIDs = new Set(sceneMarkers.map((m) => m.id));
    setSelectedMarkerIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIDs.has(id)) next.add(id);
      });
      return next;
    });
  }, [sceneMarkers]);

  const totalMarkerCount = sceneMarkers.length;
  const allSelected =
    totalMarkerCount > 0 && selectedMarkerIds.size === totalMarkerCount;

  const setManySelected = useCallback((ids: string[], selected: boolean) => {
    setSelectedMarkerIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  const toggleSingle = useCallback((id: string, selected: boolean) => {
    setSelectedMarkerIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const onMoveSelectionToMultiLoop = useCallback(() => {
    if (selectedMarkerIds.size === 0) return;

    const selectedMarkers = sceneMarkers
      .filter((m) => selectedMarkerIds.has(m.id))
      .sort((a, b) => a.seconds - b.seconds);

    const segments: ILoopSegmentInput[] = selectedMarkers.map((m) => {
      const start = m.seconds;
      const endRaw = m.end_seconds ?? m.seconds + 20;
      const end = endRaw > start ? endRaw : start + 1;
      const title = markerTitle(m);
      return { start, end, title };
    });

    addMultiSegmentLoopSegments(segments);
    setSelectedMarkerIds(new Set());
  }, [addMultiSegmentLoopSegments, sceneMarkers, selectedMarkerIds]);

  const onOpenSelectedMarkersInViewer = useCallback(() => {
    if (selectedMarkerIds.size === 0) return;

    const idsParam = sceneMarkers
      .filter((m) => selectedMarkerIds.has(m.id))
      .sort((a, b) => a.seconds - b.seconds)
      .map((m) => m.id)
      .join(",");

    window.open(`/viewer?markers=${idsParam}`, "_blank");
    setSelectedMarkerIds(new Set());
  }, [sceneMarkers, selectedMarkerIds]);
  // CUSTOM: end

  if (isEditorOpen) {
    return (
      <SceneMarkerForm
        sceneID={sceneId}
        marker={editingMarker}
        onClose={closeEditor}
      />
    );
  }

  if (loading) return null;

  return (
    <div className="scene-markers-panel">
      {/* CUSTOM: begin – toolbar with loop button & select-all */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center" style={{ gap: "0.75rem" }}>
          <Button onClick={() => onOpenEditor()}>
            <FormattedMessage id="actions.create_marker" />
          </Button>

          <Button
            disabled={selectedMarkerIds.size === 0}
            onClick={onMoveSelectionToMultiLoop}
          >
            Add to Loop
          </Button>

          <Button
            disabled={selectedMarkerIds.size === 0}
            onClick={onOpenSelectedMarkersInViewer}
            title="Open selected markers in viewer"
          >
            <Icon icon={faThLarge} />
          </Button>
        </div>

        <Form.Check
          className="mb-0"
          type="checkbox"
          // label={intl.formatMessage({ id: "actions.select_all" })}
          checked={allSelected}
          disabled={totalMarkerCount === 0}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setManySelected(
              sceneMarkers.map((m) => m.id),
              e.currentTarget.checked
            )
          }
        />
      </div>
      {/* CUSTOM: end */}
      <div className="container">
        <PrimaryTags
          sceneMarkers={sceneMarkers}
          onClickMarker={onClickMarker}
          onEdit={onOpenEditor}
          // CUSTOM: begin – expandable card & selection props
          expandedCards={expandedCards}
          onToggleCard={(id: string) =>
            setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
          }
          selectedMarkerIds={selectedMarkerIds}
          onSelectMarker={toggleSingle}
          onSelectMarkers={setManySelected}
          // CUSTOM: end
        />
      </div>
    </div>
  );
};

export default SceneMarkersPanel;
