import { formatAppDecimalCustom } from "src/utils/appLocale_custom"; // CUSTOM
import React, { useState } from "react";
import { Alert, Button, Card } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import { faFire } from "@fortawesome/free-solid-svg-icons";
import { useTaskProgressOrganizedScenesQuery } from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import { useProgressText, progressToday } from "./progressView_custom";
import { TaskProgressFinishLabel } from "./TaskProgressForecast";
import { TaskProgressMedalBar } from "./TaskProgressMedalBar";
import { TaskProgressPeriodTiles } from "./TaskProgressPeriodTiles";
import { progressLedgerSnapshot } from "./progressLedger_custom";
import {
  taskProgressReportPeriod,
  taskProgressPeriodComparisons,
} from "./taskProgressReports_custom";
import { taskProgressGoalStreak } from "./taskProgressScoreboard_custom"; // CUSTOM
import { TaskProgressOverallModal } from "./TaskProgressOverallModal";

export const TaskProgressOverall: React.FC = () => {
  const t = useProgressText();
  const query = useTaskProgressOrganizedScenesQuery({
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [showDetails, setShowDetails] = useState(false);
  const overall = query.data?.taskProgressOverall;
  const total = overall?.total_count;
  const done = overall?.organized_count;
  const remaining =
    total !== undefined && done !== undefined
      ? Math.max(0, total - done)
      : undefined;
  const today = progressToday();
  const history = overall?.history.map((day) => ({
    ...day,
    baselineCount: day.baseline_count ?? undefined,
    goalPerDay: day.goal_per_day,
    completedTotal: day.completed_total ?? undefined,
  }));
  const snapshot =
    overall && done !== undefined
      ? progressLedgerSnapshot(
          overall.history,
          taskProgressReportPeriod("week", today, today),
          today,
          { completed: done, remaining: remaining ?? 0 }
        )
      : undefined;
  const streak = history ? taskProgressGoalStreak(history, today) : 0;

  return (
    <>
      <Card className="progress-overall-card progress-score-hero">
        <div className="progress-score-hero-main">
          <div className="progress-score-hero-heading">
            <div>
              <h3>{t("Overall Progress")}</h3>
              <p>{t("Organized scenes")}</p>
            </div>
            <div className="progress-score-hero-chips">
              {overall && (
                <TaskProgressFinishLabel
                  storageKey="task-progress-overall-plan"
                  history={overall.history}
                  remaining={remaining ?? 0}
                  defaultRate={overall.goal_per_day || 10}
                />
              )}
              {streak >= 2 && (
                <span
                  className="progress-score-streak"
                  title={t("Consecutive days that met the daily goal")}
                >
                  <Icon icon={faFire} /> {streak}-{t("day streak")}
                </span>
              )}
              <Button
                size="sm"
                variant="primary"
                disabled={!overall}
                onClick={() => setShowDetails(true)}
              >
                {t("Details")}
              </Button>
            </div>
          </div>
          {query.error && (
            <Alert variant="warning">
              {t("Could not refresh organized scenes.")}{" "}
              <Button size="sm" onClick={() => void query.refetch()}>
                {t("Retry")}
              </Button>
            </Alert>
          )}
          {total === undefined || done === undefined || !snapshot ? (
            <p role="status">{t("Loading…")}</p>
          ) : (
            <>
              <div className="progress-score-hero-figure">
                <strong>{formatAppDecimalCustom(snapshot.percent, 2)}%</strong>
                <div className="progress-score-counts progress-score-counts-large">
                  <span className="progress-score-done">
                    <strong>
                      <FormattedNumber value={done} />
                    </strong>{" "}
                    {t("organized")}
                  </span>
                  <span>
                    <strong>
                      <FormattedNumber value={remaining ?? 0} />
                    </strong>{" "}
                    {t("to go")}
                  </span>
                </div>
              </div>
              <TaskProgressMedalBar
                large
                completed={done}
                total={total}
                percent={snapshot.percent}
                gain={snapshot.netCompletedGain}
                history={history ?? []}
              />
            </>
          )}
        </div>
        {overall && history && (
          <TaskProgressPeriodTiles
            variant="hero"
            comparisons={taskProgressPeriodComparisons(overall.history, today)}
            currentGoalPerDay={overall.goal_per_day}
            history={history}
          />
        )}
      </Card>
      {showDetails && overall && (
        <TaskProgressOverallModal
          history={overall.history}
          goalPerDay={overall.goal_per_day}
          remaining={remaining ?? 0}
          onGoalSaved={() => query.refetch()}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
};
