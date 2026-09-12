import React from "react";
import TextUtils from "src/utils/text";
import {
  getSceneMarkerTimestampOptions,
  type SceneMarkerTimestampBoundary,
} from "./sceneMarkerTimestampCopy_custom";

interface ISceneMarkerTimestampCopyPopoverProps {
  marker: {
    title?: string | null;
    seconds: number;
    end_seconds?: number | null;
    primary_tag?: { name: string };
  };
  action?: "copy" | "seek";
  rangeSelectionActive?: boolean;
  onSelect: (boundary: SceneMarkerTimestampBoundary, seconds: number) => void;
}

export const SceneMarkerTimestampCopyPopover: React.FC<
  ISceneMarkerTimestampCopyPopoverProps
> = ({ marker, action = "copy", rangeSelectionActive = false, onSelect }) => {
  const options = getSceneMarkerTimestampOptions(marker);
  const actionLabel = action === "seek" ? "Seek to" : "Use";

  return (
    <div className="scene-marker-timestamp-picker">
      <div className="scene-marker-timestamp-picker-title">
        {marker.primary_tag?.name || marker.title || "Untitled marker"}
      </div>
      <div
        className="scene-marker-timestamp-picker-range"
        aria-label="Marker range"
      >
        {rangeSelectionActive ? (
          marker.end_seconds != null ? (
            <button
              type="button"
              className="scene-marker-timestamp-picker-chip scene-marker-timestamp-picker-chip-range"
              aria-label={`Use full marker range ${TextUtils.secondsToTimestamp(
                marker.seconds,
                true
              )} through ${TextUtils.secondsToTimestamp(
                marker.end_seconds,
                true
              )}`}
              title="Use full marker range"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect("range", marker.seconds);
              }}
            >
              Use full range
            </button>
          ) : (
            <span>This marker has no end time</span>
          )
        ) : (
          options.map((option, index) => (
            <React.Fragment key={option.boundary}>
              {index > 0 && (
                <span
                  className="scene-marker-timestamp-picker-range-divider"
                  aria-hidden="true"
                >
                  {"\u2013"}
                </span>
              )}
              <button
                type="button"
                className={`scene-marker-timestamp-picker-chip scene-marker-timestamp-picker-chip-${option.boundary}`}
                aria-label={`${actionLabel} marker ${option.label.toLowerCase()} time ${TextUtils.secondsToTimestamp(
                  option.seconds,
                  true
                )}`}
                title={`${actionLabel} marker ${option.label.toLowerCase()} time`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelect(option.boundary, option.seconds);
                }}
              >
                {TextUtils.secondsToTimestamp(option.seconds, true)}
              </button>
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
};
