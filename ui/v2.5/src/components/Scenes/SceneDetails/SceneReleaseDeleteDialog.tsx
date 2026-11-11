import React from "react";
import { Button, Modal } from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { useSceneReleaseDestroy } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { summarizeReleaseConversionCustom } from "./sceneReleaseConversionSummary_custom";

interface ISceneReleaseDeleteDialogProps {
  release: GQL.SceneDataFragment["releases"][number];
  onClose: (deleted: boolean) => void;
}

// Deleting a release drops its own markers and activity; its files return to
// the parent scene.
export const SceneReleaseDeleteDialog: React.FC<
  ISceneReleaseDeleteDialogProps
> = ({ release, onClose }) => {
  const Toast = useToast();
  const [destroyRelease, { loading }] = useSceneReleaseDestroy();
  const summary = summarizeReleaseConversionCustom(release);

  const onDelete = async () => {
    try {
      await destroyRelease({ variables: { input: { id: release.id } } });
      Toast.success("Release deleted");
      onClose(true);
    } catch (e) {
      Toast.error(e);
    }
  };

  return (
    <Modal show onHide={() => onClose(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Delete release</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>The release will be removed. Its files return to the main scene.</p>
        <p className="mb-0 text-warning">
          Also deleted: {release.scene_markers.length} markers · {summary.plays}{" "}
          plays · {summary.oEvents} O events, plus its tags and skip ranges. Use
          Convert to scene to keep them.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onClose(false)}>
          <FormattedMessage id="actions.cancel" />
        </Button>
        <Button variant="danger" disabled={loading} onClick={onDelete}>
          <FormattedMessage id="actions.delete" />
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
