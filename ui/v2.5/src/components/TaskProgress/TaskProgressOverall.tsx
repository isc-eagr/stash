import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Form } from "react-bootstrap";
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
import { formatTaskProgressDate } from "../taskProgress_custom";
import { TaskProgressOverallModal } from "./TaskProgressOverallModal";
import { TaskProgressGoalSummary } from "./TaskProgressGoalSummary";
import { TaskProgressRing } from "./TaskProgressRing";

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
        <Card.Body>
          <div className="progress-overall-heading">
            <div>
              <h3>{t("Overall Progress")}</h3>
              <p>{t("Organized scenes")}</p>
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
          {total === undefined || done === undefined ? (
            <p role="status">{t("Loading…")}</p>
          ) : (
            <>
              <div className="progress-overall-hero">
                <div className="progress-overall-summary">
                  <span>
                    <strong>
                      <FormattedNumber value={done} />
                    </strong>
                    <small>{t("organized")}</small>
                  </span>
                  <span>
                    <strong>
                      <FormattedNumber value={remaining ?? 0} />
                    </strong>
                    <small>{t("remaining")}</small>
                  </span>
                  <span>
                    <strong>
                      <FormattedNumber value={total} />
                    </strong>
                    <small>{t("total")}</small>
                  </span>
                </div>
                <TaskProgressRing
                  percentage={percentage}
                  label={t("Complete")}
                />
              </div>
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
          <div className="progress-overall-footer">
            <Form.Group
              controlId="overall-progress-rate"
              className="progress-overall-goal-form"
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
            {due && (
              <p className="progress-overall-plan">
                <span>{t("Estimated finish")}</span>
                <strong>{formatTaskProgressDate(due)}</strong>
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
          </div>
          {goalError && <p role="alert">{goalError}</p>}
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
