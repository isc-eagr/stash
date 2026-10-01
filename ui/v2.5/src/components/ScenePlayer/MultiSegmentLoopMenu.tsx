import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import cx from "classnames";
import type { VideoJsPlayer } from "video.js";
import {
  faBackwardStep,
  faForwardStep,
  faPlus,
  faRepeat,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import type { IMultiSegmentLoopController } from "./useMultiSegmentLoop_custom";
import type { IMultiSegmentLoopPresets } from "./useMultiSegmentLoopPresets_custom";
import { useMultiSegmentLoopConfirm } from "./MultiSegmentLoopConfirm";
import { formatLoopTime } from "./MultiSegmentLoopEditor";

// The player's loop button and its pop-up menu. Rendered inside the control
// bar so it stays available in fullscreen, like the playback-rate menu.
interface IMultiSegmentLoopMenuProps {
  player: VideoJsPlayer;
  container: HTMLElement;
  loop: IMultiSegmentLoopController;
  presets?: IMultiSegmentLoopPresets;
  fullscreen: boolean;
  onEditSegments: () => void;
}

export const MultiSegmentLoopMenu: React.FC<IMultiSegmentLoopMenuProps> = ({
  player,
  container,
  loop,
  presets,
  fullscreen,
  onEditSegments,
}) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { confirm, confirmModal } = useMultiSegmentLoopConfirm(
    fullscreen ? (player.el() as HTMLElement) : undefined
  );
  const { segments, enabled, currentSegmentIndex, pendingStart } = loop.state;
  const presetCount = presets?.presets.length ?? 0;
  const message = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `multi_segment_loop.${id}` }, values);

  // Close on outside clicks, Escape, and when the controls hide.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (container.contains(target)) return;
      if ((target as Element).closest?.(".modal")) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    player.on("userinactive", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      player.off("userinactive", close);
    };
  }, [container, open, player]);

  // Keep keys pressed inside the menu away from the player's hotkeys.
  useEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    const stop = (event: KeyboardEvent) => {
      if (event.key !== "Escape") event.stopPropagation();
    };
    menu.addEventListener("keydown", stop);
    return () => menu.removeEventListener("keydown", stop);
  }, [open]);

  function loadPreset(name: string) {
    if (!presets) return;
    if (!presets.replacesCurrentSegments(name)) {
      presets.load(name);
      return;
    }
    confirm({
      header: message("load_preset"),
      message: message("load_preset_confirm", {
        name,
        count: segments.length,
      }),
      confirmText: message("replace"),
      variant: "primary",
      onConfirm: () => presets.load(name),
    });
  }

  const status = segments.length
    ? enabled
      ? message("current_segment", {
          index: currentSegmentIndex + 1,
          count: segments.length,
        })
      : message("segment_count", { count: segments.length })
    : message("no_segments_short");

  return createPortal(
    <>
      <button
        type="button"
        className={cx("vjs-multi-segment-loop-btn", {
          active: enabled && segments.length > 0,
        })}
        title={message("menu_title")}
        aria-label={message("menu_title")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <Icon icon={faRepeat} />
        {presetCount > 0 && (
          <span
            className="vjs-multi-segment-badge"
            title={message("preset_count", { count: presetCount })}
          >
            {presetCount}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          className="vjs-multi-segment-loop-menu"
          role="dialog"
          aria-label={message("menu_title")}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="msl-menu-row">
            <Form.Check
              type="switch"
              id="multi-segment-loop-menu-enabled"
              label={message("loop")}
              checked={enabled}
              disabled={!segments.length}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                loop.setEnabled(event.target.checked)
              }
            />
            <span className="msl-menu-status">{status}</span>
          </div>
          <div className="msl-menu-row">
            <Button
              size="sm"
              variant="secondary"
              disabled={segments.length < 2}
              onClick={loop.previous}
              title={message("previous_segment")}
            >
              <Icon icon={faBackwardStep} />
            </Button>
            <Button
              size="sm"
              variant={pendingStart === null ? "primary" : "warning"}
              className="msl-menu-mark"
              onClick={loop.markPoint}
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
              <Button
                size="sm"
                variant="secondary"
                onClick={loop.cancelPending}
                title={intl.formatMessage({ id: "actions.cancel" })}
              >
                <Icon icon={faTimes} />
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={segments.length < 2}
              onClick={loop.next}
              title={message("next_segment")}
            >
              <Icon icon={faForwardStep} />
            </Button>
          </div>
          {presetCount > 0 && (
            <div className="msl-menu-presets">
              <div className="msl-menu-heading">{message("presets")}</div>
              {presets!.presets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="msl-menu-item"
                  onClick={() => loadPreset(preset.name)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="msl-menu-item msl-menu-edit"
            onClick={() => {
              setOpen(false);
              onEditSegments();
            }}
          >
            {message("edit_segments")}
          </button>
        </div>
      )}
      {confirmModal}
    </>,
    container
  );
};
