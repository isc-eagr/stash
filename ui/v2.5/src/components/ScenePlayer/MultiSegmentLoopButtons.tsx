import React from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";
import cx from "classnames";
import { faPen, faRepeat } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import type { IMultiSegmentLoopController } from "./useMultiSegmentLoop_custom";

// Control-bar buttons: one click toggles the loop, one opens its editor.
interface IMultiSegmentLoopButtonsProps {
  container: HTMLElement;
  loop: IMultiSegmentLoopController;
  presetCount: number;
  editorOpen: boolean;
  onEditorOpenChange: (open: boolean) => void;
}

export const MultiSegmentLoopButtons: React.FC<
  IMultiSegmentLoopButtonsProps
> = ({ container, loop, presetCount, editorOpen, onEditorOpenChange }) => {
  const intl = useIntl();
  const { enabled, segments } = loop.state;
  const message = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `multi_segment_loop.${id}` }, values);
  const toggleTitle = !segments.length
    ? message("add_segments")
    : message(enabled ? "turn_off" : "turn_on");

  return createPortal(
    <>
      <button
        type="button"
        className={cx("vjs-multi-segment-loop-btn", {
          active: enabled && segments.length > 0,
        })}
        title={toggleTitle}
        aria-label={toggleTitle}
        aria-pressed={enabled}
        onClick={(event) => {
          event.stopPropagation();
          // With nothing to loop yet, the editor is the useful next step.
          if (!segments.length) onEditorOpenChange(true);
          else loop.setEnabled(!enabled);
        }}
      >
        <Icon icon={faRepeat} />
      </button>
      <button
        type="button"
        className={cx("vjs-multi-segment-loop-btn", { open: editorOpen })}
        title={message("edit_segments")}
        aria-label={message("edit_segments")}
        aria-expanded={editorOpen}
        onClick={(event) => {
          event.stopPropagation();
          onEditorOpenChange(!editorOpen);
        }}
      >
        <Icon icon={faPen} />
        {presetCount > 0 && (
          <span
            className="vjs-multi-segment-badge"
            title={message("preset_count", { count: presetCount })}
          >
            {presetCount}
          </span>
        )}
      </button>
    </>,
    container
  );
};
