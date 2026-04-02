import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import { SceneNegativeMarkerForm } from "./SceneNegativeMarkerForm";
import TextUtils from "src/utils/text";
import { Icon } from "src/components/Shared/Icon";
import { faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";

interface ISceneNegativeMarkersPanelProps {
  scene: GQL.SceneDataFragment;
  isVisible: boolean;
  onRefetch: () => void;
}

export const SceneNegativeMarkersPanel: React.FC<ISceneNegativeMarkersPanelProps> = ({
  scene,
  isVisible,
  onRefetch,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingMarker, setEditingMarker] = useState<GQL.SceneNegativeMarker>();
  const [destroyMarker] = GQL.useSceneNegativeMarkerDestroyMutation();

  const negativeMarkers = useMemo(() => {
    return [...(scene.negative_markers ?? [])].sort(
      (a, b) => a.start_seconds - b.start_seconds
    );
  }, [scene.negative_markers]);

  const onOpenEditor = useCallback((marker?: GQL.SceneNegativeMarker) => {
    setIsEditorOpen(true);
    setEditingMarker(marker ?? undefined);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingMarker(undefined);
    setIsEditorOpen(false);
    onRefetch();
  }, [onRefetch]);

  // Set up hotkeys
  useEffect(() => {
    if (!isVisible) return;

    Mousetrap.bind("n", () => onOpenEditor());

    return () => {
      Mousetrap.unbind("n");
    };
  }, [isVisible, onOpenEditor]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await destroyMarker({ variables: { id } });
      onRefetch();
    } catch (e) {
      console.error("Failed to delete negative marker", e);
    }
  }, [destroyMarker, onRefetch]);

  if (isEditorOpen) {
    return (
      <SceneNegativeMarkerForm
        sceneID={scene.id}
        marker={editingMarker}
        onClose={closeEditor}
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
            {negativeMarkers.map((marker) => (
              <div 
                key={marker.id} 
                className="negative-marker-item d-flex align-items-center justify-content-between py-2 px-3 mb-2"
                style={{ 
                  background: "rgba(220, 53, 69, 0.1)", 
                  borderLeft: "3px solid #dc3545",
                  borderRadius: "4px"
                }}
              >
                <div className="d-flex align-items-center" style={{ gap: "1rem" }}>
                  <span className="negative-marker-time text-danger" style={{ fontFamily: "monospace", minWidth: "120px" }}>
                    {TextUtils.secondsToTimestamp(marker.start_seconds)} → {TextUtils.secondsToTimestamp(marker.end_seconds)}
                  </span>
                  <span className="negative-marker-name">
                    {marker.name || <span className="text-muted">(unnamed)</span>}
                  </span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneNegativeMarkersPanel;
