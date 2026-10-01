import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Form, InputGroup } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import cx from "classnames";
import {
  faArrowDown,
  faArrowUp,
  faEdit,
  faPlus,
  faRedo,
  faStopwatch,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { useToast } from "src/hooks/Toast";
import TextUtils from "src/utils/text";
import type { ILoopSegment } from "./multi-segment-loop";
import type { IMultiSegmentLoopController } from "./useMultiSegmentLoop_custom";
import type { IMultiSegmentLoopPresets } from "./useMultiSegmentLoopPresets_custom";
import type { LoopSegmentEdge } from "./multiSegmentLoopState_custom";
import { useMultiSegmentLoopConfirm } from "./MultiSegmentLoopConfirm";
import {
  selectedMultiSegmentIdsToDelete,
  unselectedMultiSegmentIdsToDelete,
} from "./multiSegmentSelection_custom";

export const formatLoopTime = (seconds: number) =>
  TextUtils.secondsToTimestamp(seconds, true);

export const loopSegmentsDuration = (segments: ILoopSegment[]) =>
  segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0);

interface IMultiSegmentLoopEditorProps {
  loop: IMultiSegmentLoopController;
  presets?: IMultiSegmentLoopPresets;
  onSeek?: (seconds: number) => void;
  /** Hosts confirmation dialogs, e.g. a fullscreen element. */
  modalContainer?: HTMLElement | null;
}

export const MultiSegmentLoopEditor: React.FC<IMultiSegmentLoopEditorProps> = ({
  loop,
  presets,
  onSeek,
  modalContainer,
}) => {
  const intl = useIntl();
  const Toast = useToast();
  const { confirm, confirmModal } = useMultiSegmentLoopConfirm(modalContainer);
  const { segments, enabled, currentSegmentIndex, loopSingleId, pendingStart } =
    loop.state;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string>();
  const [selectedPreset, setSelectedPreset] = useState("");
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  // Drop selections and edits for segments that no longer exist.
  useEffect(() => {
    const ids = new Set(segments.map((segment) => segment.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
    setEditingId((current) =>
      current && ids.has(current) ? current : undefined
    );
  }, [segments]);

  useEffect(() => {
    if (selectedPreset && !presets?.find(selectedPreset)) setSelectedPreset("");
  }, [presets, selectedPreset]);

  const seek = onSeek ?? loop.seek;
  const totalDuration = useMemo(
    () => loopSegmentsDuration(segments),
    [segments]
  );
  const allSelected =
    segments.length > 0 && selectedIds.size === segments.length;
  const message = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `multi_segment_loop.${id}` }, values);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function confirmClearAll() {
    confirm({
      header: message("clear_all"),
      message: message("clear_all_confirm", { count: segments.length }),
      confirmText: message("clear_all"),
      onConfirm: () => {
        loop.clear();
        setSelectedIds(new Set());
      },
    });
  }

  async function savePreset(name: string) {
    if (!presets) return;
    setSavingPreset(true);
    const saved = await presets.save(name);
    setSavingPreset(false);
    if (!saved) {
      Toast.error(message("save_preset_failed"));
      return;
    }
    setPresetName("");
    setSelectedPreset(name);
  }

  function requestSavePreset() {
    const name = presetName.trim();
    if (!presets || !name || !segments.length) return;
    const existing = presets.find(name);
    if (!existing) {
      void savePreset(name);
      return;
    }
    confirm({
      header: message("replace_preset"),
      message: message("replace_preset_confirm", { name: existing.name }),
      confirmText: message("replace"),
      variant: "primary",
      onConfirm: () => void savePreset(existing.name),
    });
  }

  function requestLoadPreset() {
    if (!presets || !selectedPreset) return;
    if (!presets.replacesCurrentSegments(selectedPreset)) {
      presets.load(selectedPreset);
      return;
    }
    confirm({
      header: message("load_preset"),
      message: message("load_preset_confirm", {
        name: selectedPreset,
        count: segments.length,
      }),
      confirmText: message("replace"),
      variant: "primary",
      onConfirm: () => presets.load(selectedPreset),
    });
  }

  function requestDeletePreset() {
    if (!presets || !selectedPreset) return;
    confirm({
      header: message("delete_preset"),
      message: message("delete_preset_confirm", { name: selectedPreset }),
      confirmText: intl.formatMessage({ id: "actions.delete" }),
      onConfirm: async () => {
        if (await presets.remove(selectedPreset)) setSelectedPreset("");
        else Toast.error(message("delete_preset_failed"));
      },
    });
  }

  const renderBoundaryEditor = (
    segment: ILoopSegment,
    edge: LoopSegmentEdge
  ) => (
    <div className="msl-boundary">
      <span className="msl-boundary-label">{message(edge)}</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => loop.nudgeBoundary(segment.id, edge, -1)}
        title={message(`${edge}_earlier`)}
      >
        {message("minus_one_second")}
      </Button>
      <span className="msl-boundary-time">{formatLoopTime(segment[edge])}</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => loop.nudgeBoundary(segment.id, edge, 1)}
        title={message(`${edge}_later`)}
      >
        {message("plus_one_second")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => loop.setBoundaryToCurrentTime(segment.id, edge)}
      >
        <Icon icon={faStopwatch} />
        <span className="ml-1">{message("use_current_time")}</span>
      </Button>
    </div>
  );

  const renderSegment = (segment: ILoopSegment, index: number) => {
    const active = enabled && index === currentSegmentIndex;
    const repeating = loopSingleId === segment.id;
    const editing = editingId === segment.id;
    const stop = (fn: () => void) => (event: React.MouseEvent) => {
      event.stopPropagation();
      fn();
    };

    return (
      <div key={segment.id} className="msl-segment">
        <div
          className={cx("msl-row", {
            active,
            repeating,
            selected: selectedIds.has(segment.id),
          })}
          onClick={() => loop.jumpTo(index)}
        >
          <Form.Check
            id={`msl-select-${segment.id}`}
            className="msl-row-select"
            checked={selectedIds.has(segment.id)}
            aria-label={message("select_segment", { index: index + 1 })}
            onClick={(event: React.MouseEvent) => event.stopPropagation()}
            onChange={() => toggleSelected(segment.id)}
          />
          <span className="msl-row-index">{index + 1}</span>
          <span className="msl-row-range">
            <Button
              variant="link"
              className="p-0"
              onClick={stop(() => seek(segment.start))}
              title={message("seek_start")}
            >
              {formatLoopTime(segment.start)}
            </Button>
            <span className="msl-row-separator">-</span>
            <Button
              variant="link"
              className="p-0"
              onClick={stop(() => seek(segment.end))}
              title={message("seek_end")}
            >
              {formatLoopTime(segment.end)}
            </Button>
          </span>
          <span className="msl-row-duration">
            {formatLoopTime(segment.end - segment.start)}
          </span>
          <span className="msl-row-title" title={segment.title}>
            {repeating && (
              <Badge variant="info" className="mr-1">
                {message("repeating")}
              </Badge>
            )}
            {segment.title}
          </span>
          <div className="msl-row-actions">
            <Button
              size="sm"
              variant={repeating ? "info" : "secondary"}
              onClick={stop(() => loop.toggleLoopSingle(segment.id))}
              title={message(repeating ? "stop_repeating" : "repeat_segment")}
              aria-pressed={repeating}
            >
              <Icon icon={faRedo} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={stop(() => loop.reorder(index, index - 1))}
              disabled={index === 0}
              title={message("move_up")}
            >
              <Icon icon={faArrowUp} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={stop(() => loop.reorder(index, index + 1))}
              disabled={index === segments.length - 1}
              title={message("move_down")}
            >
              <Icon icon={faArrowDown} />
            </Button>
            <Button
              size="sm"
              variant={editing ? "primary" : "secondary"}
              onClick={stop(() =>
                setEditingId(editing ? undefined : segment.id)
              )}
              title={message("edit_times")}
              aria-expanded={editing}
            >
              <Icon icon={faEdit} />
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={stop(() => loop.removeSegments([segment.id]))}
              title={message("remove_segment")}
            >
              <Icon icon={faTrash} />
            </Button>
          </div>
        </div>
        {editing && (
          <div className="msl-row-editor">
            {renderBoundaryEditor(segment, "start")}
            {renderBoundaryEditor(segment, "end")}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="multi-segment-loop-editor">
      <div className="msl-toolbar">
        <Form.Check
          type="switch"
          id="multi-segment-loop-enabled"
          label={message("loop")}
          checked={enabled}
          disabled={!segments.length}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            loop.setEnabled(event.target.checked)
          }
        />
        <Button
          variant={pendingStart === null ? "primary" : "warning"}
          onClick={loop.markPoint}
          disabled={!loop.ready}
          title={
            pendingStart === null
              ? message("mark_start_hint")
              : message("mark_end_hint", {
                  start: formatLoopTime(pendingStart),
                })
          }
        >
          <Icon icon={faPlus} />
          <span className="ml-1">
            {message(pendingStart === null ? "mark_start" : "mark_end")}
          </span>
        </Button>
        {pendingStart !== null && (
          <>
            <span className="text-muted">
              {message("pending_start", {
                start: formatLoopTime(pendingStart),
              })}
            </span>
            <Button variant="secondary" onClick={loop.cancelPending}>
              <FormattedMessage id="actions.cancel" />
            </Button>
          </>
        )}
        {segments.length > 0 && (
          <span className="msl-summary text-muted">
            {message("summary", {
              count: segments.length,
              duration: formatLoopTime(totalDuration),
            })}
          </span>
        )}
      </div>

      {segments.length === 0 ? (
        <div className="msl-empty text-muted">{message("no_segments")}</div>
      ) : (
        <div className="msl-list">
          <div className="msl-list-header">
            <Form.Check
              id="msl-select-all"
              className="msl-row-select"
              checked={allSelected}
              aria-label={message("select_all")}
              onChange={() =>
                setSelectedIds(
                  allSelected
                    ? new Set()
                    : new Set(segments.map((segment) => segment.id))
                )
              }
            />
            {selectedIds.size > 0 ? (
              <>
                <span>
                  {message("selected_count", { count: selectedIds.size })}
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    loop.removeSegments(
                      selectedMultiSegmentIdsToDelete(segments, selectedIds)
                    )
                  }
                >
                  {intl.formatMessage({ id: "actions.delete" })}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={allSelected}
                  onClick={() =>
                    loop.removeSegments(
                      unselectedMultiSegmentIdsToDelete(segments, selectedIds)
                    )
                  }
                >
                  {message("keep_selected")}
                </Button>
              </>
            ) : (
              <span className="text-muted">{message("segments")}</span>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={confirmClearAll}
            >
              {message("clear_all")}
            </Button>
          </div>
          {segments.map(renderSegment)}
        </div>
      )}

      {presets && (
        <div className="msl-presets">
          <h6>{message("presets")}</h6>
          {presets.presets.length > 0 ? (
            <div className="msl-preset-row">
              <Form.Control
                as="select"
                className="input-control"
                value={selectedPreset}
                onChange={(event) => setSelectedPreset(event.target.value)}
                aria-label={message("preset")}
              >
                <option value="">{message("select_preset")}</option>
                {presets.presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </Form.Control>
              <Button
                variant="secondary"
                disabled={!selectedPreset || !loop.ready}
                onClick={requestLoadPreset}
              >
                {intl.formatMessage({ id: "actions.load" })}
              </Button>
              <Button
                variant="danger"
                disabled={!selectedPreset}
                onClick={requestDeletePreset}
              >
                {intl.formatMessage({ id: "actions.delete" })}
              </Button>
            </div>
          ) : (
            <div className="text-muted mb-2">{message("no_presets")}</div>
          )}
          {presets.canSave && (
            <InputGroup className="msl-preset-row">
              <Form.Control
                className="input-control"
                value={presetName}
                placeholder={message("preset_name_placeholder")}
                onChange={(event) => setPresetName(event.target.value)}
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    requestSavePreset();
                  }
                }}
              />
              <InputGroup.Append>
                <Button
                  variant="primary"
                  disabled={
                    !presetName.trim() || !segments.length || savingPreset
                  }
                  onClick={requestSavePreset}
                  title={
                    segments.length ? undefined : message("save_needs_segments")
                  }
                >
                  {intl.formatMessage({ id: "actions.save" })}
                </Button>
              </InputGroup.Append>
            </InputGroup>
          )}
        </div>
      )}
      {confirmModal}
    </div>
  );
};
