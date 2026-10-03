import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, ButtonGroup, Form, InputGroup } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import cx from "classnames";
import {
  faArrowDown,
  faArrowUp,
  faPlus,
  faRedo,
  faStopwatch,
  faTimes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { useToast } from "src/hooks/Toast";
import TextUtils from "src/utils/text";
import type { ILoopSegment } from "./multi-segment-loop";
import type { IMultiSegmentLoopController } from "./useMultiSegmentLoop_custom";
import type { IMultiSegmentLoopPresets } from "./useMultiSegmentLoopPresets_custom";
import type { LoopSegmentEdge } from "./multiSegmentLoopState_custom";
import {
  useMultiSegmentLoopConfirm,
  type IMultiSegmentLoopConfirmRequest,
} from "./MultiSegmentLoopConfirm";
import {
  selectedMultiSegmentIdsToDelete,
  unselectedMultiSegmentIdsToDelete,
} from "./multiSegmentSelection_custom";

const formatLoopTime = (seconds: number) =>
  TextUtils.secondsToTimestamp(seconds, true);

const loopSegmentsDuration = (segments: ILoopSegment[]) =>
  segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0);

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

interface IMultiSegmentLoopEditorProps {
  loop: IMultiSegmentLoopController;
  presets?: IMultiSegmentLoopPresets;
  /** Hosts confirmation dialogs, e.g. a fullscreen element. */
  modalContainer?: HTMLElement | null;
}

export const MultiSegmentLoopEditor: React.FC<IMultiSegmentLoopEditorProps> = ({
  loop,
  presets,
  modalContainer,
}) => {
  const intl = useIntl();
  const Toast = useToast();
  const { confirm, confirmModal } = useMultiSegmentLoopConfirm(modalContainer);
  const { segments, enabled, currentSegmentIndex, loopSingleId, pendingStart } =
    loop.state;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // The last clicked row shows its time controls.
  const [focusedId, setFocusedId] = useState<string>();
  // The last loaded or saved preset; saving under its name needs no prompt.
  const [lastPresetName, setLastPresetName] = useState("");
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  // Drop selections and focus for segments that no longer exist.
  useEffect(() => {
    const ids = new Set(segments.map((segment) => segment.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
    setFocusedId((current) =>
      current && ids.has(current) ? current : undefined
    );
  }, [segments]);

  const totalDuration = useMemo(
    () => loopSegmentsDuration(segments),
    [segments]
  );
  const allSelected =
    segments.length > 0 && selectedIds.size === segments.length;
  const unsaved = presets?.hasUnsavedSegments ?? segments.length > 0;
  const message = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `multi_segment_loop.${id}` }, values);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  // Unsaved segments are the only thing a confirmation protects.
  function confirmIfUnsaved(
    request: Omit<IMultiSegmentLoopConfirmRequest, "onConfirm">,
    action: () => void
  ) {
    if (!unsaved) action();
    else confirm({ ...request, onConfirm: action });
  }

  function clearAll() {
    confirmIfUnsaved(
      {
        header: message("clear_all"),
        message: message("clear_all_confirm", { count: segments.length }),
        confirmText: message("clear_all"),
      },
      () => {
        loop.clear();
        setSelectedIds(new Set());
      }
    );
  }

  function loadPreset(name: string) {
    if (!presets) return;
    confirmIfUnsaved(
      {
        header: message("load_preset"),
        message: message("load_preset_confirm", {
          name,
          count: segments.length,
        }),
        confirmText: message("replace"),
        variant: "primary",
      },
      () => {
        if (!presets.load(name)) return;
        setLastPresetName(name);
        setPresetName(name);
      }
    );
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
    setLastPresetName(name);
    setPresetName(name);
  }

  function requestSavePreset() {
    const name = presetName.trim();
    if (!presets || !name || !segments.length) return;
    const existing = presets.find(name);
    if (!existing || sameName(existing.name, lastPresetName)) {
      void savePreset(existing?.name ?? name);
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

  function deletePreset(name: string) {
    if (!presets) return;
    confirm({
      header: message("delete_preset"),
      message: message("delete_preset_confirm", { name }),
      confirmText: intl.formatMessage({ id: "actions.delete" }),
      onConfirm: async () => {
        if (!(await presets.remove(name))) {
          Toast.error(message("delete_preset_failed"));
        } else if (sameName(name, lastPresetName)) {
          setLastPresetName("");
        }
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
    const focused = focusedId === segment.id;
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
            focused,
            selected: selectedIds.has(segment.id),
          })}
          onClick={() => {
            setFocusedId(segment.id);
            loop.jumpTo(index);
          }}
          title={message("row_hint")}
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
              onClick={stop(() => loop.seek(segment.start))}
              title={message("seek_start")}
            >
              {formatLoopTime(segment.start)}
            </Button>
            <span className="msl-row-separator">-</span>
            <Button
              variant="link"
              className="p-0"
              onClick={stop(() => loop.seek(segment.end))}
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
              variant="danger"
              onClick={stop(() => loop.removeSegments([segment.id]))}
              title={message("remove_segment")}
            >
              <Icon icon={faTrash} />
            </Button>
          </div>
        </div>
        {focused && (
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
              onClick={clearAll}
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
            <div className="msl-preset-chips">
              {presets.presets.map((preset) => (
                <ButtonGroup key={preset.name} size="sm">
                  <Button
                    variant={
                      presets.matchingPresetName === preset.name
                        ? "primary"
                        : "secondary"
                    }
                    disabled={!loop.ready}
                    onClick={() => loadPreset(preset.name)}
                    title={message("load_preset_hint", { name: preset.name })}
                  >
                    {preset.name}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => deletePreset(preset.name)}
                    title={message("delete_preset_hint", {
                      name: preset.name,
                    })}
                  >
                    <Icon icon={faTimes} />
                  </Button>
                </ButtonGroup>
              ))}
            </div>
          ) : (
            <div className="text-muted mb-2">{message("no_presets")}</div>
          )}
          {presets.canSave && (
            <InputGroup className="msl-preset-save">
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
