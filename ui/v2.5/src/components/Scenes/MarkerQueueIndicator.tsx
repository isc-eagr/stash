import React from "react";
import { Badge, Button, ButtonGroup } from "react-bootstrap";
import { useIntl } from "react-intl";
import { faList, faPlay, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { useMarkerQueue } from "src/hooks/MarkerQueue";

interface IMarkerQueueIndicatorProps {
  className?: string;
  /** Called when the + button is clicked. If provided, the + button will be shown. */
  onAddToQueue?: () => void;
  /** Number of items currently selected (for the + button tooltip) */
  selectedCount?: number;
}

export const MarkerQueueIndicator: React.FC<IMarkerQueueIndicatorProps> = ({
  className,
  onAddToQueue,
  selectedCount = 0,
}) => {
  const intl = useIntl();
  const { queue, count, clearQueue } = useMarkerQueue();

  const handlePlayQueue = () => {
    if (count === 0) return;

    // Store the queue markers in sessionStorage for the player
    sessionStorage.setItem("markerPlaylist", JSON.stringify(queue));

    // Build the IDs param
    const idsParam = queue.map((m) => m.id).join(",");
    window.open(`/scenes/markers/player?ids=${idsParam}`, "_blank");
  };

  const handleClearQueue = () => {
    clearQueue();
  };

  // Show the component if there's a queue OR if add button should be shown
  const showAddButton = onAddToQueue && selectedCount > 0;
  if (count === 0 && !showAddButton) {
    return null;
  }

  return (
    <ButtonGroup className={className}>
      {/* Add to queue button - shown when items are selected */}
      {showAddButton && (
        <Button
          variant="secondary"
          onClick={onAddToQueue}
          title={intl.formatMessage({ id: "actions.add_to_queue" })}
        >
          <Icon icon={faPlus} />
        </Button>
      )}
      {/* Queue count, play, clear - shown when queue has items */}
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
