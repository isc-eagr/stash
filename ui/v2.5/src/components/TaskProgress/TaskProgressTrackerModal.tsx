import React from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import { Link } from "react-router-dom";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import { TaskProgressHistoryChart } from "../TaskProgressHistoryChart";
import { formatTaskProgressDate } from "../taskProgress_custom";
import { TaskProgressAtAGlance } from "./TaskProgressAtAGlance";
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
              <Link
                className="progress-tracker-modal-context-field"
                to={`/tags/${tracker.tag_id}`}
              >
                <small>{t("Project")}</small>
                <strong>{tracker.tag_name}</strong>
              </Link>
              <span className="progress-tracker-modal-context-field">
                <small>{t("Started on")}</small>
                <strong>{formatTaskProgressDate(tracker.started_on)}</strong>
              </span>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          <TaskProgressAtAGlance tracker={tracker} />
          {forecast.days >= 3 && (
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
              <p>{t("Items completed over time with remaining totals.")}</p>
            </div>
            <TaskProgressHistoryChart
              title={tracker.title}
              history={taskProgressHistoryEntries(tracker.history)}
              today={progressToday()}
              onSelectDay={(date) => onDetails({ tracker, date })}
            />
          </section>
          {nonZeroItems.length > 0 && (
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
