import React from "react";
import { FormattedNumber } from "react-intl";
import { useProgressText } from "./progressView_custom";

interface IProps {
  percent: React.ReactNode;
  done: number;
  /** Done count at the previous close, shown as previous → done. */
  previousDone?: number;
  left: number;
  leftLabel?: string;
  large?: boolean;
}

/** Percentage, done / total, and a left badge for the hero, trackers, and milestones. */
export const TaskProgressCounts: React.FC<IProps> = ({
  percent,
  done,
  previousDone,
  left,
  leftLabel = "left",
  large,
}) => {
  const t = useProgressText();

  return (
    <div
      className={`progress-score-figure${
        large ? " progress-score-figure-large" : ""
      }`}
    >
      {percent}
      <div className="progress-score-counts">
        {previousDone !== undefined && (
          <>
            <span className="progress-score-previous">
              <FormattedNumber value={previousDone} />
            </span>
            <span className="progress-score-previous" aria-hidden="true">
              →
            </span>
          </>
        )}
        <strong className="progress-score-done">
          <FormattedNumber value={done} />
        </strong>
        <span className="progress-score-total">
          / <FormattedNumber value={done + left} />
        </span>
        {left > 0 && (
          <span className="progress-score-left">
            <strong>
              <FormattedNumber value={left} />
            </strong>{" "}
            {t(leftLabel)}
          </span>
        )}
      </div>
    </div>
  );
};
