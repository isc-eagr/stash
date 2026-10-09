import React from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import { Link } from "react-router-dom";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import { TaskProgressHistoryChart } from "../TaskProgressHistoryChart";
import { formatTaskProgressDate } from "../taskProgress_custom";
import { TaskProgressProject } from "./TaskProgressProject";
import { TaskProgressAtAGlance } from "./TaskProgressAtAGlance";
import { taskProgressLastDataDate } from "./taskProgressCompletion_custom";
import { TaskProgressGoalSummary } from "./TaskProgressGoalSummary";
import type { IDetailSelection } from "./TaskProgressDetails";
import {
  itemLabels,
  progressForecast,
  progressToday,
  taskProgressHistoryEntries,
  remainingTagURL,
  useProgressText,
  visibleTaskProgressItemCounts,
} from "./progressView_custom";

interface IProps {
  tracker: Tracker;
  error?: string;
  onClose: () => void;
  onDetails: (selection: IDetailSelection) => void;
}

export const TaskProgressTrackerModal: React.FC<IProps> = ({
  tracker,
  error,
  onClose,
  onDetails,
}) => {
  const t = useProgressText();
  const forecast = progressForecast(tracker);
  const completed = tracker.status === "COMPLETED";
  const nonZeroItems = visibleTaskProgressItemCounts(tracker.item_counts);

  return (
    <>
      <Modal
        show
        onHide={onClose}
        size="xl"
        scrollable
        dialogClassName="task-progress-tracker-modal"
      >
        <Modal.Header closeButton>
          <div className="progress-tracker-modal-header">
            <div>
              <Modal.Title>{tracker.title}</Modal.Title>
              {tracker.description && (
                <p className="progress-tracker-modal-description">
                  {tracker.description}
                </p>
              )}
            </div>
            <div className="progress-tracker-modal-context">
              <TaskProgressProject tracker={tracker} />
              <span className="progress-tracker-modal-context-field">
                <small>{t("Started on")}</small>
                <strong>{formatTaskProgressDate(tracker.started_on)}</strong>
              </span>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          <TaskProgressAtAGlance tracker={tracker} />
          {!completed && forecast.days >= 3 && (
            <section className="progress-tracker-modal-forecast">
              <div>
                <span>{t("Estimated pace")}</span>
                <strong>
                  <FormattedNumber
                    value={forecast.completedRate}
                    maximumFractionDigits={1}
                  />{" "}
                  {t("completed")} / {t("day")}
                </strong>
              </div>
              <div>
                <span>{t("Estimated finish")}</span>
                <strong>
                  {forecast.observed
                    ? formatTaskProgressDate(forecast.observed)
                    : "—"}
                </strong>
              </div>
            </section>
          )}
          <TaskProgressGoalSummary
            status={tracker.status}
            currentGoalPerDay={tracker.goal_per_day}
            history={taskProgressHistoryEntries(tracker.history)}
          />
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <section className="progress-tracker-modal-history">
            <div className="progress-tracker-modal-section-heading">
              <h3>{t("Activity progression")}</h3>
              <p>
                {t(
                  completed
                    ? "Items completed over time."
                    : "Items completed over time with remaining totals."
                )}
              </p>
            </div>
            <TaskProgressHistoryChart
              title={tracker.title}
              history={taskProgressHistoryEntries(tracker.history)}
              today={
                completed
                  ? taskProgressLastDataDate(tracker.history) ?? progressToday()
                  : progressToday()
              }
              completionOnly={completed}
              onSelectDay={(date) => onDetails({ tracker, date })}
            />
          </section>
          {!completed && tracker.tag_id !== "0" && nonZeroItems.length > 0 && (
            <section
              aria-label={t("Remaining items")}
              className="progress-tracker-modal-items"
            >
              <span>{t("Remaining items")}</span>
              <div>
                {nonZeroItems.map((item) =>
                  tracker.mode === "FIXED" ? (
                    <Button
                      key={item.item_type}
                      size="sm"
                      variant="outline-info"
                      onClick={() =>
                        onDetails({ tracker, itemType: item.item_type })
                      }
                    >
                      {t(itemLabels[item.item_type])} ·{" "}
                      <FormattedNumber value={item.count} />
                    </Button>
                  ) : (
                    <Link
                      key={item.item_type}
                      className="btn btn-outline-info btn-sm"
                      to={remainingTagURL(tracker, item.item_type)}
                    >
                      {t(itemLabels[item.item_type])} ·{" "}
                      <FormattedNumber value={item.count} />
                    </Link>
                  )
                )}
              </div>
            </section>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};
