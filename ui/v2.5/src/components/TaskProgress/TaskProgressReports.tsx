import React, { useState } from "react";
import { Alert, Button, Form, Nav, Table } from "react-bootstrap";
import ReactDatePicker from "react-datepicker";
import { FormattedNumber, useIntl } from "react-intl";
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
  previousTaskProgressReportPeriod,
  shiftTaskProgressReportPeriod,
  taskProgressReportDays,
  taskProgressReportPeriod,
  taskProgressReportRow,
} from "./taskProgressReports_custom";
import type {
  ITaskProgressReportHistoryDay,
  ITaskProgressReportRow,
  TaskProgressReportRange,
} from "./taskProgressReports_custom";
import {
  taskProgressDailyGoalState,
  useProgressText,
} from "./progressView_custom";
import { TaskProgressReportActivity } from "./TaskProgressReportActivity";

import "react-datepicker/dist/react-datepicker.css";

interface IReportItem extends ITaskProgressReportRow {
  id: string;
  name: string;
}

interface IReportScope {
  key: string;
  name: string;
  group: "overall" | "tracker" | "milestone";
  history: readonly ITaskProgressReportHistoryDay[];
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

const SignedPercent: React.FC<{ value: number }> = ({ value }) => (
  <FormattedNumber
    value={value / 100}
    style="percent"
    signDisplay="exceptZero"
    minimumFractionDigits={2}
    maximumFractionDigits={2}
  />
);

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
    <td className="progress-report-goal-cell">
      <span>
        <FormattedNumber value={item.completed} />
        {item.goalDays > 0 && (
          <>
            {" / "}
            <FormattedNumber value={item.expected} />
          </>
        )}
      </span>
      {item.goalDays > 0 && (
        <span className="progress-report-meter" aria-hidden="true">
          <span
            className={`progress-report-goal-${taskProgressDailyGoalState(
              item.completed,
              item.expected
            )}`}
            style={{
              width: `${Math.min(
                100,
                item.expected > 0 ? (item.completed / item.expected) * 100 : 0
              )}%`,
            }}
          />
        </span>
      )}
    </td>
    <td className="text-right">
      <SignedPercent value={item.advanced} />
    </td>
  </>
);

const ReportHeadings: React.FC<{ name: string; share?: boolean }> = ({
  name,
  share,
}) => {
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
        <th scope="col">{t("Actual / Goal")}</th>
        <th className="text-right" scope="col">
          {t("Advanced")}
        </th>
        {share && <th scope="col">{t("Share")}</th>}
      </tr>
    </thead>
  );
};

const ReportItemsSection: React.FC<{
  title: string;
  name: string;
  empty: string;
  idleLabels: readonly [string, string];
  items: readonly IReportItem[];
  idle: readonly string[];
  loading: boolean;
}> = ({ title, name, empty, idleLabels, items, idle, loading }) => {
  const t = useProgressText();
  const total = items.reduce((sum, item) => sum + item.completed, 0);
  return (
    <section aria-label={t(`${title} report`)}>
      <h4>{t(title)}</h4>
      {items.length > 0 ? (
        <div className="table-responsive">
          <Table striped hover>
            <ReportHeadings name={name} share />
            <tbody>
              {items.map((item) => {
                const share = total > 0 ? (item.completed / total) * 100 : 0;
                return (
                  <tr key={item.id}>
                    <th scope="row" className="font-weight-normal">
                      {item.name}
                    </th>
                    <ReportMetrics item={item} />
                    <td className="progress-report-share">
                      <span className="progress-report-meter">
                        <span style={{ width: `${share}%` }} />
                      </span>
                      {share.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      ) : (
        !loading && <p>{t(empty)}</p>
      )}
      {!loading && idle.length > 0 && (
        <details className="progress-report-idle">
          <summary>
            {idle.length} {t(idleLabels[idle.length === 1 ? 0 : 1])}
          </summary>
          <p>{idle.join(", ")}</p>
        </details>
      )}
    </section>
  );
};

const ReportDelta: React.FC<{ delta: number; text: string; label: string }> = ({
  delta,
  text,
  label,
}) => {
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <small
      className={`progress-report-delta progress-report-delta-${direction}`}
    >
      {direction === "up" ? "▲ " : direction === "down" ? "▼ " : "= "}
      {direction === "flat" ? "" : `${text} `}
      <span>{label}</span>
    </small>
  );
};

const ReportTiles: React.FC<{
  current: ITaskProgressReportRow;
  previous: ITaskProgressReportRow;
  comparison: string;
}> = ({ current, previous, comparison }) => {
  const t = useProgressText();
  const intl = useIntl();
  const completedDelta = current.completed - previous.completed;
  const advancedDelta = current.advanced - previous.advanced;
  const hasGoals = current.goalDays > 0 || previous.goalDays > 0;
  const tiles = [
    {
      label: "Items completed",
      value: <FormattedNumber value={current.completed} />,
      delta: completedDelta,
      text:
        previous.completed > 0
          ? `${Math.round(
              (Math.abs(completedDelta) / previous.completed) * 100
            )}%`
          : intl.formatNumber(Math.abs(completedDelta)),
    },
    {
      label: "Progress advanced",
      value: <SignedPercent value={current.advanced} />,
      delta: advancedDelta,
      text: `${intl.formatNumber(Math.abs(advancedDelta), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${t("pts")}`,
    },
    {
      label: "Goal days met",
      value:
        current.goalDays > 0
          ? `${current.goalDaysMet}/${current.goalDays}`
          : "—",
      delta: hasGoals ? current.goalDaysMet - previous.goalDaysMet : undefined,
      text: String(Math.abs(current.goalDaysMet - previous.goalDaysMet)),
    },
    {
      label: "Active days",
      value: `${current.activeDays}/${current.elapsedDays}`,
      delta: current.activeDays - previous.activeDays,
      text: String(Math.abs(current.activeDays - previous.activeDays)),
    },
  ];
  return (
    <div className="progress-report-tiles">
      {tiles.map((tile) => (
        <div className="progress-report-tile" key={tile.label}>
          <span>{t(tile.label)}</span>
          <strong>{tile.value}</strong>
          {tile.delta !== undefined && (
            <ReportDelta
              delta={tile.delta}
              text={tile.text}
              label={comparison}
            />
          )}
        </div>
      ))}
    </div>
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
  const [scopeKey, setScopeKey] = useState("overall");
  const period = taskProgressReportPeriod(range, anchor, today);
  const previousPeriod = previousTaskProgressReportPeriod(range, period, today);
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
  const milestoneList = milestones.data?.findTaskProgressMilestones ?? [];
  const firstActivity = firstTaskProgressReportActivity([
    ...trackers.map((tracker) => tracker.history),
    ...milestoneList.map((milestone) => milestone.history),
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
  const trackerItems: IReportItem[] = trackers.map((tracker) => ({
    id: tracker.id,
    name: tracker.title,
    ...taskProgressReportRow(tracker.history, period, today),
  }));
  const milestoneItems: IReportItem[] = milestoneList.map((milestone) => ({
    id: milestone.id,
    name: milestone.name,
    ...taskProgressReportRow(milestone.history, period, today),
  }));
  // Idle lists only name items that existed during the period.
  const idleTrackers = trackerItems
    .filter((item, index) => {
      const tracker = trackers[index];
      return (
        item.completed === 0 &&
        (tracker.status === "ACTIVE" || tracker.status === "PAUSED") &&
        tracker.history_started_on <= period.through
      );
    })
    .map((item) => item.name);
  const idleMilestones = milestoneItems
    .filter((item, index) => {
      const firstDay = milestoneList[index].history[0]?.date;
      return item.completed === 0 && !!firstDay && firstDay <= period.through;
    })
    .map((item) => item.name);
  const scopes: IReportScope[] = [
    ...(overall.data
      ? [
          {
            key: "overall",
            name: t("Organized scenes"),
            group: "overall" as const,
            history: overall.data.taskProgressOverall.history,
          },
        ]
      : []),
    ...trackers.map((tracker) => ({
      key: `tracker:${tracker.id}`,
      name: tracker.title,
      group: "tracker" as const,
      history: tracker.history,
    })),
    ...milestoneList.map((milestone) => ({
      key: `milestone:${milestone.id}`,
      name: milestone.name,
      group: "milestone" as const,
      history: milestone.history,
    })),
  ];
  const scope = scopes.find((item) => item.key === scopeKey) ?? scopes[0];
  const comparison = t(
    `vs ${period.through < period.end ? "same point " : ""}last ${range}`
  );
  const scopeGroups = [
    { group: "tracker", label: "Trackers" },
    { group: "milestone", label: "Milestones" },
  ] as const;
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
            onClick={() => setAnchor(today)}
          >
            {t("Current")}
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
      {loading && !scope && <p role="status">{t("Loading reports…")}</p>}
      {scope && (
        <section
          className="progress-report-overview"
          aria-label={t("Overview")}
        >
          <div className="progress-report-overview-heading">
            <h4>{t("Overview")}</h4>
            <Form.Group controlId="progress-report-scope">
              <Form.Label className="sr-only">{t("Show")}</Form.Label>
              <Form.Control
                as="select"
                value={scope.key}
                onChange={(event) => setScopeKey(event.target.value)}
              >
                {scopes
                  .filter((item) => item.group === "overall")
                  .map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.name}
                    </option>
                  ))}
                {scopeGroups.map(({ group, label }) => {
                  const options = scopes.filter((item) => item.group === group);
                  return options.length ? (
                    <optgroup key={group} label={t(label)}>
                      {options.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </Form.Control>
            </Form.Group>
          </div>
          <ReportTiles
            current={taskProgressReportRow(scope.history, period, today)}
            previous={taskProgressReportRow(
              scope.history,
              previousPeriod,
              today
            )}
            comparison={comparison}
          />
          <TaskProgressReportActivity
            range={range}
            days={taskProgressReportDays(scope.history, period, today)}
          />
        </section>
      )}
      <ReportItemsSection
        title="Trackers"
        name="Tracker"
        empty="No trackers advanced in this period."
        idleLabels={["tracker idle", "trackers idle"]}
        items={activeTaskProgressReportItems(trackerItems)}
        idle={idleTrackers}
        loading={loading}
      />
      <ReportItemsSection
        title="Milestones"
        name="Milestone"
        empty="No milestones advanced in this period."
        idleLabels={["milestone idle", "milestones idle"]}
        items={activeTaskProgressReportItems(milestoneItems)}
        idle={idleMilestones}
        loading={loading}
      />
    </div>
  );
};
