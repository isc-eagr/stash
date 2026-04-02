import React, { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import { SceneSelect, Scene } from "../SceneSelect";

interface ISceneSelectorDialogProps {
  onSelect: (sceneId: string) => void;
  onClose: () => void;
  excludeIds?: string[];
}

export const SceneSelectorDialog: React.FC<ISceneSelectorDialogProps> = ({
  onSelect,
  onClose,
  excludeIds = [],
}) => {
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);

  const handleConfirm = () => {
    if (selectedScene) {
      onSelect(selectedScene.id);
    }
  };

  return (
    <Modal show onHide={onClose} size="xl" dialogClassName="scene-selector-modal">
      <Modal.Header closeButton>
        <Modal.Title>Select Scene to Convert</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ minHeight: "400px" }}>
        <p className="text-muted mb-3">
          The selected scene will be converted into a release for the current scene.
          The original scene will be deleted and its data will be preserved as a release.
        </p>
        <SceneSelect
          onSelect={(scenes) => {
            if (scenes.length > 0) {
              setSelectedScene(scenes[0]);
            } else {
              setSelectedScene(null);
            }
          }}
          values={selectedScene ? [selectedScene] : []}
          excludeIds={excludeIds}
          isMulti={false}
          menuPortalTarget={document.body}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          <FormattedMessage id="actions.cancel" />
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!selectedScene}
        >
          Convert to Release
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SceneSelectorDialog;
