import React from "react";
import { Button, Modal } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import type { TaskProgressMilestoneDataFragment as Milestone } from "src/core/generated-graphql";
import { TaskProgressHistoryChart } from "../TaskProgressHistoryChart";
import { formatTaskProgressDate } from "../taskProgress_custom";
import { milestoneItemProgress } from "./milestoneView_custom";
import { progressToday } from "./progressMath_custom";
import {
  itemLabels,
  taskProgressHistoryEntries,
  useProgressText,
} from "./progressView_custom";
import { taskProgressPeriodComparisons } from "./taskProgressReports_custom";
import { TaskProgressGoalSummary } from "./TaskProgressGoalSummary";
import { TaskProgressForecast } from "./TaskProgressForecast";

export const TaskProgressMilestoneModal: React.FC<{
  milestone: Milestone;
  onClose: () => void;
}> = ({ milestone, onClose }) => {
  const t = useProgressText();
  const today = progressToday();
  const history = taskProgressHistoryEntries(milestone.history);
  const percent =
    milestone.total_count > 0
      ? (milestone.completed_count / milestone.total_count) * 100
      : 0;

  return (
    <Modal
      show
      onHide={onClose}
      size="xl"
      scrollable
      dialogClassName="task-progress-tracker-modal task-progress-milestone-modal"
    >
      <Modal.Header closeButton>
        <div className="progress-tracker-modal-header">
          <div>
            <Modal.Title>{milestone.name}</Modal.Title>
            {milestone.target_date && (
              <p className="progress-tracker-modal-description">
                {t("Target date")}:{" "}
                {formatTaskProgressDate(milestone.target_date)}
              </p>
            )}
          </div>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="progress-tracker-at-a-glance">
          {[
            { label: "Completed items", value: milestone.completed_count },
            { label: "Items remaining", value: milestone.current_count },
            { label: "Percentage complete", value: percent },
          ].map((item) => (
            <div key={item.label} className="progress-tracker-at-a-glance-card">
              <strong>
                {item.label === "Percentage complete" ? (
                  `${item.value.toFixed(2)}%`
                ) : (
                  <FormattedNumber value={item.value} />
                )}
              </strong>
              <span>{t(item.label)}</span>
            </div>
          ))}
        </div>
        <TaskProgressGoalSummary
          currentGoalPerDay={milestone.goal_per_day}
          history={history}
          comparisons={taskProgressPeriodComparisons(milestone.history, today)}
        />
        {/* The finish planner moved here from the milestone list. */}
        {milestone.current_count > 0 && !!milestone.trackers.length && (
          <TaskProgressForecast
            storageKey={`task-progress-milestone-plan-${milestone.id}`}
            history={milestone.history}
            remaining={milestone.current_count}
          />
        )}
        <div className="progress-ledger-types">
          {milestoneItemProgress(milestone).map((item) => (
            <div key={item.itemType}>
              <span>{t(itemLabels[item.itemType] ?? item.itemType)}</span>
              <span>
                <FormattedNumber value={item.completed} /> /{" "}
                <FormattedNumber value={item.total} />
              </span>
              <span className="progress-report-meter" aria-hidden="true">
                <span
                  style={{ width: `${(item.completed / item.total) * 100}%` }}
                />
              </span>
            </div>
          ))}
        </div>
        <section className="progress-tracker-modal-history">
          <div className="progress-tracker-modal-section-heading">
            <h3>{t("Activity progression")}</h3>
          </div>
          <TaskProgressHistoryChart
            title={milestone.name}
            history={history}
            today={today}
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
