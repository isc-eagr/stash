import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Form, ProgressBar } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import {
  useTaskProgressOrganizedScenesQuery,
  useTaskProgressOverallGoalUpdateMutation,
} from "src/core/generated-graphql";
import {
  overallProgressPercentage,
  useProgressText,
  progressToday,
} from "./progressView_custom";
import { TaskProgressOverallModal } from "./TaskProgressOverallModal";
import { TaskProgressGoalSummary } from "./TaskProgressGoalSummary";

export const TaskProgressOverall: React.FC = () => {
  const t = useProgressText();
  const query = useTaskProgressOrganizedScenesQuery({
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [updateGoal] = useTaskProgressOverallGoalUpdateMutation();
  const [showDetails, setShowDetails] = useState(false);
  const [rate, setRate] = useState(0);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string>();
  const overall = query.data?.taskProgressOverall;
  useEffect(() => {
    if (overall) setRate(overall.goal_per_day ?? 0);
  }, [overall]);
  const total = overall?.total_count;
  const done = overall?.organized_count;
  const remaining =
    total !== undefined && done !== undefined
      ? Math.max(0, total - done)
      : undefined;
  const percentage =
    total !== undefined && done !== undefined
      ? overallProgressPercentage(total, done)
      : 0;
  const due =
    rate > 0 && remaining
      ? new Date(
          Date.parse(`${progressToday()}T00:00:00Z`) +
            Math.ceil(remaining / rate) * 86400000
        )
          .toISOString()
          .slice(0, 10)
      : undefined;
  return (
    <>
      <Card className="progress-overall-card">
        <Card.Header>
          <div>
            <h3 className="h5">{t("Overall Progress")}</h3>
            <p>{t("Organized scenes")}</p>
          </div>
        </Card.Header>
        <Card.Body>
          {query.error && (
            <Alert variant="warning">
              {t("Could not refresh organized scenes.")}{" "}
              <Button size="sm" onClick={() => void query.refetch()}>
                {t("Retry")}
              </Button>
            </Alert>
          )}
          {total === undefined || done === undefined ? (
            <p role="status">{t("Loading…")}</p>
          ) : (
            <>
              <div className="progress-overall-summary">
                <strong>
                  <FormattedNumber value={done} />
                </strong>
                <span>{t("organized")}</span>
                <span>/</span>
                <strong>
                  <FormattedNumber value={remaining ?? 0} />
                </strong>
                <span>{t("remaining")}</span>
                <span>/</span>
                <strong>
                  <FormattedNumber value={total} />
                </strong>
                <span>{t("total")}</span>
                <strong className="progress-overall-percentage">
                  {percentage.toFixed(2)}%
                </strong>
              </div>
              <ProgressBar
                aria-label={t("Organized scenes")}
                now={percentage}
              />
              {overall && (
                <TaskProgressGoalSummary
                  currentGoalPerDay={overall.goal_per_day}
                  history={overall.history.map((day) => ({
                    ...day,
                    baselineCount: day.baseline_count ?? undefined,
                    goalPerDay: day.goal_per_day,
                  }))}
                />
              )}
            </>
          )}
          <Form.Group
            controlId="overall-progress-rate"
            className="progress-overall-goal-form mt-3"
          >
            <Form.Label>{t("Items per day")}</Form.Label>
            <Form.Control
              className="progress-plan-input"
              type="number"
              min={0}
              max={1000000}
              step={1}
              value={rate || ""}
              onChange={(e) => {
                const next = Math.max(
                  0,
                  Math.min(1000000, Math.floor(Number(e.target.value) || 0))
                );
                setRate(next);
              }}
            />
            <Button
              disabled={savingGoal || rate === (overall?.goal_per_day ?? 0)}
              onClick={async () => {
                setSavingGoal(true);
                setGoalError(undefined);
                try {
                  await updateGoal({
                    variables: { goal_per_day: rate > 0 ? rate : null },
                  });
                  await query.refetch();
                } catch (error) {
                  setGoalError(
                    error instanceof Error ? error.message : String(error)
                  );
                } finally {
                  setSavingGoal(false);
                }
              }}
              size="sm"
              variant="primary"
            >
              {t(savingGoal ? "Saving…" : "Save")}
            </Button>
          </Form.Group>
          {goalError && <p role="alert">{goalError}</p>}
          {due && (
            <p>
              {t("Planned finish")}: {due} · {t("Assumes no new work")}
            </p>
          )}
          <div className="progress-overall-card-actions">
            <Button
              size="sm"
              variant="primary"
              disabled={!overall}
              onClick={() => setShowDetails(true)}
            >
              {t("Details")}
            </Button>
          </div>
        </Card.Body>
      </Card>
      {showDetails && overall && (
        <TaskProgressOverallModal
          history={overall.history}
          goalPerDay={overall.goal_per_day}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
};
