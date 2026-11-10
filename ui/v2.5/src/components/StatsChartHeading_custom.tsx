import React from "react";
import { statsUnitLabel } from "src/utils/statsBarChart_custom";

// CUSTOM: Every chart shows the same total, including an explicit zero.
export const StatsChartHeading: React.FC<{
  title: string;
  total: number;
  unit: [string, string];
  totalNote?: string;
  actions?: React.ReactNode;
  unknown?: React.ReactNode;
  formatValue?: (count: number) => string;
}> = ({ title, total, unit, totalNote, actions, unknown, formatValue }) => {
  const label = formatValue ? formatValue(total) : statsUnitLabel(total, unit);
  return (
    <div className="stats-bar-chart-heading">
      <div className="stats-bar-chart-title">
        <h3>{title}</h3>
        <span
          className="stats-bar-chart-total"
          title={totalNote}
          aria-label={`Total: ${label}${totalNote ? `. ${totalNote}` : ""}`}
        >
          {label}
          {totalNote ? " *" : ""}
        </span>
      </div>
      <div className="stats-bar-chart-actions">
        {actions}
        {unknown}
      </div>
    </div>
  );
};
