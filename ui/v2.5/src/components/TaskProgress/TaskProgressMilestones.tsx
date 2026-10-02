import React, { useState } from "react";
import { Alert, Badge, Button, Card, Form } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import { useHistory, useLocation } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import type {
  TaskProgressMilestoneDataFragment as Milestone,
  TaskProgressTrackerDataFragment as Tracker,
} from "src/core/generated-graphql";
import { TaskProgressHistoryChart } from "../TaskProgressHistoryChart";
import { formatTaskProgressDate } from "../taskProgress_custom";
import { plannedTaskProgressFinishDate } from "./progressMath_custom";
import {
  itemLabels,
  progressToday,
  taskProgressHistoryEntries,
  useProgressText,
} from "./progressView_custom";
import { TaskProgressGoalSummary } from "./TaskProgressGoalSummary";
import { TaskProgressMilestoneForm } from "./TaskProgressMilestoneForm";
import type { IMilestoneFormValues } from "./TaskProgressMilestoneForm";
import { TaskProgressRing } from "./TaskProgressRing";
import {
  milestoneCheckpoints,
  milestoneForecast,
  milestoneFromSearch,
  milestoneItemProgress,
  milestoneSearch,
  milestoneTargetProgress,
  milestoneTrackerIdle,
  resolveMilestoneSelection,
} from "./milestoneView_custom";
import { TaskProgressPercentDelta } from "./TaskProgressDelta";
import { taskProgressPeriodComparisons } from "./taskProgressReports_custom";
import type {
  ITaskProgressPeriodComparison,
  TaskProgressComparisonPeriod,
} from "./taskProgressReports_custom";

const lastMilestoneKey = "task-progress-last-milestone";

type ContributionSortKey =
  | "title"
  | "completed"
  | "percent"
  | `${TaskProgressComparisonPeriod}${"Completed" | "Percent"}`;

const contributionPeriods: {
  key: TaskProgressComparisonPeriod;
  label: string;
}[] = [
  { key: "day", label: "today" },
  { key: "week", label: "this week" },
  { key: "month", label: "this month" },
];

/** Current and previous percentages for a "<period>Percent" column. */
function percentComparison(
  periods: Record<TaskProgressComparisonPeriod, ITaskProgressPeriodComparison>,
  key: string
) {
  const { current, previous, label } =
    periods[key.replace(/Percent$/, "") as TaskProgressComparisonPeriod];
  return { current: current.advanced, previous: previous.advanced, label };
}

interface IProps {
  trackers: readonly Tracker[];
  onOpenTracker: (id: string) => void;
  onRefreshTrackers: () => Promise<void>;
}

const MilestoneDashboard: React.FC<{
  milestone: Milestone;
  onOpenTracker: (id: string) => void;
}> = ({ milestone, onOpenTracker }) => {
  const t = useProgressText();
  const [contributionSort, setContributionSort] = useState<
    | {
        key: ContributionSortKey;
        direction: "ascending" | "descending";
      }
    | undefined
  >({ key: "weekPercent", direction: "descending" });
  const today = progressToday();
  const forecast = milestoneForecast(milestone, today);
  const target = milestoneTargetProgress(
    milestone,
    forecast.days >= 3 ? forecast.netRate : 0,
    today
  );
  const percentage =
    milestone.trackers.length === 0
      ? undefined
      : milestone.total_count === 0
      ? 100
      : Math.min(
          100,
          (milestone.completed_count / milestone.total_count) * 100
        );
  const planKey = `task-progress-milestone-plan-${milestone.id}`;
  const [planRate, setPlanRate] = useState(() => {
    try {
      return Math.max(0, Number(localStorage.getItem(planKey)) || 0);
    } catch {
      return 0;
    }
  });
  const plannedFinish = plannedTaskProgressFinishDate(
    milestone.current_count,
    planRate,
    today
  );
  const checkpoints = milestoneCheckpoints(
    milestone.history,
    percentage ?? 0,
    today
  );
  const itemProgress = milestoneItemProgress(milestone);
  const targetLabels: Record<NonNullable<typeof target>["state"], string> = {
    complete: "Complete",
    overdue: "Overdue",
    unavailable: "Pace unavailable",
    ahead: "Ahead",
    on_track: "On track",
    behind: "Behind",
  };
  const contributionHeaders: { key: ContributionSortKey; label: string }[] = [
    { key: "title", label: "Tracker" },
    { key: "completed", label: "Completed" },
    { key: "percent", label: "%" },
    ...contributionPeriods.flatMap(({ key, label }) => [
      { key: `${key}Completed` as const, label: `Completed ${label}` },
      { key: `${key}Percent` as const, label: `% ${label}` },
    ]),
  ];
  const contributionRows = milestone.trackers.map((tracker, index) => {
    const completed =
      tracker.mode === "FIXED"
        ? Math.max(0, tracker.goal - tracker.current_count)
        : tracker.completed_count;
    const total = completed + tracker.current_count;
    const periods = taskProgressPeriodComparisons(tracker.history, today);
    const values: Record<Exclude<ContributionSortKey, "title">, number> = {
      completed,
      percent: total === 0 ? 100 : (completed / total) * 100,
      dayCompleted: periods.day.current.completed,
      dayPercent: periods.day.current.advanced,
      weekCompleted: periods.week.current.completed,
      weekPercent: periods.week.current.advanced,
      monthCompleted: periods.month.current.completed,
      monthPercent: periods.month.current.advanced,
    };
    return {
      tracker,
      index,
      values,
      periods,
      idle: milestoneTrackerIdle(tracker, today),
    };
  });
  const topContributor = contributionRows.reduce<
    (typeof contributionRows)[number] | undefined
  >(
    (top, row) =>
      row.values.weekCompleted > (top?.values.weekCompleted ?? 0) ? row : top,
    undefined
  );
  const sortedContributionRows = [...contributionRows];
  if (contributionSort) {
    const { key } = contributionSort;
    sortedContributionRows.sort((a, b) => {
      const comparison =
        key === "title"
          ? a.tracker.title.localeCompare(b.tracker.title)
          : a.values[key] - b.values[key];
      if (comparison === 0) return a.index - b.index;
      return contributionSort.direction === "ascending"
        ? comparison
        : -comparison;
    });
  }
  const toggleContributionSort = (key: ContributionSortKey) => {
    setContributionSort((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  };

  return (
    <div className="milestone-dashboard">
      {milestone.trackers.length === 0 ? (
        <Card className="milestone-empty">
          <Card.Body>
            <h3>{milestone.name}</h3>
            <p>{t("Add trackers to see this milestone's progress.")}</p>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="progress-overall-card milestone-summary">
            <Card.Body>
              <div className="progress-card-visuals">
                <div className="progress-overall-overview">
                  <div className="progress-overall-heading">
                    <h3>{milestone.name}</h3>
                  </div>
                  <div className="progress-overall-summary">
                    {[
                      { label: "total", value: milestone.total_count },
                      { label: "completed", value: milestone.completed_count },
                      { label: "remaining", value: milestone.current_count },
                    ].map(({ label, value }) => (
                      <span key={label}>
                        <strong>
                          <FormattedNumber value={value} />
                        </strong>
                        <small>{t(label)}</small>
                      </span>
                    ))}
                  </div>
                  <TaskProgressGoalSummary
                    currentGoalPerDay={milestone.goal_per_day}
                    history={taskProgressHistoryEntries(milestone.history)}
                    comparisons={taskProgressPeriodComparisons(
                      milestone.history,
                      today
                    )}
                  />
                  <ul
                    className="milestone-checkpoints"
                    aria-label={t("Checkpoints")}
                  >
                    {checkpoints.map(({ threshold, date, reached }) => (
                      <li
                        className={`milestone-checkpoint${
                          reached ? " milestone-checkpoint-reached" : ""
                        }`}
                        key={threshold}
                      >
                        <strong>{threshold}%</strong>
                        <small>
                          {date
                            ? formatTaskProgressDate(date)
                            : t(reached ? "Reached" : "Not yet")}
                        </small>
                      </li>
                    ))}
                  </ul>
                </div>
                {percentage !== undefined && (
                  <TaskProgressRing
                    percentage={percentage}
                    label={t("Complete")}
                  />
                )}
                <div className="milestone-metrics">
                  {percentage !== undefined && (
                    <>
                      <div className="milestone-metric">
                        <span>{t("Percentage completed")}</span>
                        <strong>{percentage.toFixed(2)}%</strong>
                      </div>
                    </>
                  )}
                  <div className="milestone-metric">
                    <span>{t("Estimated pace")}</span>
                    <strong>
                      {forecast.days >= 3
                        ? forecast.completedRate.toFixed(1)
                        : "—"}{" "}
                      {t("completed")} / {t("day")}
                    </strong>
                  </div>
                  <div className="milestone-metric">
                    <span>{t("Estimated finish")}</span>
                    <strong>
                      {forecast.observed
                        ? formatTaskProgressDate(forecast.observed)
                        : "—"}
                    </strong>
                    {forecast.assumesNoIncoming && (
                      <small>{t("If no new items arrive")}</small>
                    )}
                  </div>
                  {milestone.target_date && target && (
                    <div className="milestone-metric">
                      <span>{t("Target date")}</span>
                      <strong>
                        {formatTaskProgressDate(milestone.target_date)}
                      </strong>
                      <small>
                        {t(targetLabels[target.state])}
                        {target.state !== "complete" &&
                          target.state !== "overdue" && (
                            <>
                              {" · "}
                              {t("Required pace")}: {target.requiredRate}{" "}
                              {t("items/day")}
                            </>
                          )}
                      </small>
                    </div>
                  )}
                  <Form.Group
                    controlId={`milestone-plan-${milestone.id}`}
                    className="milestone-metric milestone-rate"
                  >
                    <Form.Label>{t("Finish at items/day")}</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={1000000}
                      step={1}
                      value={planRate || ""}
                      onChange={(event) => {
                        const next = Math.max(
                          0,
                          Math.min(
                            1000000,
                            Math.floor(Number(event.target.value) || 0)
                          )
                        );
                        setPlanRate(next);
                        try {
                          localStorage.setItem(planKey, String(next));
                        } catch {
                          // The planner still works for this session.
                        }
                      }}
                    />
                    <strong className="milestone-rate-finish">
                      {plannedFinish
                        ? formatTaskProgressDate(plannedFinish)
                        : "—"}
                    </strong>
                  </Form.Group>
                </div>
              </div>
            </Card.Body>
          </Card>
          <section className="milestone-history">
            <h3>{t("Activity progression")}</h3>
            <TaskProgressHistoryChart
              title={milestone.name}
              history={taskProgressHistoryEntries(milestone.history)}
              today={today}
            />
          </section>
          {itemProgress.length > 0 && (
            <section className="milestone-item-counts">
              <h3>{t("Completed items")}</h3>
              <div>
                {itemProgress.map((item) => (
                  <span key={item.itemType}>
                    <span>
                      {t(itemLabels[item.itemType] ?? item.itemType)}{" "}
                      <strong>
                        <FormattedNumber value={item.completed} />
                      </strong>{" "}
                      / <FormattedNumber value={item.total} />
                    </span>
                    <span className="milestone-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${(item.completed / item.total) * 100}%`,
                        }}
                      />
                    </span>
                  </span>
                ))}
              </div>
            </section>
          )}
          <section className="milestone-contributions">
            <h3>{t("Trackers")}</h3>
            <div className="milestone-mobile-sort">
              <Form.Group controlId="milestone-mobile-sort" className="mb-0">
                <Form.Label>{t("Sort by")}</Form.Label>
                <Form.Control
                  as="select"
                  value={contributionSort?.key ?? ""}
                  onChange={(event) => {
                    const key = event.target.value as ContributionSortKey | "";
                    setContributionSort(
                      key ? { key, direction: "ascending" } : undefined
                    );
                  }}
                >
                  <option value="">{t("Tracker order")}</option>
                  {contributionHeaders.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {t(label)}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
              <Button
                aria-label={t("Reverse sort order")}
                disabled={!contributionSort}
                variant="secondary"
                onClick={() =>
                  setContributionSort((current) =>
                    current
                      ? {
                          ...current,
                          direction:
                            current.direction === "ascending"
                              ? "descending"
                              : "ascending",
                        }
                      : undefined
                  )
                }
              >
                {contributionSort?.direction === "descending" ? "↓" : "↑"}
              </Button>
            </div>
            <div
              className="milestone-contributions-table"
              role="table"
              aria-label={t("Tracker contributions")}
            >
              <div className="milestone-contributions-head" role="row">
                {contributionHeaders.map(({ key, label }) => (
                  <span
                    role="columnheader"
                    aria-sort={
                      contributionSort?.key === key
                        ? contributionSort.direction
                        : undefined
                    }
                    key={key}
                  >
                    <Button
                      className="milestone-sort-button"
                      variant="link"
                      type="button"
                      onClick={() => toggleContributionSort(key)}
                    >
                      {t(label)}
                      {contributionSort?.key === key && (
                        <span aria-hidden="true">
                          {contributionSort.direction === "ascending"
                            ? " ↑"
                            : " ↓"}
                        </span>
                      )}
                    </Button>
                  </span>
                ))}
              </div>
              {sortedContributionRows.map((row) => {
                const { tracker, values } = row;
                const top = row === topContributor;
                return (
                  <div
                    className={`milestone-contributions-row${
                      top ? " milestone-contributions-top" : ""
                    }${row.idle ? " milestone-contributions-idle" : ""}`}
                    role="row"
                    key={tracker.id}
                  >
                    {contributionHeaders.map(({ key, label }) => (
                      <span role="cell" data-label={t(label)} key={key}>
                        {key === "title" ? (
                          <>
                            <Button
                              variant="link"
                              onClick={() => onOpenTracker(tracker.id)}
                            >
                              {tracker.title}
                            </Button>
                            {top && (
                              <Badge variant="success">
                                {t("Top this week")}
                              </Badge>
                            )}
                          </>
                        ) : key === "percent" ? (
                          <span className="milestone-percent">
                            <span className="milestone-bar" aria-hidden="true">
                              <span
                                style={{
                                  width: `${Math.min(100, values.percent)}%`,
                                }}
                              />
                            </span>
                            {values.percent.toFixed(1)}%
                          </span>
                        ) : key.endsWith("Percent") ? (
                          <>
                            <FormattedNumber
                              maximumFractionDigits={2}
                              minimumFractionDigits={2}
                              signDisplay="exceptZero"
                              style="percent"
                              value={values[key] / 100}
                            />
                            <TaskProgressPercentDelta
                              {...percentComparison(row.periods, key)}
                              compact
                            />
                          </>
                        ) : (
                          <FormattedNumber value={values[key]} />
                        )}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export const TaskProgressMilestones: React.FC<IProps> = ({
  trackers,
  onOpenTracker,
  onRefreshTrackers,
}) => {
  const t = useProgressText();
  const history = useHistory();
  const location = useLocation();
  const query = GQL.useFindTaskProgressMilestonesQuery({
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [create] = GQL.useTaskProgressMilestoneCreateMutation();
  const [update] = GQL.useTaskProgressMilestoneUpdateMutation();
  const [destroy] = GQL.useTaskProgressMilestoneDestroyMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editor, setEditor] = useState<Milestone | "new">();
  const [rememberedID, setRememberedID] = useState(() => {
    try {
      return localStorage.getItem(lastMilestoneKey) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const milestones = query.data?.findTaskProgressMilestones ?? [];
  const explicitID = milestoneFromSearch(location.search);
  const selectedID = resolveMilestoneSelection(
    milestones.map((item) => item.id),
    explicitID,
    rememberedID
  );
  const selected = milestones.find((item) => item.id === selectedID);
  const select = (id: string) => {
    setRememberedID(id);
    try {
      localStorage.setItem(lastMilestoneKey, id);
    } catch {
      // URL selection still works when browser storage is unavailable.
    }
    history.push({ ...location, search: milestoneSearch(location.search, id) });
  };
  const run = async (action: () => Promise<string | undefined>) => {
    if (busy) return false;
    setBusy(true);
    setError(undefined);
    try {
      const id = await action();
      await query.refetch();
      if (id) select(id);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = (values: IMilestoneFormValues) =>
    run(async () => {
      if (editor && editor !== "new") {
        await update({
          variables: {
            input: {
              id: editor.id,
              expected_version: editor.version,
              name: values.name,
              target_date: values.target_date,
              goal_per_day: values.goal_per_day,
              tracker_ids: values.members_changed
                ? values.tracker_ids
                : undefined,
            },
          },
        });
        return editor.id;
      }
      const result = await create({
        variables: {
          input: {
            name: values.name,
            target_date: values.target_date || undefined,
            goal_per_day: values.goal_per_day || undefined,
            tracker_ids: values.tracker_ids,
          },
        },
      });
      return result.data?.taskProgressMilestoneCreate.id;
    });

  return (
    <>
      <div className="milestone-toolbar">
        <Form.Group controlId="milestone-selector" className="mb-0">
          <Form.Label>{t("Milestone")}</Form.Label>
          <Form.Control
            as="select"
            value={selected?.id ?? ""}
            onChange={(event) => select(event.target.value)}
            disabled={!milestones.length}
          >
            {!selected && <option value="">{t("Select a milestone")}</option>}
            {milestones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
        <div className="milestone-toolbar-actions">
          <Button
            variant="secondary"
            disabled={busy || query.loading}
            onClick={() => {
              void Promise.all([query.refetch(), onRefreshTrackers()]).catch(
                (failure) =>
                  setError(
                    failure instanceof Error ? failure.message : String(failure)
                  )
              );
            }}
          >
            {t("Refresh")}
          </Button>
          <Button
            variant="outline-primary"
            disabled={!selected || busy}
            onClick={() => setEditor(selected)}
          >
            {t("Edit")}
          </Button>
          <Button disabled={busy} onClick={() => setEditor("new")}>
            {t("Create milestone")}
          </Button>
        </div>
      </div>
      {(error || query.error) && (
        <Alert variant="danger" role="alert">
          {error ?? query.error?.message}
        </Alert>
      )}
      {query.loading && !query.data ? (
        <p role="status">{t("Loading milestones…")}</p>
      ) : !milestones.length ? (
        <p>{t("Create a milestone to group your trackers.")}</p>
      ) : selected ? (
        <MilestoneDashboard
          key={`milestone-dashboard-${selected.id}`}
          milestone={selected}
          onOpenTracker={onOpenTracker}
        />
      ) : (
        <p role="status">
          {t("This milestone is unavailable. Select another milestone.")}
        </p>
      )}
      {editor && (
        <TaskProgressMilestoneForm
          key={
            editor === "new"
              ? "milestone-editor-new"
              : `milestone-editor-${editor.id}`
          }
          milestone={editor === "new" ? undefined : editor}
          milestones={milestones}
          trackers={trackers}
          busy={busy}
          onClose={() => setEditor(undefined)}
          onSave={save}
          onDelete={
            editor === "new"
              ? undefined
              : () =>
                  run(async () => {
                    await destroy({ variables: { id: editor.id } });
                    history.replace({
                      ...location,
                      search: milestoneSearch(location.search),
                    });
                    if (rememberedID === editor.id) {
                      setRememberedID(undefined);
                      try {
                        localStorage.removeItem(lastMilestoneKey);
                      } catch {
                        /* unavailable */
                      }
                    }
                    return undefined;
                  })
          }
        />
      )}
    </>
  );
};
