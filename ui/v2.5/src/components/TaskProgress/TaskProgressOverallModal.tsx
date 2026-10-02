import React, { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import {
  useTaskProgressOverallGoalUpdateMutation,
  type TaskProgressOrganizedScenesQuery,
} from "src/core/generated-graphql";
import { TaskProgressHistoryChart } from "../TaskProgressHistoryChart";
import { TaskProgressGoalSummary } from "./TaskProgressGoalSummary";
import { progressToday, useProgressText } from "./progressView_custom";

interface IProps {
  history: TaskProgressOrganizedScenesQuery["taskProgressOverall"]["history"];
  goalPerDay?: number | null;
  onGoalSaved: () => Promise<unknown>;
  onClose: () => void;
}

export const TaskProgressOverallModal: React.FC<IProps> = ({
  history,
  goalPerDay,
  onGoalSaved,
  onClose,
}) => {
  const t = useProgressText();
  const [updateGoal] = useTaskProgressOverallGoalUpdateMutation();
  const [rate, setRate] = useState(goalPerDay ?? 0);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string>();
  const saveGoal = async () => {
    setSavingGoal(true);
    setGoalError(undefined);
    try {
      await updateGoal({
        variables: { goal_per_day: rate > 0 ? rate : null },
      });
      await onGoalSaved();
    } catch (error) {
      setGoalError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <Modal
      show
      onHide={onClose}
      size="xl"
      scrollable
      dialogClassName="task-progress-tracker-modal task-progress-overall-modal"
    >
      <Modal.Header closeButton>
        <div className="progress-tracker-modal-header">
          <div>
            <Modal.Title>{t("Overall Progress")}</Modal.Title>
            <p className="progress-tracker-modal-description">
              {t("Organized scenes")}
            </p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body>
        <TaskProgressGoalSummary
          currentGoalPerDay={goalPerDay}
          history={history.map((day) => ({
            ...day,
            baselineCount: day.baseline_count ?? undefined,
            goalPerDay: day.goal_per_day,
          }))}
        />
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
            onChange={(e) =>
              setRate(
                Math.max(
                  0,
                  Math.min(1000000, Math.floor(Number(e.target.value) || 0))
                )
              )
            }
          />
          <Button
            disabled={savingGoal || rate === (goalPerDay ?? 0)}
            onClick={saveGoal}
            size="sm"
            variant="primary"
          >
            {t(savingGoal ? "Saving…" : "Save")}
          </Button>
        </Form.Group>
        {goalError && <p role="alert">{goalError}</p>}
        <section className="progress-tracker-modal-history">
          <div className="progress-tracker-modal-section-heading">
            <h3>{t("Activity progression")}</h3>
            <p>{t("Items completed over time with remaining totals.")}</p>
          </div>
          <TaskProgressHistoryChart
            history={history.map((day) => ({
              ...day,
              baselineCount: day.baseline_count ?? undefined,
              goalPerDay: day.goal_per_day,
            }))}
            title={t("Overall Progress")}
            today={progressToday()}
          />
        </section>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="secondary" onClick={onClose}>
          {t("Close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
