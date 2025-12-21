import React, { useState } from "react";
import { Button, ButtonGroup, ListGroup, Badge } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import {
  faPlus,
  faTrash,
  faPlay,
  faStop,
  faChevronUp,
  faChevronDown,
  faRepeat,
  faClock,
  faArrowUp,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
import TextUtils from "src/utils/text";
import type { ILoopSegment } from "./multi-segment-loop";

interface IMultiSegmentLoopControlsProps {
  segments: ILoopSegment[];
  enabled: boolean;
  currentSegmentIndex: number;
  pendingStart: number | null;
  onMarkPoint: () => void;
  onCancelPending: () => void;
  onToggleEnabled: () => void;
  onRemoveSegment: (id: string) => void;
  onClearSegments: () => void;
  onJumpToSegment: (index: number) => void;
  onReorderSegment: (fromIndex: number, toIndex: number) => void;
  onUpdateSegmentStart?: (id: string) => void;
  onUpdateSegmentEnd?: (id: string) => void;
  collapsed?: boolean;
}

export const MultiSegmentLoopControls: React.FC<IMultiSegmentLoopControlsProps> = ({
  segments,
  enabled,
  currentSegmentIndex,
  pendingStart,
  onMarkPoint,
  onCancelPending,
  onToggleEnabled,
  onRemoveSegment,
  onClearSegments,
  onJumpToSegment,
  onReorderSegment,
  onUpdateSegmentStart,
  onUpdateSegmentEnd,
  collapsed = true, // Default to collapsed
}) => {
  const intl = useIntl();
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  const formatTime = (seconds: number): string => {
    return TextUtils.secondsToTimestamp(seconds);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onReorderSegment(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < segments.length - 1) {
      onReorderSegment(index, index + 1);
    }
  };

  const getSegmentDuration = (segment: ILoopSegment): number => {
    return segment.end - segment.start;
  };

  const getTotalDuration = (): number => {
    return segments.reduce((sum, seg) => sum + getSegmentDuration(seg), 0);
  };

  if (!isExpanded) {
    return (
      <div className="multi-segment-loop-controls collapsed">
        <Button
          variant="link"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="expand-toggle"
          title={intl.formatMessage({ id: "multi_segment_loop.expand" })}
        >
          <Icon icon={faChevronDown} className="mr-1" />
          <Icon icon={faRepeat} />
          <span className="ml-1">
            <FormattedMessage id="multi_segment_loop.title" />
          </span>
          {segments.length > 0 && (
            <Badge variant="info" className="ml-2">
              {segments.length}
            </Badge>
          )}
          {enabled && (
            <Badge variant="success" className="ml-1">
              <FormattedMessage id="multi_segment_loop.on" />
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="multi-segment-loop-controls">
      <div className="multi-segment-loop-header">
        <Button
          variant="link"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="expand-toggle"
          title={intl.formatMessage({ id: "multi_segment_loop.expand" })}
        >
          <Icon icon={faChevronUp} className="mr-1" />
          <Icon icon={faRepeat} />
          <span className="ml-1">
            <FormattedMessage id="multi_segment_loop.title" />
          </span>
          {segments.length > 0 && (
            <Badge variant="info" className="ml-2">
              {segments.length}
            </Badge>
          )}
          {enabled && (
            <Badge variant="success" className="ml-1">
              <FormattedMessage id="multi_segment_loop.on" />
            </Badge>
          )}
        </Button>
      </div>

      <div className="multi-segment-loop-actions">
        <ButtonGroup size="sm" className="mb-2">
          <Button
            variant={pendingStart !== null ? "warning" : "primary"}
            onClick={onMarkPoint}
            title={
              pendingStart !== null
                ? intl.formatMessage(
                    { id: "multi_segment_loop.set_end" },
                    { start: formatTime(pendingStart) }
                  )
                : intl.formatMessage({ id: "multi_segment_loop.set_start" })
            }
          >
            <Icon icon={pendingStart !== null ? faClock : faPlus} />
            <span className="ml-1">
              {pendingStart !== null ? (
                <FormattedMessage
                  id="multi_segment_loop.set_end_short"
                  values={{ time: formatTime(pendingStart) }}
                />
              ) : (
                <FormattedMessage id="multi_segment_loop.add_segment" />
              )}
            </span>
          </Button>
          {pendingStart !== null && (
            <Button variant="secondary" onClick={onCancelPending}>
              <FormattedMessage id="actions.cancel" />
            </Button>
          )}
        </ButtonGroup>

        <ButtonGroup size="sm" className="mb-2 ml-2">
          <Button
            variant={enabled ? "success" : "outline-secondary"}
            onClick={onToggleEnabled}
            disabled={segments.length === 0}
            title={intl.formatMessage({
              id: enabled
                ? "multi_segment_loop.disable"
                : "multi_segment_loop.enable",
            })}
          >
            <Icon icon={enabled ? faStop : faPlay} />
            <span className="ml-1">
              <FormattedMessage
                id={
                  enabled
                    ? "multi_segment_loop.loop_on"
                    : "multi_segment_loop.loop_off"
                }
              />
            </span>
          </Button>
        </ButtonGroup>

        {segments.length > 0 && (
          <Button
            variant="outline-danger"
            size="sm"
            className="ml-2 mb-2"
            onClick={onClearSegments}
          >
            <Icon icon={faTrash} />
            <span className="ml-1">
              <FormattedMessage id="multi_segment_loop.clear_all" />
            </span>
          </Button>
        )}
      </div>

      {segments.length > 0 && (
        <>
          <div className="multi-segment-loop-summary">
            <small className="text-muted">
              <FormattedMessage
                id="multi_segment_loop.summary"
                values={{
                  count: segments.length,
                  duration: formatTime(getTotalDuration()),
                }}
              />
            </small>
          </div>

          <ListGroup className="multi-segment-loop-list">
            {segments.map((segment, index) => (
              <ListGroup.Item
                key={segment.id}
                className={`segment-item ${
                  enabled && index === currentSegmentIndex ? "active-segment" : ""
                }`}
                action
                onClick={() => onJumpToSegment(index)}
              >
                <div className="segment-info">
                  <span className="segment-number">{index + 1}.</span>
                  <span className="segment-times">
                    <span
                      className={onUpdateSegmentStart ? "clickable-time" : ""}
                      onClick={(e) => {
                        if (onUpdateSegmentStart) {
                          e.stopPropagation();
                          onUpdateSegmentStart(segment.id);
                        }
                      }}
                      title={onUpdateSegmentStart ? intl.formatMessage({ id: "multi_segment_loop.click_to_set_start" }) : undefined}
                    >
                      {formatTime(segment.start)}
                    </span>
                    {" - "}
                    <span
                      className={onUpdateSegmentEnd ? "clickable-time" : ""}
                      onClick={(e) => {
                        if (onUpdateSegmentEnd) {
                          e.stopPropagation();
                          onUpdateSegmentEnd(segment.id);
                        }
                      }}
                      title={onUpdateSegmentEnd ? intl.formatMessage({ id: "multi_segment_loop.click_to_set_end" }) : undefined}
                    >
                      {formatTime(segment.end)}
                    </span>
                  </span>
                  <span className="segment-duration">
                    ({formatTime(getSegmentDuration(segment))})
                  </span>
                </div>
                <div className="segment-actions">
                  <ButtonGroup size="sm">
                    <Button
                      variant="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(index);
                      }}
                      disabled={index === 0}
                      title={intl.formatMessage({
                        id: "multi_segment_loop.move_up",
                      })}
                    >
                      <Icon icon={faArrowUp} />
                    </Button>
                    <Button
                      variant="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(index);
                      }}
                      disabled={index === segments.length - 1}
                      title={intl.formatMessage({
                        id: "multi_segment_loop.move_down",
                      })}
                    >
                      <Icon icon={faArrowDown} />
                    </Button>
                    <Button
                      variant="link"
                      className="text-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSegment(segment.id);
                      }}
                      title={intl.formatMessage({
                        id: "multi_segment_loop.remove_segment",
                      })}
                    >
                      <Icon icon={faTrash} />
                    </Button>
                  </ButtonGroup>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </>
      )}

      {segments.length === 0 && (
        <div className="multi-segment-loop-empty">
          <small className="text-muted">
            <FormattedMessage id="multi_segment_loop.no_segments" />
          </small>
        </div>
      )}
    </div>
  );
};

export default MultiSegmentLoopControls;
