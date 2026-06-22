import React from "react";

export const ACTIVITY_PIE_COLORS = {
  sex: "#d9822b",
  oral: "#00b3a4",
  solo: "#ffd700",
  other: "#8a9ba8",
  unusable: "#dc3545",
  top: "#28a745",
  bottom: "#17a2b8",
};

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
        {chartSlices.map((slice) => (
          <circle
            aria-label={`${slice.label}: ${
              slice.valueLabel ?? slice.percentLabel
            }`}
            className={`activity-pie-chart-slice${
              slice.onClick ? " activity-pie-chart-slice-clickable" : ""
            }${slice.active ? " activity-pie-chart-slice-active" : ""}`}
            cx="50"
            cy="50"
            fill="none"
            key={slice.key}
            onClick={slice.onClick}
            onKeyDown={(event) => onSliceKeyDown(event, slice.onClick)}
            r={radius}
            role={slice.onClick ? "button" : undefined}
            stroke={slice.color}
            strokeDasharray={`${slice.sliceLength} ${circumference}`}
            strokeDashoffset={slice.dashOffset}
            strokeWidth="20"
            tabIndex={slice.onClick ? 0 : undefined}
            transform="rotate(-90 50 50)"
          />
        ))}
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
                  className="activity-pie-chart-legend-swatch"
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
    </div>
  );
};
