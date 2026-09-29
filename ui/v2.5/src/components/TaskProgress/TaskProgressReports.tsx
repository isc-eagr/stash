import React, { useState } from "react";
import { Alert, Button, Form, Nav, Table } from "react-bootstrap";
import ReactDatePicker from "react-datepicker";
import { FormattedNumber } from "react-intl";
import {
  useFindTaskProgressMilestonesQuery,
  useTaskProgressOrganizedScenesQuery,
} from "src/core/generated-graphql";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import {
  formatTaskProgressDate,
  taskProgressISOToLocalDate,
  taskProgressLocalDateToISO,
} from "../taskProgress_custom";
import { progressToday } from "./progressMath_custom";
import {
  activeTaskProgressReportItems,
  boundedTaskProgressReportAnchor,
  firstTaskProgressReportActivity,
  shiftTaskProgressReportPeriod,
  taskProgressReportPeriod,
  taskProgressReportRow,
} from "./taskProgressReports_custom";
import type {
  ITaskProgressReportRow,
  TaskProgressReportRange,
} from "./taskProgressReports_custom";
import { useProgressText } from "./progressView_custom";

import "react-datepicker/dist/react-datepicker.css";

interface IReportItem extends ITaskProgressReportRow {
  id: string;
  name: string;
}

interface IProps {
  trackers: readonly Tracker[];
  trackersLoading: boolean;
  trackersError?: string;
}

const reportRanges = [
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
] as const;

const ReportMetrics: React.FC<{ item: ITaskProgressReportRow }> = ({
  item,
}) => (
  <>
    <td className="text-right">
      <FormattedNumber value={item.totalCompleted} />
    </td>
    <td className="text-right">
      {item.goalDays > 0 ? `${item.goalDaysMet}/${item.goalDays}` : "—"}
    </td>
    <td className="text-right">
      {item.goalDays > 0 ? <FormattedNumber value={item.expected} /> : "—"}
    </td>
    <td className="text-right">
      <FormattedNumber value={item.completed} />
    </td>
    <td className="text-right">
      <FormattedNumber
        value={item.advanced}
        signDisplay="always"
        minimumFractionDigits={2}
        maximumFractionDigits={2}
      />{" "}
      %
    </td>
  </>
);

const ReportHeadings: React.FC<{ name: string }> = ({ name }) => {
  const t = useProgressText();
  return (
    <thead>
      <tr>
        <th scope="col">{t(name)}</th>
        <th className="text-right" scope="col">
          {t("Total completed")}
        </th>
        <th className="text-right" scope="col">
          {t("Goal days met")}
        </th>
        <th className="text-right" scope="col">
          {t("Expected")}
        </th>
        <th className="text-right" scope="col">
          {t("Actual")}
        </th>
        <th className="text-right" scope="col">
          {t("Advanced")}
        </th>
      </tr>
    </thead>
  );
};

const ReportItemsSection: React.FC<{
  title: string;
  name: string;
  empty: string;
  items: readonly IReportItem[];
  loading: boolean;
}> = ({ title, name, empty, items, loading }) => {
  const t = useProgressText();
  return (
    <section aria-label={t(`${title} report`)}>
      <h4>{t(title)}</h4>
      {items.length > 0 ? (
        <div className="table-responsive">
          <Table striped hover>
            <ReportHeadings name={name} />
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="font-weight-normal">
                    {item.name}
                  </th>
                  <ReportMetrics item={item} />
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        !loading && <p>{t(empty)}</p>
      )}
    </section>
  );
};

export const TaskProgressReports: React.FC<IProps> = ({
  trackers,
  trackersLoading,
  trackersError,
}) => {
  const t = useProgressText();
  const today = progressToday();
  const [range, setRange] = useState<TaskProgressReportRange>("week");
  const [anchor, setAnchor] = useState(today);
  const period = taskProgressReportPeriod(range, anchor, today);
  const currentPeriod = taskProgressReportPeriod(range, today, today);
  const milestones = useFindTaskProgressMilestonesQuery({
    fetchPolicy: "network-only",
  });
  const overall = useTaskProgressOrganizedScenesQuery({
    fetchPolicy: "network-only",
  });
  const loading = trackersLoading || milestones.loading || overall.loading;
  const errors = [
    trackersError,
    milestones.error?.message,
    overall.error?.message,
  ].filter(Boolean);
  const firstActivity = firstTaskProgressReportActivity([
    ...trackers.map((tracker) => tracker.history),
    ...(milestones.data?.findTaskProgressMilestones ?? []).map(
      (milestone) => milestone.history
    ),
    overall.data?.taskProgressOverall.history ?? [],
  ]);
  const firstPeriod = taskProgressReportPeriod(
    range,
    firstActivity ?? today,
    today
  );
  const selectedYear = Number(period.start.slice(0, 4));
  const firstYear = Number((firstActivity ?? today).slice(0, 4));
  const currentYear = Number(today.slice(0, 4));
  const years = Array.from(
    { length: currentYear - firstYear + 1 },
    (_, index) => firstYear + index
  );
  const firstMonthStart = taskProgressReportPeriod(
    "month",
    firstActivity ?? today,
    today
  ).start;
  const currentMonthStart = taskProgressReportPeriod(
    "month",
    today,
    today
  ).start;
  const months = Array.from({ length: 12 }, (_, index) => index + 1).filter(
    (month) => {
      const candidate = `${selectedYear}-${String(month).padStart(2, "0")}-01`;
      const { start } = taskProgressReportPeriod("month", candidate, today);
      return start >= firstMonthStart && start <= currentMonthStart;
    }
  );
  const selectAnchor = (candidate: string) =>
    setAnchor(
      boundedTaskProgressReportAnchor(
        range,
        candidate,
        firstActivity ?? today,
        today
      )
    );
  const trackerItems: IReportItem[] = activeTaskProgressReportItems(
    trackers.map((tracker) => ({
      id: tracker.id,
      name: tracker.title,
      ...taskProgressReportRow(tracker.history, period, today),
    }))
  );
  const milestoneItems: IReportItem[] = activeTaskProgressReportItems(
    (milestones.data?.findTaskProgressMilestones ?? []).map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      ...taskProgressReportRow(milestone.history, period, today),
    }))
  );
  const overallRow = overall.data?.taskProgressOverall
    ? taskProgressReportRow(
        overall.data.taskProgressOverall.history,
        period,
        today
      )
    : undefined;
  return (
    <div className="progress-reports">
      <Nav
        variant="pills"
        activeKey={range}
        aria-label={t("Report period")}
        onSelect={(key) => {
          if (key === "week" || key === "month" || key === "year") {
            setRange(key);
            setAnchor(today);
          }
        }}
      >
        {reportRanges.map(({ key, label }) => (
          <Nav.Item key={key}>
            <Nav.Link eventKey={key}>{t(label)}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      <div className="progress-report-selectors">
        {range === "week" ? (
          <Form.Group controlId="progress-report-date">
            <Form.Label>{t("Choose date")}</Form.Label>
            <ReactDatePicker
              id="progress-report-date"
              className="form-control"
              selected={taskProgressISOToLocalDate(anchor)}
              onChange={(date) => {
                if (date) selectAnchor(taskProgressLocalDateToISO(date));
              }}
              minDate={taskProgressISOToLocalDate(firstActivity ?? today)}
              maxDate={taskProgressISOToLocalDate(today)}
              dateFormat="dd/MM/yyyy"
              showMonthDropdown
              showYearDropdown
              disabled={!firstActivity}
            />
          </Form.Group>
        ) : (
          <>
            {range === "month" && (
              <Form.Group controlId="progress-report-month">
                <Form.Label>{t("Month")}</Form.Label>
                <Form.Control
                  as="select"
                  value={Number(period.start.slice(5, 7))}
                  disabled={!firstActivity}
                  onChange={(event) =>
                    selectAnchor(
                      `${selectedYear}-${event.target.value.padStart(
                        2,
                        "0"
                      )}-01`
                    )
                  }
                >
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {new Intl.DateTimeFormat(undefined, {
                        month: "long",
                      }).format(new Date(2020, month - 1, 1))}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            )}
            <Form.Group controlId="progress-report-year">
              <Form.Label>{t("Year")}</Form.Label>
              <Form.Control
                as="select"
                value={selectedYear}
                disabled={!firstActivity}
                onChange={(event) => {
                  const month =
                    range === "month" ? period.start.slice(5, 7) : "01";
                  selectAnchor(`${event.target.value}-${month}-01`);
                }}
              >
                {[...years].reverse().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
          </>
        )}
      </div>
      <div className="progress-report-period">
        <div>
          <h3>
            {formatTaskProgressDate(period.start)} –{" "}
            {formatTaskProgressDate(period.end)}
          </h3>
          {period.through < period.end && (
            <small>
              {t("Through")} {formatTaskProgressDate(period.through)}
            </small>
          )}
        </div>
        <div className="progress-report-period-actions">
          <Button
            variant="secondary"
            disabled={!firstActivity || period.start <= firstPeriod.start}
            onClick={() =>
              selectAnchor(shiftTaskProgressReportPeriod(range, anchor, -1))
            }
          >
            {t("Previous")}
          </Button>
          <Button
            variant="secondary"
            disabled={period.start >= currentPeriod.start}
            onClick={() =>
              selectAnchor(shiftTaskProgressReportPeriod(range, anchor, 1))
            }
          >
            {t("Next")}
          </Button>
        </div>
      </div>
      {errors.length > 0 && (
        <Alert variant="danger" role="alert">
          {errors.join(" ")}
        </Alert>
      )}
      {loading && !overallRow && <p role="status">{t("Loading reports…")}</p>}
      <section aria-label={t("Overall report")}>
        <h4>{t("Overall")}</h4>
        {overallRow && (
          <div className="table-responsive">
            <Table striped hover>
              <ReportHeadings name="Scope" />
              <tbody>
                <tr>
                  <th scope="row" className="font-weight-normal">
                    {t("Organized scenes")}
                  </th>
                  <ReportMetrics item={overallRow} />
                </tr>
              </tbody>
            </Table>
          </div>
        )}
      </section>
      <ReportItemsSection
        title="Trackers"
        name="Tracker"
        empty="No trackers advanced in this period."
        items={trackerItems}
        loading={loading}
      />
      <ReportItemsSection
        title="Milestones"
        name="Milestone"
        empty="No milestones advanced in this period."
        items={milestoneItems}
        loading={loading}
      />
    </div>
  );
};
