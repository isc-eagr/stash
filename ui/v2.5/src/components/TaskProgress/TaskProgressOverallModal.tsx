import React from "react";
import { Button, Modal } from "react-bootstrap";
import type { TaskProgressOrganizedScenesQuery } from "src/core/generated-graphql";
import { TaskProgressHistoryChart } from "../TaskProgressHistoryChart";
import { TaskProgressGoalSummary } from "./TaskProgressGoalSummary";
import { progressToday, useProgressText } from "./progressView_custom";

interface IProps {
  history: TaskProgressOrganizedScenesQuery["taskProgressOverall"]["history"];
  goalPerDay?: number | null;
  onClose: () => void;
}

export const TaskProgressOverallModal: React.FC<IProps> = ({
  history,
  goalPerDay,
  onClose,
}) => {
  const t = useProgressText();

  return (
    <Modal
      show
      onHide={onClose}
      size="xl"
      scrollable
      dialogClassName="task-progress-tracker-modal task-progress-overall-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>{t("Overall Progress")}</Modal.Title>
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
        <TaskProgressHistoryChart
          history={history.map((day) => ({
            ...day,
            baselineCount: day.baseline_count ?? undefined,
            goalPerDay: day.goal_per_day,
          }))}
          title={t("Overall Progress")}
          today={progressToday()}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="secondary" onClick={onClose}>
          {t("Close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
