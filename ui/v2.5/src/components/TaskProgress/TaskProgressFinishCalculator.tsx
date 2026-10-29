import React, { useState } from "react";
import { Button, Form, InputGroup, Modal } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import type { TaskProgressMilestoneDataFragment as Milestone } from "src/core/generated-graphql";
import { formatTaskProgressDate } from "../taskProgress_custom";
import { milestonesRemaining } from "./milestoneView_custom";
import { plannedTaskProgressFinishDate } from "./progressMath_custom";
import { useProgressText } from "./progressView_custom";
import { taskProgressDaysUntil } from "./taskProgressFinish_custom";
import { useRelativeFinish } from "./TaskProgressForecast";

const storageKey = "task-progress-milestone-finish-calculator";

interface ICalculatorPlan {
  ids: string[];
  rate: number;
}

/** The last picks and pace, or every unfinished milestone at 10/day. */
export function readFinishCalculatorPlan(
  milestones: readonly Pick<Milestone, "id" | "current_count">[]
): ICalculatorPlan {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved && Array.isArray(saved.ids)) {
      return {
        ids: saved.ids.map(String),
        rate: Math.max(0, Number(saved.rate) || 0),
      };
    }
  } catch {
    /* Fall back to the defaults. */
  }
  return {
    ids: milestones
      .filter((milestone) => milestone.current_count > 0)
      .map((milestone) => milestone.id),
    rate: 10,
  };
}

/** What-if finish date for any set of milestones at a chosen items/day. */
export const TaskProgressFinishCalculator: React.FC<{
  milestones: readonly Milestone[];
  onClose: () => void;
}> = ({ milestones, onClose }) => {
  const t = useProgressText();
  const relative = useRelativeFinish();
  const [plan, setPlanState] = useState(() =>
    readFinishCalculatorPlan(milestones)
  );
  const setPlan = (next: ICalculatorPlan) => {
    setPlanState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* The calculator works without storage for this page view. */
    }
  };
  const selected = milestones.filter((milestone) =>
    plan.ids.includes(milestone.id)
  );
  const remaining = milestonesRemaining(selected);
  const date = selected.length
    ? plannedTaskProgressFinishDate(remaining, plan.rate)
    : undefined;
  const pick = (ids: string[]) => setPlan({ ...plan, ids });
  const allSelected = selected.length === milestones.length;

  return (
    <Modal
      show
      onHide={onClose}
      scrollable
      dialogClassName="task-progress-tracker-modal milestone-finish-calculator"
    >
      <Modal.Header closeButton>
        <Modal.Title>{t("Finish calculator")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <fieldset className="milestone-finish-picks">
          <div className="milestone-finish-picks-heading">
            <legend>{t("Milestones")}</legend>
            <Button
              variant="link"
              size="sm"
              onClick={() =>
                pick(
                  allSelected ? [] : milestones.map((milestone) => milestone.id)
                )
              }
            >
              {t(allSelected ? "Clear" : "Select all")}
            </Button>
          </div>
          {milestones.map((milestone) => (
            <Form.Check
              key={milestone.id}
              id={`milestone-finish-${milestone.id}`}
              type="checkbox"
              checked={plan.ids.includes(milestone.id)}
              onChange={() =>
                pick(
                  plan.ids.includes(milestone.id)
                    ? selected
                        .filter((item) => item.id !== milestone.id)
                        .map((item) => item.id)
                    : [...selected.map((item) => item.id), milestone.id]
                )
              }
              label={
                <>
                  <span>{milestone.name}</span>
                  <small>
                    {milestone.current_count > 0 ? (
                      <>
                        <FormattedNumber value={milestone.current_count} />{" "}
                        {t("left")}
                      </>
                    ) : (
                      t("Complete")
                    )}
                  </small>
                </>
              }
            />
          ))}
        </fieldset>
        <section
          className="progress-finish-planner"
          aria-label={t("Estimated finish")}
        >
          <div className="progress-finish-summary">
            <span className="progress-finish-eyebrow">
              {t("Estimated finish")}
            </span>
            <strong className="progress-finish-date" aria-live="polite">
              {!selected.length
                ? "—"
                : remaining === 0
                ? t("Complete")
                : date
                ? formatTaskProgressDate(date)
                : "—"}
            </strong>
            {remaining > 0 && date && (
              <span className="progress-finish-relative">
                {relative(taskProgressDaysUntil(date))}
              </span>
            )}
          </div>
          <div className="progress-finish-controls">
            <Form.Group
              controlId="milestone-finish-rate"
              className="progress-finish-rate"
            >
              <Form.Label>{t("My pace")}</Form.Label>
              <InputGroup size="sm">
                <Form.Control
                  type="number"
                  min={1}
                  max={1000000}
                  step={1}
                  value={plan.rate || ""}
                  onChange={(event) =>
                    setPlan({
                      ...plan,
                      rate: Math.max(
                        0,
                        Math.min(
                          1000000,
                          Math.floor(Number(event.target.value) || 0)
                        )
                      ),
                    })
                  }
                />
                <InputGroup.Append>
                  <InputGroup.Text>{t("items/day")}</InputGroup.Text>
                </InputGroup.Append>
              </InputGroup>
            </Form.Group>
            <p className="progress-finish-basis">
              {selected.length ? (
                <>
                  <FormattedNumber value={remaining} /> {t("items left")}
                </>
              ) : (
                t("Pick at least one milestone")
              )}
            </p>
            {remaining > 0 && (
              <small className="progress-finish-note">
                {t("Assumes no new items arrive")}
              </small>
            )}
            {remaining <
              selected.reduce((sum, item) => sum + item.current_count, 0) && (
              <small className="progress-finish-note">
                {t("Shared trackers count once")}
              </small>
            )}
          </div>
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
