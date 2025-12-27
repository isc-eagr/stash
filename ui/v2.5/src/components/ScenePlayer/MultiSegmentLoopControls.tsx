import React, { useEffect, useState, useRef } from "react";
import {
  Button,
  ButtonGroup,
  Collapse,
  Form,
  InputGroup,
} from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import {
  faPlus,
  faTrash,
  faPlay,
  faStop,
  faClock,
  faArrowUp,
  faArrowDown,
  faSave,
  faFolderOpen,
  faTimes,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import TextUtils from "src/utils/text";
import type { ILoopSegment } from "./multi-segment-loop";
import cx from "classnames";

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
  presetNames?: string[];
  onSavePreset?: (name: string) => void;
  onLoadPreset?: (name: string) => void;
  onDeletePreset?: (name: string) => void;
  onClose?: () => void;
  collapsed?: boolean;
  isFullscreen?: boolean;
}

export const MultiSegmentLoopControls: React.FC<
  IMultiSegmentLoopControlsProps
> = ({
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
  presetNames = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onClose,
  collapsed = true,
  isFullscreen = false,
}) => {
  const intl = useIntl();
  const [presetsExpanded, setPresetsExpanded] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const saveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedPreset((prev) => {
      if (!presetNames.length) return "";
      if (prev && presetNames.includes(prev)) return prev;
      return ""; // Keep None selected by default
    });
  }, [presetNames]);

  useEffect(() => {
    if (showSaveInput && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSaveInput]);

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

  const handleSavePreset = () => {
    if (!onSavePreset || !savePresetName.trim()) return;
    onSavePreset(savePresetName.trim());
    setSavePresetName("");
    setShowSaveInput(false);
  };

  const handleLoadPreset = () => {
    if (!onLoadPreset || !selectedPreset) return;
    onLoadPreset(selectedPreset);
  };

  const handleDeletePreset = () => {
    if (!onDeletePreset || !selectedPreset) return;
    const ok = window.confirm(
      intl.formatMessage(
        { id: "multi_segment_loop.delete_preset_confirm" },
        { name: selectedPreset }
      )
    );
    if (ok) {
      onDeletePreset(selectedPreset);
    }
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSavePreset();
    } else if (e.key === "Escape") {
      setShowSaveInput(false);
      setSavePresetName("");
    }
  };

  const content = (
    <div
      className={cx("multi-segment-loop-controls-v2", {
        "modal-mode": !collapsed && onClose,
      })}
    >
      {/* Header */}
      <div className="msl-header">
        <span className="msl-title">
          <FormattedMessage id="multi_segment_loop.title" />
          {segments.length > 0 && (
            <span className="msl-count">({segments.length})</span>
          )}
        </span>
        {onClose && (
          <Button
            variant="link"
            size="sm"
            onClick={onClose}
            className="msl-close-btn"
            title={intl.formatMessage({ id: "actions.close" })}
          >
            <Icon icon={faTimes} />
          </Button>
        )}
      </div>

      {/* Main Actions Row */}
      <div className="msl-main-actions">
        <Button
          variant={pendingStart !== null ? "warning" : "outline-secondary"}
          size="sm"
          onClick={onMarkPoint}
          className="msl-add-btn"
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
            {pendingStart !== null
              ? formatTime(pendingStart)
              : intl.formatMessage({ id: "multi_segment_loop.add" })}
          </span>
        </Button>
        {pendingStart !== null && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onCancelPending}
          >
            <Icon icon={faTimes} />
          </Button>
        )}
        <Button
          variant={enabled ? "success" : "outline-secondary"}
          size="sm"
          onClick={onToggleEnabled}
          disabled={segments.length === 0}
          className="msl-toggle-btn"
          title={intl.formatMessage({
            id: enabled
              ? "multi_segment_loop.disable"
              : "multi_segment_loop.enable",
          })}
        >
          <Icon icon={enabled ? faStop : faPlay} />
          <span className="ml-1">
            {enabled
              ? intl.formatMessage({ id: "multi_segment_loop.on" })
              : intl.formatMessage({ id: "multi_segment_loop.off" })}
          </span>
        </Button>
        {segments.length > 0 && (
          <Button
            variant="outline-danger"
            size="sm"
            onClick={onClearSegments}
            title={intl.formatMessage({ id: "multi_segment_loop.clear_all" })}
          >
            <Icon icon={faTrash} />
          </Button>
        )}
      </div>

      {/* Segment List */}
      {segments.length > 0 && (
        <div className="msl-segment-list">
          <div className="msl-segment-list-header">
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
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className={cx("msl-segment-row", {
                "msl-segment-active": enabled && index === currentSegmentIndex,
              })}
              onClick={() => onJumpToSegment(index)}
            >
              <span className="msl-segment-num">{index + 1}</span>
              <span className="msl-segment-times">
                <span
                  className={cx("msl-time", {
                    clickable: !!onUpdateSegmentStart,
                  })}
                  onClick={(e) => {
                    if (onUpdateSegmentStart) {
                      e.stopPropagation();
                      onUpdateSegmentStart(segment.id);
                    }
                  }}
                  title={
                    onUpdateSegmentStart
                      ? intl.formatMessage({
                          id: "multi_segment_loop.click_to_set_start",
                        })
                      : undefined
                  }
                >
                  {formatTime(segment.start)}
                </span>
                <span className="msl-time-sep">–</span>
                <span
                  className={cx("msl-time", {
                    clickable: !!onUpdateSegmentEnd,
                  })}
                  onClick={(e) => {
                    if (onUpdateSegmentEnd) {
                      e.stopPropagation();
                      onUpdateSegmentEnd(segment.id);
                    }
                  }}
                  title={
                    onUpdateSegmentEnd
                      ? intl.formatMessage({
                          id: "multi_segment_loop.click_to_set_end",
                        })
                      : undefined
                  }
                >
                  {formatTime(segment.end)}
                </span>
              </span>
              <span className="msl-segment-duration">
                ({formatTime(getSegmentDuration(segment))})
              </span>
              <div className="msl-segment-actions">
                <Button
                  variant="link"
                  size="sm"
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
                  size="sm"
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
                  size="sm"
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
              </div>
            </div>
          ))}
        </div>
      )}

      {segments.length === 0 && (
        <div className="msl-empty">
          <small className="text-muted">
            <FormattedMessage id="multi_segment_loop.no_segments" />
          </small>
        </div>
      )}

      {/* Presets Section (Collapsible) */}
      {(segments.length > 0 || presetNames.length > 0) && (
        <div className="msl-presets-section">
          <Button
            variant="link"
            size="sm"
            className="msl-presets-toggle"
            onClick={() => setPresetsExpanded(!presetsExpanded)}
          >
            <Icon icon={presetsExpanded ? faChevronDown : faChevronRight} />
            <span className="ml-1">
              <FormattedMessage id="multi_segment_loop.presets" />
              {presetNames.length > 0 && (
                <span className="msl-preset-count">({presetNames.length})</span>
              )}
            </span>
          </Button>

          <Collapse in={presetsExpanded}>
            <div className="msl-presets-content">
              {/* Save preset */}
              {segments.length > 0 && onSavePreset && (
                <div className="msl-preset-save">
                  {showSaveInput ? (
                    <InputGroup size="sm">
                      <Form.Control
                        ref={saveInputRef}
                        type="text"
                        placeholder={intl.formatMessage({
                          id: "multi_segment_loop.preset_name_placeholder",
                        })}
                        value={savePresetName}
                        onChange={(e) => setSavePresetName(e.target.value)}
                        onKeyDown={handleSaveKeyDown}
                      />
                      <Button
                        variant="success"
                        onClick={handleSavePreset}
                        disabled={!savePresetName.trim()}
                      >
                        <Icon icon={faSave} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={() => {
                          setShowSaveInput(false);
                          setSavePresetName("");
                        }}
                      >
                        <Icon icon={faTimes} />
                      </Button>
                    </InputGroup>
                  ) : (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setShowSaveInput(true)}
                      className="w-100"
                    >
                      <Icon icon={faSave} />
                      <span className="ml-1">
                        <FormattedMessage id="multi_segment_loop.save_config" />
                      </span>
                    </Button>
                  )}
                </div>
              )}

              {/* Load/Delete preset */}
              {presetNames.length > 0 && (
                <div className="msl-preset-load">
                  <Form.Control
                    as="select"
                    size="sm"
                    value={selectedPreset}
                    onChange={(e) => {
                      const name = e.target.value;
                      setSelectedPreset(name);
                      if (onLoadPreset && name) {
                        onLoadPreset(name);
                      }
                    }}
                    className="msl-preset-select"
                  >
                    <option value="">
                      {intl.formatMessage({
                        id: "none",
                        defaultMessage: "None",
                      })}
                    </option>
                    {presetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Form.Control>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleDeletePreset}
                    disabled={!onDeletePreset || !selectedPreset}
                    title={intl.formatMessage({ id: "actions.delete" })}
                  >
                    <Icon icon={faTrash} />
                  </Button>
                </div>
              )}

              {presetNames.length === 0 && (
                <small className="text-muted d-block text-center mt-2">
                  <FormattedMessage id="multi_segment_loop.no_saved_configs" />
                </small>
              )}
            </div>
          </Collapse>
        </div>
      )}
    </div>
  );

  if (!collapsed && onClose) {
    return (
      <>
        <div
          className={cx("multi-segment-loop-modal-backdrop", {
            "fullscreen-mode": isFullscreen,
          })}
          onClick={onClose}
        />
        <div
          className={cx("multi-segment-loop-modal-container", {
            "fullscreen-mode": isFullscreen,
          })}
        >
          {content}
        </div>
      </>
    );
  }

  return content;
};

export default MultiSegmentLoopControls;
