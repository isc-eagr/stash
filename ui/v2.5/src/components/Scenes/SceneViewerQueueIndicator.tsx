import React, { useCallback } from "react";
import { Badge, Button, ButtonGroup } from "react-bootstrap";
import { useIntl } from "react-intl";
import {
  faList,
  faPlus,
  faThLarge,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { useSceneViewerQueue } from "src/hooks/SceneViewerQueue";
import * as GQL from "src/core/generated-graphql";

interface ISceneViewerQueueIndicatorProps {
  className?: string;
  selectedScenes: GQL.SlimSceneDataFragment[];
  onQueued?: () => void;
}

export const SceneViewerQueueIndicator: React.FC<
  ISceneViewerQueueIndicatorProps
> = ({ className, selectedScenes, onQueued }) => {
  const intl = useIntl();
  const { queue, count, addToQueue, clearQueue, isInQueue } =
    useSceneViewerQueue();

  const handleAddToQueue = useCallback(() => {
    const newScenes = selectedScenes.filter((scene) => !isInQueue(scene.id));
    if (newScenes.length === 0) return;

    addToQueue(newScenes);
    onQueued?.();
  }, [addToQueue, isInQueue, onQueued, selectedScenes]);

  const handleOpenViewer = useCallback(() => {
    if (count === 0) return;

    const idsParam = queue.map((scene) => scene.id).join(",");
    window.open(`/viewer?scenes=${idsParam}`, "_blank");
  }, [count, queue]);

  const hasSelection = selectedScenes.length > 0;
  const allSelectedInQueue =
    hasSelection && selectedScenes.every((scene) => isInQueue(scene.id));

  if (count === 0 && !hasSelection) {
    return null;
  }

  return (
    <ButtonGroup className={className}>
      {hasSelection && (
        <Button
          variant="secondary"
          onClick={handleAddToQueue}
          disabled={allSelectedInQueue}
          title={
            allSelectedInQueue
              ? intl.formatMessage({ id: "actions.all_in_queue" })
              : intl.formatMessage({ id: "actions.add_to_queue" })
          }
        >
          <Icon icon={faPlus} />
        </Button>
      )}
      {count > 0 && (
        <>
          <Button
            variant="secondary"
            title={intl.formatMessage({ id: "actions.queue_count" }, { count })}
            disabled
            className="queue-count-btn"
          >
            <Icon icon={faList} />
            <Badge variant="info" className="ml-1">
              {count}
            </Badge>
          </Button>
          <Button
            variant="secondary"
            onClick={handleOpenViewer}
            title={intl.formatMessage({
              id: "actions.open_viewer",
              defaultMessage: "Open viewer",
            })}
          >
            <Icon icon={faThLarge} />
          </Button>
          <Button
            variant="danger"
            onClick={clearQueue}
            title={intl.formatMessage({ id: "actions.clear_queue" })}
          >
            <Icon icon={faTimes} />
          </Button>
        </>
      )}
    </ButtonGroup>
  );
};

export default SceneViewerQueueIndicator;
