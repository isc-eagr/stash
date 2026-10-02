import React from "react";
import { useIntl } from "react-intl";
import { useProgressText } from "./progressView_custom";

interface IDeltaProps {
  delta: number;
  text: string;
  /** Untranslated comparison label such as "vs last week". */
  label: string;
  /** Shows the label only as a tooltip, for tight table cells. */
  compact?: boolean;
}

export const TaskProgressDelta: React.FC<IDeltaProps> = ({
  delta,
  text,
  label,
  compact,
}) => {
  const t = useProgressText();
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <small
      className={`progress-delta progress-delta-${direction}`}
      title={compact ? t(label) : undefined}
    >
      {direction === "up" ? "▲ " : direction === "down" ? "▼ " : "="}
      {direction === "flat" ? "" : text}
      {!compact && <span> {t(label)}</span>}
    </small>
  );
};

interface ICompareProps {
  current: number;
  previous: number;
  label: string;
  compact?: boolean;
}

/** Item counts change as a percentage, or as a count when there was nothing before. */
export const TaskProgressItemsDelta: React.FC<ICompareProps> = ({
  current,
  previous,
  ...props
}) => {
  const intl = useIntl();
  const delta = current - previous;
  return (
    <TaskProgressDelta
      delta={delta}
      text={
        previous > 0
          ? `${Math.round((Math.abs(delta) / previous) * 100)}%`
          : intl.formatNumber(Math.abs(delta))
      }
      {...props}
    />
  );
};

/** Percentage values change by the difference between them, shown as %. */
export const TaskProgressPercentDelta: React.FC<ICompareProps> = ({
  current,
  previous,
  ...props
}) => {
  const intl = useIntl();
  const delta = current - previous;
  return (
    <TaskProgressDelta
      delta={delta}
      text={`${intl.formatNumber(Math.abs(delta), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`}
      {...props}
    />
  );
};
