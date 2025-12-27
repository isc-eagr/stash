import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Button, ButtonGroup, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import { PrimaryTags } from "./PrimaryTags";
import { SceneMarkerForm } from "./SceneMarkerForm";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";

interface ISceneMarkersPanelProps {
  sceneId: string;
  isVisible: boolean;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void;
}

export const SceneMarkersPanel: React.FC<ISceneMarkersPanelProps> = ({
  sceneId,
  isVisible,
  onClickMarker,
  addMultiSegmentLoopSegments,
}) => {
  const intl = useIntl();
  const { data, loading } = GQL.useFindSceneMarkerTagsQuery({
    variables: { id: sceneId },
  });
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingMarker, setEditingMarker] =
    useState<GQL.SceneMarkerDataFragment>();
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

  // set up hotkeys
  useEffect(() => {
    if (!isVisible) return;

    Mousetrap.bind("n", () => onOpenEditor());

    return () => {
      Mousetrap.unbind("n");
    };
  });

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
      return { start, end };
    });

    addMultiSegmentLoopSegments(segments);
    setSelectedMarkerIds(new Set());
  }, [addMultiSegmentLoopSegments, sceneMarkers, selectedMarkerIds]);

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
        </div>

        <Form.Check
          className="mb-0"
          type="checkbox"
          //label={intl.formatMessage({ id: "actions.select_all" })}
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
      <div className="container">
        <PrimaryTags
          sceneMarkers={sceneMarkers}
          onClickMarker={onClickMarker}
          onEdit={onOpenEditor}
          expandedCards={expandedCards}
          onToggleCard={(id: string) =>
            setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
          }
          selectedMarkerIds={selectedMarkerIds}
          onSelectMarker={toggleSingle}
          onSelectMarkers={setManySelected}
        />
      </div>
    </div>
  );
};

export default SceneMarkersPanel;
