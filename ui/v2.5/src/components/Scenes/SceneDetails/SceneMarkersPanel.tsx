import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"; // CUSTOM: added useMemo, useCallback, useRef
import { Button, Nav } from "react-bootstrap"; // CUSTOM
import { FormattedMessage } from "react-intl";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import { PrimaryTags } from "./PrimaryTags";
import { SceneMarkerForm } from "./SceneMarkerForm";
// CUSTOM: begin
import { markerTitle } from "src/core/markers";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";
import {
  SceneMarkersChronologicalPanel,
  type SceneMarkerChronologyTabKey,
} from "./SceneMarkersChronologicalPanel";
import {
  filterChronologicalSceneMarkers,
  type ISceneMarkerChronologySearchFilters,
} from "./sceneMarkerChronologySearch_custom";
import {
  compareActivityTypeSceneMarkers,
  getActivityTypeTagIds,
  isActivityTypeSceneMarker,
} from "./sceneMarkerActivityType_custom";
import { shouldShowOfficialSceneMarkerLayout } from "./sceneMarkerLayoutPreference_custom";
// CUSTOM: end

interface ISceneMarkersPanelProps {
  sceneId: string;
  isVisible: boolean;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void; // CUSTOM
  currentTimestamp?: number; // CUSTOM
}

function getSceneTabScrollElement() {
  return document.querySelector<HTMLElement>(".scene-tabs .tab-content");
}

export const SceneMarkersPanel: React.FC<ISceneMarkersPanelProps> = ({
  sceneId,
  isVisible,
  onClickMarker,
  addMultiSegmentLoopSegments, // CUSTOM
  currentTimestamp, // CUSTOM
}) => {
  const { configuration } = useConfigurationContext(); // CUSTOM
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
  const [markerSearch, setMarkerSearch] =
    useState<ISceneMarkerChronologySearchFilters>({
      tags: [],
      topPerformers: [],
      bottomPerformers: [],
    });
  const [markerChronologyTab, setMarkerChronologyTab] =
    useState<SceneMarkerChronologyTabKey>("activity");
  const markerPanelScrollTop = useRef(0);

  const onOpenEditor = useCallback((marker?: GQL.SceneMarkerDataFragment) => {
    markerPanelScrollTop.current = getSceneTabScrollElement()?.scrollTop ?? 0;
    setIsEditorOpen(true);
    setEditingMarker(marker ?? undefined);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingMarker(undefined);
    setIsEditorOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollElement = getSceneTabScrollElement();
        if (scrollElement) {
          scrollElement.scrollTop = markerPanelScrollTop.current;
        }
      });
    });
  }, []);

  const sceneMarkers = useMemo(() => {
    const markersByID = new Map<string, GQL.SceneMarkerDataFragment>();
    (data?.sceneMarkerTags ?? []).forEach((tag) => {
      tag.scene_markers.forEach((marker) => {
        markersByID.set(marker.id, marker);
      });
    });
    return Array.from(markersByID.values());
  }, [data?.sceneMarkerTags]);

  const filteredSceneMarkers = useMemo(
    () => filterChronologicalSceneMarkers(sceneMarkers, markerSearch),
    [markerSearch, sceneMarkers]
  );
  const activityTypeTagIds = useMemo(
    () => getActivityTypeTagIds(configuration?.ui.roleTagIds),
    [configuration?.ui.roleTagIds]
  );
  const highlightSceneMarkers = useMemo(
    () =>
      filteredSceneMarkers.filter(
        (marker) => !isActivityTypeSceneMarker(marker, activityTypeTagIds)
      ),
    [activityTypeTagIds, filteredSceneMarkers]
  );
  const activityTypeSceneMarkers = useMemo(
    () =>
      sceneMarkers
        .filter((marker) =>
          isActivityTypeSceneMarker(marker, activityTypeTagIds)
        )
        .sort((a, b) =>
          compareActivityTypeSceneMarkers(a, b, configuration?.ui.roleTagIds)
        ),
    [activityTypeTagIds, configuration?.ui.roleTagIds, sceneMarkers]
  );

  const showOfficialSceneMarkerLayout = shouldShowOfficialSceneMarkerLayout(
    configuration.ui
  );
  const visibleSceneMarkers = showOfficialSceneMarkerLayout
    ? sceneMarkers
    : markerChronologyTab === "activity"
    ? activityTypeSceneMarkers
    : highlightSceneMarkers;

  const visibleMarkerIds = useMemo(
    () => visibleSceneMarkers.map((marker) => marker.id),
    [visibleSceneMarkers]
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

  const visibleMarkerCount = visibleSceneMarkers.length;
  const allVisibleSelected =
    visibleMarkerCount > 0 &&
    visibleMarkerIds.every((id) => selectedMarkerIds.has(id));
  const selectedMarkerCount = selectedMarkerIds.size;

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

  const onToggleSelectVisibleMarkers = useCallback(() => {
    if (visibleMarkerIds.length === 0) return;

    setManySelected(visibleMarkerIds, !allVisibleSelected);
  }, [allVisibleSelected, setManySelected, visibleMarkerIds]);
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
      {!showOfficialSceneMarkerLayout && (
        <Nav
          variant="tabs"
          activeKey={markerChronologyTab}
          onSelect={(key) =>
            setMarkerChronologyTab(
              (key as SceneMarkerChronologyTabKey) ?? "activity"
            )
          }
          className="scene-marker-chronology-tabs"
        >
          <Nav.Item>
            <Nav.Link eventKey="activity">
              Activity Type ({activityTypeSceneMarkers.length})
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="highlights">
              Highlights ({highlightSceneMarkers.length})
            </Nav.Link>
          </Nav.Item>
        </Nav>
      )}
      <div className="scene-marker-toolbar">
        <div className="scene-marker-toolbar-actions">
          <Button onClick={() => onOpenEditor()}>
            <FormattedMessage id="actions.create_marker" />
          </Button>

          <Button
            disabled={selectedMarkerCount === 0}
            onClick={onMoveSelectionToMultiLoop}
          >
            Add to Loop
          </Button>

          <Button
            disabled={selectedMarkerCount === 0}
            onClick={onOpenSelectedMarkersInViewer}
            title="Open selected markers in viewer"
          >
            Open in Viewer
          </Button>
        </div>

        <div className="scene-marker-toolbar-actions">
          <Button
            disabled={visibleMarkerCount === 0}
            onClick={onToggleSelectVisibleMarkers}
            variant="secondary"
          >
            {allVisibleSelected
              ? showOfficialSceneMarkerLayout
                ? "Clear All"
                : markerChronologyTab === "activity"
                ? "Clear Activity"
                : "Clear Filtered"
              : "Select All"}
          </Button>
        </div>
      </div>
      <div className="scene-marker-toolbar-status text-muted">
        {selectedMarkerCount > 0
          ? `${selectedMarkerCount} selected`
          : `${visibleMarkerCount} markers`}
      </div>
      {/* CUSTOM: end */}
      <div className="scene-markers-container">
        {showOfficialSceneMarkerLayout ? (
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
        ) : (
          <SceneMarkersChronologicalPanel
            markers={
              markerChronologyTab === "activity"
                ? activityTypeSceneMarkers
                : highlightSceneMarkers
            }
            allMarkers={sceneMarkers}
            search={markerSearch}
            onSearchChange={setMarkerSearch}
            activeTab={markerChronologyTab}
            selectedMarkerIds={selectedMarkerIds}
            onClickMarker={onClickMarker}
            onEdit={onOpenEditor}
            onSelectMarker={toggleSingle}
            onSelectMarkers={setManySelected}
            currentTimestamp={currentTimestamp}
          />
        )}
      </div>
    </div>
  );
};

export default SceneMarkersPanel;
