import React, { useState } from "react";
import { Badge, Button, Card, Form } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import {
  progressPercentage,
  taskProgressStatusLabel,
  taskProgressStatusVariant,
  progressToday,
  useProgressText,
} from "./progressView_custom";
import { plannedTaskProgressFinishDate } from "./progressMath_custom";

interface IProps {
  tracker: Tracker;
  busy: boolean;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (direction: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

export const TaskProgressCard: React.FC<IProps> = ({
  tracker,
  busy,
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
  const planStorageKey = `task-progress-tracker-plan-${tracker.id}`;
  const [planRate, setPlanRate] = useState(() => {
    try {
      return Math.max(0, Number(localStorage.getItem(planStorageKey)) || 0);
    } catch {
      return 0;
    }
  });
  const planDate = plannedTaskProgressFinishDate(
    tracker.current_count,
    planRate,
    progressToday()
  );

  return (
    <Card
      className="progress-tracker-card"
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event: React.DragEvent<HTMLElement>) =>
        event.preventDefault()
      }
      onDrop={(event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        if (!busy) onDrop();
      }}
    >
      <div className="progress-tracker-summary">
        <span className="progress-tracker-heading">
          <strong className="progress-tracker-title">{tracker.title}</strong>
          <span className="progress-tracker-status">
            <Badge variant={taskProgressStatusVariant(tracker.status)}>
              {t(taskProgressStatusLabel(tracker.status))}
            </Badge>
          </span>
        </span>
        <span className="progress-tracker-counts">
          <span>
            <strong>
              <FormattedNumber value={tracker.completed_count} />
            </strong>{" "}
            {t("completed")}
          </span>
          <span>
            <strong>
              <FormattedNumber value={tracker.incoming_count} />
            </strong>{" "}
            {t("incoming")}
          </span>
          <span>
            <strong>
              <FormattedNumber value={tracker.current_count} />
            </strong>{" "}
            {t("remaining")}
          </span>
          <strong className="progress-tracker-percentage">
            {percentage.toFixed(2)}%
          </strong>
        </span>
        <span className="progress-tracker-meter" aria-hidden="true">
          <span style={{ width: `${percentage}%` }} />
        </span>
      </div>
      {/* CUSTOM: Keep actions on the left and planning controls on the right. */}
      <div className="progress-tracker-footer">
        <div className="progress-tracker-card-actions">
          <Button size="sm" variant="primary" onClick={onOpen}>
            {t("Details")}
          </Button>
          <Button size="sm" variant="outline-primary" onClick={onEdit}>
            {t("Edit")}
          </Button>
        </div>
        <div className="progress-tracker-plan">
          <Form.Label htmlFor={planStorageKey}>{t("Items per day")}</Form.Label>
          <Form.Control
            id={planStorageKey}
            inputMode="numeric"
            min={0}
            max={1000000}
            step={1}
            type="number"
            value={planRate || ""}
            onChange={(event) => {
              const next = Math.max(
                0,
                Math.min(1000000, Math.floor(Number(event.target.value) || 0))
              );
              setPlanRate(next);
              try {
                localStorage.setItem(planStorageKey, String(next));
              } catch {
                // Planning remains available for this session if storage is unavailable.
              }
            }}
          />
          {planDate && (
            <span>
              {t("Finish")}: {planDate}
            </span>
          )}
        </div>
      </div>
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
    </Card>
  );
};
