import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useSceneNegativeMarkerDestroy } from "src/core/StashService"; // CUSTOM
import { SceneNegativeMarkerForm } from "./SceneNegativeMarkerForm";
import TextUtils from "src/utils/text";
import { Icon } from "src/components/Shared/Icon";
import {
  faEdit,
  faExclamationTriangle,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {
  prepareSceneMarkerWarnings,
  type SceneMarkerGapWarning,
} from "./sceneMarkerGapWarning_custom";
import { getSceneNegativeMarkerTotalDuration } from "./sceneNegativeMarkerDuration_custom"; // CUSTOM
import type {
  ISceneMarkerTimestampCopyRequest,
  ISceneMarkerTimestampCopySelection,
  SceneMarkerTimestampDestination,
  SceneMarkerTimestampField,
} from "src/components/ScenePlayer/sceneMarkerTimestampCopy_custom"; // CUSTOM

interface ISceneNegativeMarkersPanelProps {
  scene: GQL.SceneDataFragment;
  isVisible: boolean;
  onAddNextMarker: (seconds: number) => void; // CUSTOM: hand off adjacent regular drafts
  markerTimestampCopyRequest?: ISceneMarkerTimestampCopyRequest; // CUSTOM
  markerTimestampCopySelection?: ISceneMarkerTimestampCopySelection; // CUSTOM
  onMarkerTimestampCopyRequest: (
    field: SceneMarkerTimestampField | undefined,
    destination: SceneMarkerTimestampDestination
  ) => void; // CUSTOM
  onMarkerTimestampCopySelectionHandled: (requestId: number) => void; // CUSTOM
}

function formatGapMilliseconds(seconds: number) {
  return `${Math.round(seconds * 1000)}ms`;
}

function formatNegativeMarkerGapWarning(
  boundary: "Previous" | "Next",
  warning: SceneMarkerGapWarning
) {
  return `${boundary} ${warning.issueType} of ${formatGapMilliseconds(
    warning.issueSeconds
  )} with ${warning.adjacentMarkerType}`;
}

export const SceneNegativeMarkersPanel: React.FC<
  ISceneNegativeMarkersPanelProps
> = ({
  scene,
  isVisible,
  onAddNextMarker, // CUSTOM
  markerTimestampCopyRequest, // CUSTOM
  markerTimestampCopySelection, // CUSTOM
  onMarkerTimestampCopyRequest, // CUSTOM
  onMarkerTimestampCopySelectionHandled, // CUSTOM
}) => {
  const { configuration } = useConfigurationContext();
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingMarker, setEditingMarker] = useState<GQL.SceneNegativeMarker>();
  const [destroyMarker] = useSceneNegativeMarkerDestroy(scene.id); // CUSTOM

  const negativeMarkers = useMemo(() => {
    return [...(scene.negative_markers ?? [])].sort(
      (a, b) => a.start_seconds - b.start_seconds
    );
  }, [scene.negative_markers]);
  const totalSkippedSeconds = useMemo(
    () =>
      getSceneNegativeMarkerTotalDuration(
        negativeMarkers,
        scene.files[0]?.duration
      ),
    [negativeMarkers, scene.files]
  );
  const negativeMarkerWarningsById = useMemo(() => {
    const warningsById = new Map<string, string[]>();
    const warningCalculator = prepareSceneMarkerWarnings({
      sceneMarkers: scene.scene_markers ?? [],
      negativeMarkers: scene.negative_markers ?? [],
      roleTagIds: configuration?.ui.roleTagIds ?? {},
    });

    negativeMarkers.forEach((marker) => {
      const warnings = warningCalculator.findGapWarnings({
        id: marker.id,
        seconds: marker.start_seconds,
        end_seconds: marker.end_seconds,
      });
      const warningMessages = [
        warnings?.previous &&
          formatNegativeMarkerGapWarning("Previous", warnings.previous),
        warnings?.next && formatNegativeMarkerGapWarning("Next", warnings.next),
      ].filter((message): message is string => !!message);

      if (warningMessages.length > 0) {
        warningsById.set(marker.id, warningMessages);
      }
    });

    return warningsById;
  }, [
    configuration?.ui.roleTagIds,
    negativeMarkers,
    scene.negative_markers,
    scene.scene_markers,
  ]);

  const onOpenEditor = useCallback((marker?: GQL.SceneNegativeMarker) => {
    setIsEditorOpen(true);
    setEditingMarker(marker ?? undefined);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingMarker(undefined);
    setIsEditorOpen(false);
  }, []); // CUSTOM: mutations update the normalized scene cache directly

  // Set up hotkeys
  useEffect(() => {
    if (!isVisible) return;

    Mousetrap.bind("n", () => onOpenEditor());

    return () => {
      Mousetrap.unbind("n");
    };
  }, [isVisible, onOpenEditor]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await destroyMarker({ variables: { id } });
      } catch (e) {
        console.error("Failed to delete negative marker", e);
      }
    },
    [destroyMarker]
  );

  if (isEditorOpen) {
    return (
      <SceneNegativeMarkerForm
        sceneID={scene.id}
        marker={editingMarker}
        sceneMarkers={scene.scene_markers}
        negativeMarkers={scene.negative_markers}
        onClose={closeEditor}
        onAddNextMarker={onAddNextMarker} // CUSTOM
        markerTimestampCopyRequest={markerTimestampCopyRequest} // CUSTOM
        markerTimestampCopySelection={markerTimestampCopySelection} // CUSTOM
        onMarkerTimestampCopyRequest={onMarkerTimestampCopyRequest} // CUSTOM
        onMarkerTimestampCopySelectionHandled={
          onMarkerTimestampCopySelectionHandled
        } // CUSTOM
      />
    );
  }

  return (
    <div className="scene-negative-markers-panel">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center" style={{ gap: "0.75rem" }}>
          <Button onClick={() => onOpenEditor()}>
            <FormattedMessage id="actions.add" defaultMessage="Add" />
          </Button>
        </div>
        {negativeMarkers.length > 0 && (
          <span className="text-muted">
            <FormattedMessage
              id="negative_markers_total_time"
              defaultMessage="Total skipped time: {duration}"
              values={{
                duration: TextUtils.formatDurationRange(totalSkippedSeconds),
              }}
            />
          </span>
        )}
      </div>

      <p className="text-muted mb-3">
        <FormattedMessage
          id="negative_markers_description"
          defaultMessage="Negative markers define time ranges that will be automatically skipped during playback."
        />
      </p>

      <div className="container">
        {negativeMarkers.length === 0 ? (
          <div className="text-center text-muted py-4">
            <FormattedMessage
              id="no_negative_markers"
              defaultMessage="No negative markers. Click 'Add' to create one."
            />
          </div>
        ) : (
          <div className="negative-markers-list">
            {negativeMarkers.map((marker) => {
              const warningMessages =
                negativeMarkerWarningsById.get(marker.id) ?? [];

              return (
                <div
                  key={marker.id}
                  className="negative-marker-item d-flex align-items-center justify-content-between py-2 px-3 mb-2"
                  style={{
                    background: "rgba(220, 53, 69, 0.1)",
                    borderLeft: "3px solid #dc3545",
                    borderRadius: "4px",
                  }}
                >
                  <div
                    className="d-flex align-items-center"
                    style={{ gap: "1rem" }}
                  >
                    <span
                      className="negative-marker-time text-danger"
                      style={{ fontFamily: "monospace", minWidth: "120px" }}
                    >
                      {TextUtils.secondsToTimestamp(marker.start_seconds)} →{" "}
                      {TextUtils.secondsToTimestamp(marker.end_seconds)}
                    </span>
                    <span className="negative-marker-name">
                      {marker.name || (
                        <span className="text-muted">(unnamed)</span>
                      )}
                    </span>
                    {warningMessages.length > 0 && (
                      <Icon
                        icon={faExclamationTriangle}
                        className="scene-marker-warning-icon"
                        title={warningMessages.join("\n")}
                      />
                    )}
                  </div>
                  <div className="d-flex" style={{ gap: "0.5rem" }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenEditor(marker)}
                      title="Edit"
                    >
                      <Icon icon={faEdit} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(marker.id)}
                      title="Delete"
                    >
                      <Icon icon={faTrash} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneNegativeMarkersPanel;
