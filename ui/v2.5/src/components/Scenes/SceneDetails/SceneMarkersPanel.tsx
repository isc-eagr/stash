import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"; // CUSTOM: added useMemo, useCallback, useRef
import { Button } from "react-bootstrap"; // CUSTOM
import { FormattedMessage } from "react-intl";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import { PrimaryTags } from "./PrimaryTags";
import { SceneMarkerForm } from "./SceneMarkerForm";
// CUSTOM: begin
import { markerTitle } from "src/core/markers";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";
import { SceneMarkersChronologicalPanel } from "./SceneMarkersChronologicalPanel";
import {
  filterCoveredChronologicalSceneMarkers,
  filterChronologicalSceneMarkers,
  getChronologicalSceneMarkerDerivedWindows,
  type ISceneMarkerChronologyDerivedWindow,
  type ISceneMarkerChronologySearchFilters,
} from "./sceneMarkerChronologySearch_custom";
import { shouldShowOfficialSceneMarkerLayout } from "./sceneMarkerLayoutPreference_custom";
import TextUtils from "src/utils/text";
// CUSTOM: end

interface ISceneMarkersPanelProps {
  sceneId: string;
  isVisible: boolean;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void; // CUSTOM
  currentTimestamp?: number; // CUSTOM
  focusedMarkerId?: string; // CUSTOM
  onFocusedMarkerHandled?: () => void; // CUSTOM
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
  focusedMarkerId, // CUSTOM
  onFocusedMarkerHandled, // CUSTOM
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
  const [selectedDerivedWindowKeys, setSelectedDerivedWindowKeys] = useState<
    Set<string>
  >(() => new Set());
  const [markerSearch, setMarkerSearch] =
    useState<ISceneMarkerChronologySearchFilters>({
      tags: [],
      topPerformers: [],
      bottomPerformers: [],
    });
  const [focusedMarkerHighlightId, setFocusedMarkerHighlightId] =
    useState<string>();
  const markerPanelScrollTop = useRef(0);
  const focusedMarkerHighlightTimer = useRef<number>();

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

  useEffect(() => {
    if (!focusedMarkerId) return;

    if (!filteredSceneMarkers.some((marker) => marker.id === focusedMarkerId)) {
      setMarkerSearch({
        tags: [],
        topPerformers: [],
        bottomPerformers: [],
      });
    }
  }, [filteredSceneMarkers, focusedMarkerId]);

  const showOfficialSceneMarkerLayout = shouldShowOfficialSceneMarkerLayout(
    configuration.ui
  );
  const visibleSceneMarkers = showOfficialSceneMarkerLayout
    ? sceneMarkers
    : filteredSceneMarkers;
  const derivedWindows = useMemo(
    () =>
      !showOfficialSceneMarkerLayout
        ? getChronologicalSceneMarkerDerivedWindows(
            sceneMarkers,
            markerSearch,
            filteredSceneMarkers
          )
        : [],
    [
      filteredSceneMarkers,
      markerSearch,
      sceneMarkers,
      showOfficialSceneMarkerLayout,
    ]
  );

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

  useEffect(() => {
    const validKeys = new Set(derivedWindows.map((window) => window.key));
    setSelectedDerivedWindowKeys((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      prev.forEach((key) => {
        if (validKeys.has(key)) next.add(key);
      });
      return next;
    });
  }, [derivedWindows]);

  useEffect(() => {
    if (!focusedMarkerId || !isVisible) return;

    window.clearTimeout(focusedMarkerHighlightTimer.current);
    setFocusedMarkerHighlightId(focusedMarkerId);
    focusedMarkerHighlightTimer.current = window.setTimeout(() => {
      setFocusedMarkerHighlightId(undefined);
    }, 10000);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const markerElement = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".scene-markers-panel [data-scene-marker-id]"
          )
        ).find(
          (element) =>
            element.getAttribute("data-scene-marker-id") === focusedMarkerId
        );

        markerElement?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
        if (markerElement) {
          onFocusedMarkerHandled?.();
        }
      });
    });
  }, [
    filteredSceneMarkers,
    focusedMarkerId,
    isVisible,
    onFocusedMarkerHandled,
  ]);

  useEffect(
    () => () => {
      window.clearTimeout(focusedMarkerHighlightTimer.current);
    },
    []
  );

  const visibleMarkerCount = visibleSceneMarkers.length;
  const visibleDerivedWindowCount = derivedWindows.length;
  const visiblePlaybackItemCount =
    visibleMarkerCount + visibleDerivedWindowCount;
  const allVisibleSelected =
    visiblePlaybackItemCount > 0 &&
    visibleMarkerIds.every((id) => selectedMarkerIds.has(id)) &&
    derivedWindows.every((window) => selectedDerivedWindowKeys.has(window.key));
  const selectedMarkerCount = selectedMarkerIds.size;
  const selectedDerivedWindowCount = selectedDerivedWindowKeys.size;
  const selectedPlaybackItemCount =
    selectedMarkerCount + selectedDerivedWindowCount;

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

  const toggleDerivedWindow = useCallback((key: string, selected: boolean) => {
    setSelectedDerivedWindowKeys((prev) => {
      const next = new Set(prev);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const setManyDerivedWindowsSelected = useCallback(
    (keys: string[], selected: boolean) => {
      setSelectedDerivedWindowKeys((prev) => {
        const next = new Set(prev);
        keys.forEach((key) => {
          if (selected) next.add(key);
          else next.delete(key);
        });
        return next;
      });
    },
    []
  );

  const selectedDerivedWindows = useMemo(
    () =>
      derivedWindows.filter((window) =>
        selectedDerivedWindowKeys.has(window.key)
      ),
    [derivedWindows, selectedDerivedWindowKeys]
  );

  const derivedWindowTitle = useCallback(
    (
      window: ISceneMarkerChronologyDerivedWindow<GQL.SceneMarkerDataFragment>
    ) =>
      `Derived ${TextUtils.secondsToTimestamp(
        window.seconds
      )} - ${TextUtils.secondsToTimestamp(window.end_seconds)}`,
    []
  );

  const onMoveSelectionToMultiLoop = useCallback(() => {
    if (selectedPlaybackItemCount === 0) return;

    const selectedMarkers = filterCoveredChronologicalSceneMarkers(
      sceneMarkers.filter((m) => selectedMarkerIds.has(m.id))
    );

    const markerSegments: ILoopSegmentInput[] = selectedMarkers.map((m) => {
      const start = m.seconds;
      const endRaw = m.end_seconds ?? m.seconds + 20;
      const end = endRaw > start ? endRaw : start + 1;
      const title = markerTitle(m);
      return { start, end, title };
    });
    const derivedSegments: ILoopSegmentInput[] = selectedDerivedWindows.map(
      (window) => ({
        start: window.seconds,
        end: window.end_seconds,
        title: derivedWindowTitle(window),
      })
    );

    addMultiSegmentLoopSegments([...markerSegments, ...derivedSegments]);
    setSelectedMarkerIds(new Set());
    setSelectedDerivedWindowKeys(new Set());
  }, [
    addMultiSegmentLoopSegments,
    derivedWindowTitle,
    sceneMarkers,
    selectedDerivedWindows,
    selectedMarkerIds,
    selectedPlaybackItemCount,
  ]);

  const onOpenSelectedMarkersInViewer = useCallback(() => {
    if (selectedPlaybackItemCount === 0) return;

    const markerIds = filterCoveredChronologicalSceneMarkers(
      sceneMarkers.filter((m) => selectedMarkerIds.has(m.id))
    )
      .map((m) => m.id)
      .join(",");
    const markerRangeIds = selectedDerivedWindows
      .map(
        (window) =>
          `${window.sourceMarker.id}:${window.seconds}:${window.end_seconds}`
      )
      .join(",");
    const params = new URLSearchParams();

    if (markerIds) params.set("markers", markerIds);
    if (markerRangeIds) params.set("marker_ranges", markerRangeIds);

    window.open(`/viewer?${params.toString()}`, "_blank");
    setSelectedMarkerIds(new Set());
    setSelectedDerivedWindowKeys(new Set());
  }, [
    sceneMarkers,
    selectedDerivedWindows,
    selectedMarkerIds,
    selectedPlaybackItemCount,
  ]);

  const onToggleSelectVisibleMarkers = useCallback(() => {
    if (visiblePlaybackItemCount === 0) return;

    const selected = !allVisibleSelected;
    setManySelected(visibleMarkerIds, selected);
    setManyDerivedWindowsSelected(
      derivedWindows.map((window) => window.key),
      selected
    );
  }, [
    allVisibleSelected,
    derivedWindows,
    setManyDerivedWindowsSelected,
    setManySelected,
    visibleMarkerIds,
    visiblePlaybackItemCount,
  ]);
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
      <div className="scene-marker-toolbar">
        <div className="scene-marker-toolbar-actions">
          <Button onClick={() => onOpenEditor()}>
            <FormattedMessage id="actions.create_marker" />
          </Button>

          <Button
            disabled={selectedPlaybackItemCount === 0}
            onClick={onMoveSelectionToMultiLoop}
          >
            Add to Loop
          </Button>

          <Button
            disabled={selectedPlaybackItemCount === 0}
            onClick={onOpenSelectedMarkersInViewer}
            title="Open selected markers in viewer"
          >
            Open in Viewer
          </Button>
        </div>

        <div className="scene-marker-toolbar-actions">
          <Button
            disabled={visiblePlaybackItemCount === 0}
            onClick={onToggleSelectVisibleMarkers}
            variant="secondary"
          >
            {allVisibleSelected
              ? showOfficialSceneMarkerLayout
                ? "Clear All"
                : "Clear Filtered"
              : "Select All"}
          </Button>
        </div>
      </div>
      <div className="scene-marker-toolbar-status text-muted">
        {selectedPlaybackItemCount > 0
          ? `${selectedPlaybackItemCount} selected`
          : visibleDerivedWindowCount > 0
          ? `${visibleMarkerCount} markers, ${visibleDerivedWindowCount} derived`
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
            markers={filteredSceneMarkers}
            allMarkers={sceneMarkers}
            search={markerSearch}
            onSearchChange={setMarkerSearch}
            selectedMarkerIds={selectedMarkerIds}
            derivedWindows={derivedWindows}
            selectedDerivedWindowKeys={selectedDerivedWindowKeys}
            onClickMarker={onClickMarker}
            onEdit={onOpenEditor}
            onSelectMarker={toggleSingle}
            onSelectMarkers={setManySelected}
            onSelectDerivedWindow={toggleDerivedWindow}
            currentTimestamp={currentTimestamp}
            focusedMarkerId={focusedMarkerHighlightId}
          />
        )}
      </div>
    </div>
  );
};

export default SceneMarkersPanel;
