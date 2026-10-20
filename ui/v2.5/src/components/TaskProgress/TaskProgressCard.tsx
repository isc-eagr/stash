import React from "react";
import { Badge, Button, Card } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import {
  faArrowDown,
  faArrowUp,
  faPencilAlt,
} from "@fortawesome/free-solid-svg-icons";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import {
  itemLabels,
  progressPercentage,
  taskProgressStatusLabel,
  taskProgressStatusVariant,
  taskProgressHistoryEntries,
  useProgressText,
} from "./progressView_custom";
import { taskProgressCompletedCount } from "./progressMath_custom";
import { TaskProgressMedalBar } from "./TaskProgressMedalBar";
import { TaskProgressFinishLabel } from "./TaskProgressForecast";
import { TaskProgressPeriodTiles } from "./TaskProgressPeriodTiles";

interface IProps {
  tracker: Tracker;
  busy: boolean;
  reorderable?: boolean;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (direction: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

/** One scoreboard row: identity, medal progress, period goals, and actions. */
export const TaskProgressCard: React.FC<IProps> = ({
  tracker,
  busy,
  reorderable = true,
  first,
  last,
  onOpen,
  onEdit,
  onMove,
  onDragStart,
  onDragEnd,
  onDrop,
}) => {
  const t = useProgressText();
  const percentage = progressPercentage(tracker);
  const completedCount = taskProgressCompletedCount(tracker);
  const completed = tracker.status === "COMPLETED";
  const history = taskProgressHistoryEntries(tracker.history);
  const types = tracker.item_types
    .map((type) => t(itemLabels[type] ?? type))
    .join(", ");

  return (
    <Card
      className="progress-tracker-card progress-score-row"
      draggable={!busy && reorderable}
      onDragStart={reorderable ? onDragStart : undefined}
      onDragEnd={reorderable ? onDragEnd : undefined}
      onDragOver={(event: React.DragEvent<HTMLElement>) =>
        reorderable && event.preventDefault()
      }
      onDrop={(event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        if (!busy && reorderable) onDrop();
      }}
    >
      <div className="progress-score-identity">
        <div className="progress-score-title-row">
          <strong className="progress-tracker-title">{tracker.title}</strong>
          <Badge
            variant={
              tracker.status === "ACTIVE" && completedCount === 0
                ? "light"
                : taskProgressStatusVariant(tracker.status)
            }
          >
            {t(taskProgressStatusLabel(tracker.status))}
          </Badge>
        </div>
        <div className="progress-score-counts">
          <span className="progress-score-done">
            <strong>
              <FormattedNumber value={completedCount} />
            </strong>{" "}
            {t("done")}
          </span>
          {!completed && (
            <span>
              <strong>
                <FormattedNumber value={tracker.current_count} />
              </strong>{" "}
              {t("left")}
            </span>
          )}
        </div>
        <small>{types}</small>
        <div className="progress-score-actions">
          <Button size="sm" variant="primary" onClick={onOpen}>
            {t("Details")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onEdit}
            aria-label={t("Edit")}
            title={t("Edit")}
          >
            <Icon icon={faPencilAlt} />
          </Button>
          {reorderable && (
            <div
              className="progress-tracker-reorder"
              aria-label={t("Reorder tracker")}
            >
              <Button
                aria-label={t("Move earlier")}
                disabled={busy || first}
                onClick={(event) => {
                  event.stopPropagation();
                  onMove(-1);
                }}
                size="sm"
                title={t("Move earlier")}
                variant="link"
              >
                <Icon icon={faArrowUp} />
              </Button>
              <Button
                aria-label={t("Move later")}
                disabled={busy || last}
                onClick={(event) => {
                  event.stopPropagation();
                  onMove(1);
                }}
                size="sm"
                title={t("Move later")}
                variant="link"
              >
                <Icon icon={faArrowDown} />
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="progress-score-progress">
        <strong
          className={`progress-score-percent${
            completed ? " progress-score-percent-complete" : ""
          }`}
        >
          {percentage.toFixed(2)}%
        </strong>
        <TaskProgressMedalBar
          completed={completedCount}
          total={completedCount + tracker.current_count}
          percent={percentage}
          history={history}
          complete={completed}
          caption={
            !completed && (
              <TaskProgressFinishLabel
                storageKey={`task-progress-tracker-plan-${tracker.id}`}
                history={tracker.history}
                remaining={tracker.current_count}
                status={tracker.status}
                startedOn={tracker.started_on}
              />
            )
          }
        />
      </div>
      <TaskProgressPeriodTiles
        variant="row"
        status={tracker.status}
        currentGoalPerDay={tracker.goal_per_day}
        history={history}
      />
    </Card>
  );
};
