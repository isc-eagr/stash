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
import { useFindScene } from "src/core/StashService"; // CUSTOM
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
import {
  prepareSceneMarkerWarnings,
  sceneMarkerWarningDraft,
} from "./sceneMarkerGapWarning_custom";
import { getSceneActivityMetrics } from "../sceneActivityMetricsData_custom";
import { getSceneMarkerSelectionCounts } from "./sceneMarkerSelection_custom";
import { getSceneMarkerStickyHeaderOffset } from "./sceneMarkerStickyHeader_custom";
import {
  findSceneMarkerFocusElement,
  scrollSceneMarkerIntoTabView,
  type ISceneMarkerFocusRequest,
} from "./sceneMarkerFocusScroll_custom";
import type {
  ISceneMarkerTimestampCopyRequest,
  ISceneMarkerTimestampCopySelection,
  SceneMarkerTimestampDestination,
  SceneMarkerTimestampField,
} from "src/components/ScenePlayer/sceneMarkerTimestampCopy_custom";
// CUSTOM: end

interface ISceneMarkersPanelProps {
  sceneId: string;
  isVisible: boolean;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void; // CUSTOM
  currentTimestamp?: number; // CUSTOM
  focusedMarkerRequest?: ISceneMarkerFocusRequest; // CUSTOM
  onFocusedMarkerHandled?: (requestId: number) => void; // CUSTOM
  markerTimestampCopyRequest?: ISceneMarkerTimestampCopyRequest; // CUSTOM
  markerTimestampCopySelection?: ISceneMarkerTimestampCopySelection; // CUSTOM
  onMarkerTimestampCopyRequest: (
    field: SceneMarkerTimestampField | undefined,
    destination: SceneMarkerTimestampDestination
  ) => void; // CUSTOM
  onMarkerTimestampCopySelectionHandled: (requestId: number) => void; // CUSTOM
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
  focusedMarkerRequest, // CUSTOM
  onFocusedMarkerHandled, // CUSTOM
  markerTimestampCopyRequest, // CUSTOM
  markerTimestampCopySelection, // CUSTOM
  onMarkerTimestampCopyRequest, // CUSTOM
  onMarkerTimestampCopySelectionHandled, // CUSTOM
}) => {
  const { configuration } = useConfigurationContext(); // CUSTOM
  const { data, loading } = GQL.useFindSceneMarkerTagsQuery({
    variables: { id: sceneId },
  });
  const { data: sceneData } = useFindScene(sceneId); // CUSTOM
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
  const markerPanelRef = useRef<HTMLDivElement>(null); // CUSTOM: activity header sticky offset target
  const markerToolbarRef = useRef<HTMLDivElement>(null); // CUSTOM: measured sticky toolbar
  const focusedMarkerId = focusedMarkerRequest?.markerId;

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
  const negativeMarkers = useMemo(
    () => sceneData?.findScene?.negative_markers ?? [],
    [sceneData?.findScene?.negative_markers]
  );
  // CUSTOM: reuse the scene-detail activity calculation for Oral and Sex headers
  const activitySectionPercents = useMemo(() => {
    const scene = sceneData?.findScene;
    if (!scene) return {};

    const activityMetrics = getSceneActivityMetrics(
      scene,
      configuration?.ui.roleTagIds ?? {}
    );

    return {
      oral: activityMetrics?.activity.find((metric) => metric.key === "oral")
        ?.percent,
      sex: activityMetrics?.activity.find((metric) => metric.key === "sex")
        ?.percent,
    };
  }, [configuration?.ui.roleTagIds, sceneData?.findScene]);
  const markerWarningMessagesById = useMemo(() => {
    const warningsById = new Map<string, string[]>();
    const warningCalculator = prepareSceneMarkerWarnings({
      sceneMarkers,
      negativeMarkers,
      roleTagIds: configuration?.ui.roleTagIds ?? {},
    });

    sceneMarkers.forEach((marker) => {
      const warningMessages = warningCalculator
        .findWarnings(sceneMarkerWarningDraft(marker))
        .map((warning) => warning.message);

      if (warningMessages.length > 0) {
        warningsById.set(marker.id, warningMessages);
      }
    });

    return warningsById;
  }, [configuration?.ui.roleTagIds, negativeMarkers, sceneMarkers]);

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

  // CUSTOM: keep Activity Type headers directly below the measured sticky toolbar.
  useEffect(() => {
    const markerPanel = markerPanelRef.current;
    const toolbar = markerToolbarRef.current;
    if (!isVisible || !markerPanel || !toolbar) return;

    const updateStickyHeaderOffset = () => {
      markerPanel.style.setProperty(
        "--scene-marker-activity-header-sticky-offset",
        getSceneMarkerStickyHeaderOffset(toolbar.getBoundingClientRect().height)
      );
    };

    updateStickyHeaderOffset();
    const resizeObserver = new ResizeObserver(updateStickyHeaderOffset);
    resizeObserver.observe(toolbar);

    return () => resizeObserver.disconnect();
  }, [isEditorOpen, isVisible, loading, showOfficialSceneMarkerLayout]);

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
    if (!focusedMarkerRequest || !isVisible) return;

    const { markerId, requestId } = focusedMarkerRequest;
    let highlightFrame: number | undefined;
    let findMarkerFrame: number | undefined;
    let scrollMarkerFrame: number | undefined;

    window.clearTimeout(focusedMarkerHighlightTimer.current);
    setFocusedMarkerHighlightId(undefined);

    // Stop an older smooth scroll at its current position before starting the
    // newest request. Removing the focused ID also cancels the previous glow.
    const activeScrollElement = getSceneTabScrollElement();
    activeScrollElement?.scrollTo({
      behavior: "auto",
      top: activeScrollElement.scrollTop,
    });

    highlightFrame = window.requestAnimationFrame(() => {
      setFocusedMarkerHighlightId(markerId);
      focusedMarkerHighlightTimer.current = window.setTimeout(() => {
        setFocusedMarkerHighlightId(undefined);
      }, 10000);
    });

    findMarkerFrame = window.requestAnimationFrame(() => {
      scrollMarkerFrame = window.requestAnimationFrame(() => {
        const markerElement = findSceneMarkerFocusElement(
          document.querySelectorAll<HTMLElement>(
            ".scene-markers-panel [data-scene-marker-id], .scene-markers-panel [data-scene-marker-ids]"
          ),
          markerId
        );

        if (markerElement) {
          const scrollElement =
            markerElement.closest<HTMLElement>(".tab-content");
          if (scrollElement) {
            scrollSceneMarkerIntoTabView(scrollElement, markerElement);
          }
          onFocusedMarkerHandled?.(requestId);
        }
      });
    });

    return () => {
      if (highlightFrame !== undefined) {
        window.cancelAnimationFrame(highlightFrame);
      }
      if (findMarkerFrame !== undefined) {
        window.cancelAnimationFrame(findMarkerFrame);
      }
      if (scrollMarkerFrame !== undefined) {
        window.cancelAnimationFrame(scrollMarkerFrame);
      }
    };
  }, [
    filteredSceneMarkers,
    focusedMarkerRequest,
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
  const selectedPlaybackKeys = useMemo(
    () => [
      ...Array.from(selectedMarkerIds, (id) => `marker:${id}`),
      ...Array.from(selectedDerivedWindowKeys, (key) => `derived:${key}`),
    ],
    [selectedDerivedWindowKeys, selectedMarkerIds]
  );
  const visiblePlaybackKeys = useMemo(
    () =>
      new Set([
        ...visibleMarkerIds.map((id) => `marker:${id}`),
        ...derivedWindows.map((window) => `derived:${window.key}`),
      ]),
    [derivedWindows, visibleMarkerIds]
  );
  const selectionCounts = useMemo(
    () =>
      getSceneMarkerSelectionCounts(selectedPlaybackKeys, visiblePlaybackKeys),
    [selectedPlaybackKeys, visiblePlaybackKeys]
  );
  const selectedPlaybackItemCount = selectionCounts.total;
  const allResultMarkersSelected =
    sceneMarkers.length > 0 &&
    sceneMarkers.every((marker) => selectedMarkerIds.has(marker.id));
  const allResultsSelected =
    allResultMarkersSelected &&
    derivedWindows.every((window) => selectedDerivedWindowKeys.has(window.key));
  const markerSearchActive =
    !showOfficialSceneMarkerLayout &&
    (markerSearch.tags.length > 0 ||
      markerSearch.topPerformers.length > 0 ||
      markerSearch.bottomPerformers.length > 0);

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
  }, [
    sceneMarkers,
    selectedDerivedWindows,
    selectedMarkerIds,
    selectedPlaybackItemCount,
  ]);

  const onSelectVisibleMarkers = useCallback(() => {
    if (visiblePlaybackItemCount === 0) return;

    setManySelected(visibleMarkerIds, true);
    setManyDerivedWindowsSelected(
      derivedWindows.map((window) => window.key),
      true
    );
  }, [
    derivedWindows,
    setManyDerivedWindowsSelected,
    setManySelected,
    visibleMarkerIds,
    visiblePlaybackItemCount,
  ]);

  const onSelectAllResults = useCallback(() => {
    setManySelected(
      sceneMarkers.map((marker) => marker.id),
      true
    );
    setManyDerivedWindowsSelected(
      derivedWindows.map((window) => window.key),
      true
    );
  }, [
    derivedWindows,
    sceneMarkers,
    setManyDerivedWindowsSelected,
    setManySelected,
  ]);

  const onClearSelection = useCallback(() => {
    setSelectedMarkerIds(new Set());
    setSelectedDerivedWindowKeys(new Set());
  }, []);
  // CUSTOM: end

  if (isEditorOpen) {
    return (
      <SceneMarkerForm
        sceneID={sceneId}
        marker={editingMarker}
        onClose={closeEditor}
        markerTimestampCopyRequest={markerTimestampCopyRequest} // CUSTOM
        markerTimestampCopySelection={markerTimestampCopySelection} // CUSTOM
        onMarkerTimestampCopyRequest={onMarkerTimestampCopyRequest} // CUSTOM
        onMarkerTimestampCopySelectionHandled={
          onMarkerTimestampCopySelectionHandled
        } // CUSTOM
      />
    );
  }

  if (loading) return null;

  return (
    <div className="scene-markers-panel" ref={markerPanelRef}>
      {/* CUSTOM: begin – toolbar with loop button & select-all */}
      <div className="scene-marker-toolbar-shell" ref={markerToolbarRef}>
        <div className="scene-marker-toolbar">
          <div className="scene-marker-toolbar-actions">
            <Button
              onClick={() => onOpenEditor()}
              title="Create marker (keyboard shortcut: N)"
            >
              <FormattedMessage id="actions.create_marker" />
            </Button>

            <Button
              disabled={selectedPlaybackItemCount === 0}
              onClick={onMoveSelectionToMultiLoop}
              variant="secondary"
            >
              {selectedPlaybackItemCount > 0
                ? `Add ${selectedPlaybackItemCount} to Loop`
                : "Add to Loop"}
            </Button>

            <Button
              disabled={selectedPlaybackItemCount === 0}
              onClick={onOpenSelectedMarkersInViewer}
              title="Open selected markers in viewer"
              variant="secondary"
            >
              {selectedPlaybackItemCount > 0
                ? `Open ${selectedPlaybackItemCount} in Viewer`
                : "Open in Viewer"}
            </Button>
          </div>
        </div>
        <div className="scene-marker-toolbar-status">
          <span className="scene-marker-selection-summary">
            {selectedPlaybackItemCount > 0 ? (
              <>
                {selectedPlaybackItemCount} selected
                {selectionCounts.hidden > 0 && (
                  <span className="scene-marker-hidden-selection-count">
                    {` · ${selectionCounts.hidden} hidden by filters`}
                  </span>
                )}
              </>
            ) : visibleDerivedWindowCount > 0 ? (
              `${visibleMarkerCount} markers, ${visibleDerivedWindowCount} derived`
            ) : markerSearchActive ? (
              `${visibleMarkerCount} of ${sceneMarkers.length} markers`
            ) : (
              `${visibleMarkerCount} markers`
            )}
          </span>
          <div className="scene-marker-selection-actions">
            {!allVisibleSelected && visiblePlaybackItemCount > 0 && (
              <Button variant="link" onClick={onSelectVisibleMarkers}>
                Select all visible
              </Button>
            )}
            {markerSearchActive && !allResultsSelected && (
              <Button variant="link" onClick={onSelectAllResults}>
                {`Select all ${sceneMarkers.length + derivedWindows.length}`}
              </Button>
            )}
            {selectedPlaybackItemCount > 0 && (
              <Button variant="link" onClick={onClearSelection}>
                Clear
              </Button>
            )}
          </div>
        </div>
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
            markerWarningMessagesById={markerWarningMessagesById}
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
            // CUSTOM: activity coverage percentages for Oral and Sex section headers
            activitySectionPercents={activitySectionPercents}
            onClickMarker={onClickMarker}
            onEdit={onOpenEditor}
            onSelectMarker={toggleSingle}
            onSelectMarkers={setManySelected}
            onSelectDerivedWindow={toggleDerivedWindow}
            currentTimestamp={currentTimestamp}
            focusedMarkerId={focusedMarkerHighlightId}
            markerWarningMessagesById={markerWarningMessagesById}
          />
        )}
      </div>
    </div>
  );
};

export default SceneMarkersPanel;
