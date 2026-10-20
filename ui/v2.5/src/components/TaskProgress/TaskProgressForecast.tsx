import React from "react";
import { Form, InputGroup } from "react-bootstrap";
import { useIntl } from "react-intl";
import { faFlagCheckered } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "../Shared/Icon";
import { formatTaskProgressDate } from "../taskProgress_custom";
import { useProgressText } from "./progressView_custom";
import {
  taskProgressDaysUntil,
  taskProgressFinishEstimate,
  useTaskProgressFinishPlan,
} from "./taskProgressFinish_custom";
import type { ITaskProgressFinishInput } from "./taskProgressFinish_custom";

interface IFinishProps extends ITaskProgressFinishInput {
  /** localStorage key of the browser-local plan. */
  storageKey: string;
  defaultRate?: number;
}

/** "in 12 days", "in about 5 months", "in about 7.7 years". */
function useRelativeFinish() {
  const t = useProgressText();
  const intl = useIntl();
  return (days: number) => {
    if (days <= 0) return t("today");
    if (days <= 60) return `${t("in")} ${intl.formatNumber(days)} ${t("days")}`;
    if (days <= 730)
      return `${t("in about")} ${Math.round(days / 30.44)} ${t("months")}`;
    return `${t("in about")} ${intl.formatNumber(days / 365.25, {
      maximumFractionDigits: 1,
    })} ${t("years")}`;
  };
}

/** The finish planner shown in Details: estimate, basis, and the user's pace. */
export const TaskProgressForecast: React.FC<IFinishProps> = ({
  storageKey,
  defaultRate = 10,
  ...input
}) => {
  const t = useProgressText();
  const intl = useIntl();
  const relative = useRelativeFinish();
  const [plan, setPlan] = useTaskProgressFinishPlan(storageKey, defaultRate);
  const estimate = taskProgressFinishEstimate(input, plan);
  const status = input.status ?? "ACTIVE";
  const basis = estimate.manual
    ? undefined
    : estimate.date
    ? `${intl.formatNumber(estimate.rate, { maximumFractionDigits: 1 })} ${t(
        estimate.assumesNoIncoming ? "completed" : "net"
      )} / ${t("day")} · ${t("last 7 complete days")}`
    : t(status === "PAUSED" ? "Paused" : "No recent pace");

  return (
    <section
      className="progress-finish-planner"
      aria-label={t("Estimated finish")}
    >
      <div className="progress-finish-summary">
        <span className="progress-finish-eyebrow">{t("Estimated finish")}</span>
        <strong className="progress-finish-date" aria-live="polite">
          {input.remaining === 0
            ? t("Complete")
            : estimate.date
            ? formatTaskProgressDate(estimate.date)
            : "—"}
        </strong>
        {input.remaining > 0 && estimate.date && (
          <span className="progress-finish-relative">
            {relative(taskProgressDaysUntil(estimate.date))}
          </span>
        )}
      </div>
      {input.remaining > 0 && (
        <div className="progress-finish-controls">
          <div
            className="progress-segmented"
            role="group"
            aria-label={t("Forecast basis")}
          >
            <button
              type="button"
              className={!estimate.manual ? "active" : undefined}
              aria-pressed={!estimate.manual}
              onClick={() => setPlan({ ...plan, mode: "auto" })}
            >
              {t("Current pace")}
            </button>
            <button
              type="button"
              className={estimate.manual ? "active" : undefined}
              aria-pressed={estimate.manual}
              onClick={() => setPlan({ ...plan, mode: "custom" })}
            >
              {t("My pace")}
            </button>
          </div>
          {estimate.manual ? (
            <Form.Group
              controlId={`${storageKey}-rate`}
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
          ) : (
            <p className="progress-finish-basis">{basis}</p>
          )}
          {estimate.date && estimate.assumesNoIncoming && (
            <small className="progress-finish-note">
              {t("Assumes no new items arrive")}
            </small>
          )}
        </div>
      )}
    </section>
  );
};

/** Read-only finish date from the plan saved in Details. */
export const TaskProgressFinishLabel: React.FC<IFinishProps> = ({
  storageKey,
  defaultRate = 10,
  ...input
}) => {
  const t = useProgressText();
  const [plan] = useTaskProgressFinishPlan(storageKey, defaultRate);
  if (input.remaining === 0) return null;
  const estimate = taskProgressFinishEstimate(input, plan);
  return (
    <span
      className={`progress-finish-label${
        estimate.date ? "" : " progress-finish-label-empty"
      }`}
      title={t(estimate.manual ? "My pace" : "Current pace")}
    >
      <Icon icon={faFlagCheckered} />
      <span>{t("Finish")}</span>
      <strong>
        {estimate.date ? formatTaskProgressDate(estimate.date) : "—"}
      </strong>
    </span>
  );
};
