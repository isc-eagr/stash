import React, { useCallback } from "react";
import { Badge, Button, ButtonGroup } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import {
  faList,
  faPlay,
  faPlus,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { useImageQueue } from "src/hooks/ImageQueue";
import * as GQL from "src/core/generated-graphql";
import { useIntl } from "react-intl";

interface IImageQueueIndicatorProps {
  selectedImages: GQL.SlimImageDataFragment[];
  className?: string;
}

export const ImageQueueIndicator: React.FC<IImageQueueIndicatorProps> = ({
  selectedImages,
  className,
}) => {
  const intl = useIntl();
  const { queue, addToQueue, clearQueue, isInQueue } = useImageQueue();

  const handleAddToQueue = useCallback(() => {
    // Filter out images already in queue
    const newImages = selectedImages.filter((img) => !isInQueue(img.id));
    if (newImages.length > 0) {
      addToQueue(newImages);
    }
  }, [selectedImages, addToQueue, isInQueue]);

  const handlePlayQueue = useCallback(() => {
    if (queue.length === 0) return;

    const idsParam = queue.map((img) => img.id).join(",");
    window.open(`/viewer?images=${idsParam}`, "_blank");
  }, [queue]);

  const handleClearQueue = useCallback(() => {
    clearQueue();
  }, [clearQueue]);

  const hasSelection = selectedImages.length > 0;
  const hasQueue = queue.length > 0;

  // Check if all selected images are already in queue
  const allSelectedInQueue =
    hasSelection && selectedImages.every((img) => isInQueue(img.id));

  // Show the component if there's a queue OR if add button should be shown
  const showAddButton = hasSelection;
  if (queue.length === 0 && !showAddButton) {
    return null;
  }

  return (
    <ButtonGroup className={className}>
      {/* Add to queue button - shown when items are selected */}
      {showAddButton && (
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
      {/* Queue count, play, clear - shown when queue has items */}
      {hasQueue && (
        <>
          <Button
            variant="secondary"
            title={intl.formatMessage(
              { id: "actions.queue_count" },
              { count: queue.length }
            )}
            disabled
            className="queue-count-btn"
          >
            <Icon icon={faList} />
            <Badge variant="info" className="ml-1">
              {queue.length}
            </Badge>
          </Button>
          <Button
            variant="secondary"
            onClick={handlePlayQueue}
            title={intl.formatMessage({ id: "actions.play_queue" })}
          >
            <Icon icon={faPlay} />
          </Button>
          <Button
            variant="danger"
            onClick={handleClearQueue}
            title={intl.formatMessage({ id: "actions.clear_queue" })}
          >
            <Icon icon={faTimes} />
          </Button>
        </>
      )}
    </ButtonGroup>
  );
};

export default ImageQueueIndicator;
