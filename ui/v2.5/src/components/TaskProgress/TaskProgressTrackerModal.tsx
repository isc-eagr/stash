import React from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import { Link } from "react-router-dom";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import { TaskProgressHistoryChart } from "../TaskProgressHistoryChart";
import { TaskProgressAtAGlance } from "./TaskProgressAtAGlance";
import type { IDetailSelection } from "./TaskProgressDetails";
import {
  itemLabels,
  progressForecast,
  progressToday,
  remainingTagURL,
  useProgressText,
  visibleTaskProgressItemCounts,
} from "./progressView_custom";

interface IProps {
  tracker: Tracker;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDetails: (selection: IDetailSelection) => void;
}

export const TaskProgressTrackerModal: React.FC<IProps> = ({
  tracker,
  busy,
  error,
  onClose,
  onEdit,
  onDelete,
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
          <Modal.Title>{tracker.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="progress-tracker-modal-meta">
            <Link to={`/tags/${tracker.tag_id}`}>{tracker.tag_name}</Link>
            <span>
              {t("Started on")}: {tracker.started_on}
            </span>
          </div>
          {tracker.description && (
            <p className="progress-description">{tracker.description}</p>
          )}
          <TaskProgressAtAGlance tracker={tracker} />
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <TaskProgressHistoryChart
            title={tracker.title}
            history={tracker.history.map((day) => ({
              ...day,
              baselineCount: day.baseline_count ?? undefined,
            }))}
            today={progressToday()}
            onSelectDay={(date) => onDetails({ tracker, date })}
          />
          <div className="progress-tracker-modal-items">
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
          <div className="small progress-forecast">
            {forecast.days >= 3 && (
              <p>
                {t("Daily pace")}:{" "}
                <FormattedNumber
                  value={forecast.completedRate}
                  maximumFractionDigits={1}
                />{" "}
                {t("completed")}
                {forecast.observed && (
                  <>
                    {" "}
                    · {t("Estimated finish")}: {forecast.observed}
                  </>
                )}
              </p>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="progress-tracker-modal-actions">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onEdit}
          >
            {t("Edit")}
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            disabled={busy}
            onClick={onDelete}
          >
            {t("Delete")}
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("Close")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
