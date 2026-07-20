import React from "react";
import ReactDOM from "react-dom";
import CryptoJS from "crypto-js";
import { ROLE_COLORS_CUSTOM } from "src/utils/roleColors_custom";
import {
  formatActivityPieSliceTooltip,
  getActivityPieTooltipPosition,
} from "./activityPieChartTooltip_custom";

export const ACTIVITY_PIE_COLORS = {
  sex: "#d9822b",
  oral: "#00b3a4",
  solo: "#8a9ba8",
  other: "#8a9ba8",
  outstanding: "#ffd700",
  standard: "#28a745",
  unusable: "#dc3545",
  top: ROLE_COLORS_CUSTOM.top.color,
  bottom: ROLE_COLORS_CUSTOM.bottom.color,
};

function semanticMarkerTagColorCustom(tag: string): string | undefined {
  const normalized = tag.toLocaleLowerCase();

  if (
    /\b(bj|blow\s*job|blowjob|blow\w*|oral|suck\w*|fellatio)\b/.test(normalized)
  ) {
    return "#14b8d4cc";
  }

  if (/\b(fuck\w*|sex|anal|penetrat\w*|intercourse)\b/.test(normalized)) {
    return "#ff7a00cc";
  }

  return undefined;
}

function computeMarkerBaseHueCustom(tag: string): number {
  const hash = CryptoJS.SHA256(tag);
  const hashHex = hash.toString(CryptoJS.enc.Hex);
  const hashInt = BigInt(`0x${hashHex}`);
  return Number(hashInt % BigInt(360));
}

function calculateMarkerHueDeltaMinCustom(tagCount: number): number {
  const maxDeltaNeeded = 35;
  let scalingFactor: number;

  if (tagCount <= 4) {
    scalingFactor = 0.8;
  } else if (tagCount <= 10) {
    scalingFactor = 0.6;
  } else {
    scalingFactor = 0.4;
  }

  return Math.min((360 / tagCount) * scalingFactor, maxDeltaNeeded);
}

function adjustMarkerHuesCustom(baseHues: Record<string, number>) {
  const adjustedHues: Record<string, number> = {};
  const tags = Object.keys(baseHues);
  const tagCount = tags.length;
  const deltaMin = calculateMarkerHueDeltaMinCustom(tagCount);

  const sortedTags = tags.sort((a, b) => baseHues[a] - baseHues[b]);
  const unwrappedHues = sortedTags.map((tag) => baseHues[tag]);

  for (let i = 1; i < tagCount; i += 1) {
    if (unwrappedHues[i] <= unwrappedHues[i - 1]) {
      unwrappedHues[i] += 360;
    }
  }

  for (let i = 1; i < tagCount; i += 1) {
    const requiredHue = unwrappedHues[i - 1] + deltaMin;
    if (unwrappedHues[i] < requiredHue) {
      unwrappedHues[i] = requiredHue;
    }
  }

  const endGap = unwrappedHues[0] + 360 - unwrappedHues[tagCount - 1];
  if (endGap < deltaMin) {
    const adjustmentNeeded = (deltaMin - endGap) / 2;
    unwrappedHues[0] = Math.max(
      unwrappedHues[0] - adjustmentNeeded,
      unwrappedHues[1] - 360 + deltaMin
    );
    unwrappedHues[tagCount - 1] += adjustmentNeeded;
  }

  const adjustedHueList = unwrappedHues.map((hue) => hue % 360);
  for (let i = 0; i < tagCount; i += 1) {
    adjustedHues[sortedTags[i]] = adjustedHueList[i];
  }

  return adjustedHues;
}

function markerHsvToRgbCustom(h: number, s: number, v: number) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

function markerColorHexCustom(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function hueToMarkerColorCustom(hue: number): string {
  let remappedHue = 30 + (hue % 360) * (300 / 360);
  const goldStart = 45;
  const goldEnd = 65;

  if (remappedHue >= goldStart && remappedHue < goldEnd) {
    remappedHue = goldEnd;
  } else if (remappedHue >= goldEnd) {
    remappedHue -= goldEnd - goldStart;
  }

  const rgb = markerHsvToRgbCustom(remappedHue / 360, 0.65, 0.95);
  const alpha = Math.round(0.6 * 255);
  return `#${markerColorHexCustom(
    Math.round(rgb[0] * 255)
  )}${markerColorHexCustom(Math.round(rgb[1] * 255))}${markerColorHexCustom(
    Math.round(rgb[2] * 255)
  )}${markerColorHexCustom(alpha)}`;
}

function getAdjustedMarkerHueCustom(tagName: string, tagNames?: string[]) {
  const uniqueTagNames = [...new Set([...(tagNames ?? []), tagName])].filter(
    (tag) => tag.length > 0
  );

  const baseHues = Object.fromEntries(
    uniqueTagNames.map((tag) => [tag, computeMarkerBaseHueCustom(tag)])
  );

  return adjustMarkerHuesCustom(baseHues)[tagName];
}

export function getSceneMarkerTagColorCustom(
  tagName?: string | null,
  tagNames?: string[]
): string {
  if (!tagName) return ACTIVITY_PIE_COLORS.solo;
  return (
    semanticMarkerTagColorCustom(tagName) ??
    hueToMarkerColorCustom(getAdjustedMarkerHueCustom(tagName, tagNames))
  );
}

export interface IActivityPieSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  percentLabel?: string;
  sliceLabel?: string;
  valueLabel?: string;
  active?: boolean;
  onClick?: () => void;
}

interface IProps {
  title: string;
  slices: IActivityPieSlice[];
  centerLabel?: string;
  className?: string;
  footer?: React.ReactNode;
  showLegend?: boolean;
  size?: number;
}

let nextActivityPieChartID = 0;

function createActivityPieChartID() {
  nextActivityPieChartID += 1;
  return nextActivityPieChartID;
}

interface IActivityPieTooltipState {
  above: boolean;
  content: string;
  key: string;
  x: number;
  y: number;
}

function formatSlicePercent(value: number, total: number) {
  if (total <= 0) return "0%";

  const percentage = (value / total) * 100;
  if (percentage > 0 && percentage < 1) return "<1%";

  return `${Math.round(percentage)}%`;
}

function onSliceKeyDown(
  event: React.KeyboardEvent<SVGCircleElement>,
  onClick: (() => void) | undefined
) {
  if (!onClick) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  onClick();
}

export const ActivityPieChart: React.FC<IProps> = ({
  title,
  slices,
  centerLabel,
  className,
  footer,
  showLegend = true,
  size = 160,
}) => {
  const [chartID] = React.useState(createActivityPieChartID);
  const [sliceTooltip, setSliceTooltip] = React.useState<
    IActivityPieTooltipState | undefined
  >();
  const visibleSlices = slices.filter((slice) => slice.value > 0);
  const total = visibleSlices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const labelRadius = 35;
  let runningOffset = 0;
  const chartSlices = visibleSlices.map((slice) => {
    const sliceLength = (slice.value / total) * circumference;
    const dashOffset = -runningOffset;
    const startRatio = runningOffset / circumference;
    const midRatio = startRatio + sliceLength / circumference / 2;
    const midAngle = midRatio * 2 * Math.PI - Math.PI / 2;
    runningOffset += sliceLength;

    return {
      ...slice,
      dashOffset,
      labelX: 50 + Math.cos(midAngle) * labelRadius,
      labelY: 50 + Math.sin(midAngle) * labelRadius,
      percentLabel:
        slice.percentLabel ?? formatSlicePercent(slice.value, total),
      sliceLabel:
        slice.sliceLabel ??
        slice.valueLabel ??
        slice.percentLabel ??
        formatSlicePercent(slice.value, total),
      sliceLength,
    };
  });

  if (total <= 0) return null;

  function showSliceTooltip(
    key: string,
    content: string,
    clientX: number,
    clientY: number
  ) {
    const position = getActivityPieTooltipPosition(
      clientX,
      clientY,
      window.innerWidth,
      window.innerHeight
    );
    setSliceTooltip({ content, key, ...position });
  }

  return (
    <div
      className={`activity-pie-chart${className ? ` ${className}` : ""}`}
      style={{ width: size }}
    >
      <div className="activity-pie-chart-title">{title}</div>
      <svg
        aria-label={title}
        className="activity-pie-chart-svg"
        role="img"
        viewBox="0 0 100 100"
      >
        <circle
          className="activity-pie-chart-track"
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          strokeWidth="20"
        />
        {chartSlices.map((slice) => {
          const tooltip = formatActivityPieSliceTooltip(slice);
          const tooltipID = `activity-pie-${chartID}-${slice.key}-tooltip`;

          return (
            <circle
              aria-describedby={
                sliceTooltip?.key === slice.key ? tooltipID : undefined
              }
              aria-label={tooltip}
              className={`activity-pie-chart-slice${
                slice.onClick ? " activity-pie-chart-slice-clickable" : ""
              }${
                slice.active ? " activity-pie-chart-slice-active" : ""
              } activity-pie-chart-slice--${slice.key}`}
              cx="50"
              cy="50"
              fill="none"
              key={slice.key}
              onBlur={() => setSliceTooltip(undefined)}
              onClick={slice.onClick}
              onFocus={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                showSliceTooltip(
                  slice.key,
                  tooltip,
                  bounds.left + bounds.width / 2,
                  bounds.top + bounds.height / 2
                );
              }}
              onKeyDown={(event) => onSliceKeyDown(event, slice.onClick)}
              onMouseEnter={(event) =>
                showSliceTooltip(
                  slice.key,
                  tooltip,
                  event.clientX,
                  event.clientY
                )
              }
              onMouseLeave={() => setSliceTooltip(undefined)}
              onMouseMove={(event) =>
                showSliceTooltip(
                  slice.key,
                  tooltip,
                  event.clientX,
                  event.clientY
                )
              }
              r={radius}
              role={slice.onClick ? "button" : undefined}
              stroke={slice.color}
              strokeDasharray={`${slice.sliceLength} ${circumference}`}
              strokeDashoffset={slice.dashOffset}
              strokeWidth="20"
              tabIndex={0}
              transform="rotate(-90 50 50)"
            />
          );
        })}
        {chartSlices.map((slice) => (
          <text
            className="activity-pie-chart-percent-label"
            dominantBaseline="middle"
            key={`${slice.key}-label`}
            textAnchor="middle"
            x={slice.labelX}
            y={slice.labelY}
          >
            {slice.sliceLabel}
          </text>
        ))}
        {centerLabel && (
          <text
            className="activity-pie-chart-center-label"
            dominantBaseline="middle"
            textAnchor="middle"
            x="50"
            y="50"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      {showLegend && (
        <div className="activity-pie-chart-legend">
          {visibleSlices.map((slice) => {
            const legendLabel =
              slice.valueLabel ?? formatSlicePercent(slice.value, total);
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`activity-pie-chart-legend-swatch activity-pie-chart-legend-swatch--${slice.key}`}
                  style={{ backgroundColor: slice.color }}
                />
                <span className="activity-pie-chart-legend-label">
                  {slice.label}
                </span>
                <span className="activity-pie-chart-legend-value">
                  {legendLabel}
                </span>
              </>
            );

            if (slice.onClick) {
              return (
                <button
                  className={`activity-pie-chart-legend-item activity-pie-chart-legend-button${
                    slice.active
                      ? " activity-pie-chart-legend-button-active"
                      : ""
                  }`}
                  key={slice.key}
                  onClick={slice.onClick}
                  type="button"
                >
                  {content}
                </button>
              );
            }

            return (
              <div className="activity-pie-chart-legend-item" key={slice.key}>
                {content}
              </div>
            );
          })}
        </div>
      )}
      {footer && <div className="activity-pie-chart-footer">{footer}</div>}
      {sliceTooltip &&
        ReactDOM.createPortal(
          <div
            className="activity-pie-chart-cursor-tooltip tooltip show"
            id={`activity-pie-${chartID}-${sliceTooltip.key}-tooltip`}
            role="tooltip"
            style={{
              left: sliceTooltip.x,
              pointerEvents: "none",
              position: "fixed",
              top: sliceTooltip.y,
              transform: sliceTooltip.above ? "translateY(-100%)" : undefined,
              zIndex: 1080,
            }}
          >
            <div className="tooltip-inner">{sliceTooltip.content}</div>
          </div>,
          document.body
        )}
    </div>
  );
};
