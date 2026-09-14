import React from "react";
import { progressRingStrokeOffset } from "./progressMath_custom";

interface IProps {
  percentage: number;
  label: string;
}

const radius = 45;
const circumference = 2 * Math.PI * radius;

export const TaskProgressRing: React.FC<IProps> = ({ percentage, label }) => {
  const displayPercentage = Number.isFinite(percentage)
    ? Math.min(100, Math.max(0, percentage))
    : 0;

  return (
    <div
      aria-label={`${displayPercentage.toFixed(2)}% ${label}`}
      className="progress-ring"
      role="img"
    >
      <svg aria-hidden="true" viewBox="0 0 100 100">
        <circle className="progress-ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="progress-ring-value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={progressRingStrokeOffset(
            displayPercentage,
            circumference
          )}
        />
      </svg>
      <span className="progress-ring-text">
        <strong>{displayPercentage.toFixed(2)}%</strong>
        <small>{label}</small>
      </span>
    </div>
  );
};
