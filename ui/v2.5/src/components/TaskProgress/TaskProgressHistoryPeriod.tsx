import React from "react";
import ReactDatePicker from "react-datepicker";
import {
  taskProgressISOToLocalDate,
  taskProgressLocalDateToISO,
} from "../taskProgress_custom";
import {
  boundedTaskProgressReportAnchor,
  shiftTaskProgressReportPeriod,
  taskProgressReportPeriod,
} from "./taskProgressReports_custom";
import type { TaskProgressReportRange } from "./taskProgressReports_custom";
import { useProgressText } from "./progressView_custom";

export const TaskProgressHistoryPeriod: React.FC<{
  range: TaskProgressReportRange;
  anchor: string;
  firstDate: string;
  today: string;
  onChange: (date: string) => void;
}> = ({ range, anchor, firstDate, today, onChange }) => {
  const t = useProgressText();
  const selected = taskProgressReportPeriod(range, anchor, today);
  const first = taskProgressReportPeriod(range, firstDate, today);
  const current = taskProgressReportPeriod(range, today, today);
  const select = (date: string) =>
    onChange(boundedTaskProgressReportAnchor(range, date, firstDate, today));
  return (
    <div className="task-progress-history-chart-period">
      <div className="task-progress-history-chart-toggle">
        <button
          type="button"
          disabled={selected.start <= first.start}
          onClick={() =>
            select(shiftTaskProgressReportPeriod(range, anchor, -1))
          }
        >
          {t("Previous")}
        </button>
        <button
          type="button"
          disabled={selected.start >= current.start}
          onClick={() => onChange(today)}
        >
          {t("Current")}
        </button>
        <button
          type="button"
          disabled={selected.start >= current.start}
          onClick={() =>
            select(shiftTaskProgressReportPeriod(range, anchor, 1))
          }
        >
          {t("Next")}
        </button>
      </div>
      <ReactDatePicker
        customInput={<input aria-label={t("Choose date")} />}
        className="form-control"
        selected={taskProgressISOToLocalDate(anchor)}
        onChange={(date) => {
          if (date) select(taskProgressLocalDateToISO(date));
        }}
        minDate={taskProgressISOToLocalDate(firstDate)}
        maxDate={taskProgressISOToLocalDate(today)}
        dateFormat={
          range === "year"
            ? "yyyy"
            : range === "month"
            ? "MM/yyyy"
            : "dd/MM/yyyy"
        }
        showMonthYearPicker={range === "month"}
        showYearPicker={range === "year"}
        showYearDropdown
        showMonthDropdown
      />
    </div>
  );
};
