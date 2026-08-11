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
  onSelect: (boundary: SceneMarkerTimestampBoundary, seconds: number) => void;
}

export const SceneMarkerTimestampCopyPopover: React.FC<
  ISceneMarkerTimestampCopyPopoverProps
> = ({ marker, onSelect }) => {
  const options = getSceneMarkerTimestampOptions(marker);
  const startTimestamp = TextUtils.secondsToTimestamp(marker.seconds, true);
  const endTimestamp =
    marker.end_seconds !== null && marker.end_seconds !== undefined
      ? TextUtils.secondsToTimestamp(marker.end_seconds, true)
      : "No end time";

  return (
    <div className="scene-marker-timestamp-picker">
      <div className="scene-marker-timestamp-picker-title">
        {marker.title || marker.primary_tag?.name || "Untitled marker"}
      </div>
      <div className="scene-marker-timestamp-picker-range">
        <span className="scene-marker-timestamp-picker-range-label">
          Marker range
        </span>
        <span className="scene-marker-timestamp-picker-range-value">
          {startTimestamp} – {endTimestamp}
        </span>
      </div>
      <div className="scene-marker-timestamp-picker-actions">
        {options.map((option) => (
          <button
            key={option.boundary}
            type="button"
            className={`scene-marker-timestamp-picker-option scene-marker-timestamp-picker-option-${option.boundary}`}
            aria-label={`Use marker ${option.label.toLowerCase()} time ${TextUtils.secondsToTimestamp(
              option.seconds,
              true
            )}`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(option.boundary, option.seconds);
            }}
          >
            <span className="scene-marker-timestamp-picker-option-label">
              {option.label}
            </span>
            <span className="scene-marker-timestamp-picker-option-time">
              {TextUtils.secondsToTimestamp(option.seconds, true)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
