import { useEffect, useState } from "react";
import { progressLedgerForecast } from "./progressLedger_custom";
import {
  plannedTaskProgressFinishDate,
  progressToday,
} from "./progressMath_custom";
import type { ITaskProgressReportHistoryDay } from "./taskProgressReports_custom";

/** Browser-local finish plan: observed pace, or the user's own items per day. */
export interface ITaskProgressFinishPlan {
  mode: "auto" | "custom";
  rate: number;
}

const planEvent = "task-progress-finish-plan";

export function readTaskProgressFinishPlan(
  storageKey: string,
  defaultRate = 10
): ITaskProgressFinishPlan {
  try {
    return {
      mode:
        localStorage.getItem(`${storageKey}-mode`) === "custom"
          ? "custom"
          : "auto",
      rate: Math.max(
        0,
        Number(localStorage.getItem(storageKey)) || defaultRate
      ),
    };
  } catch {
    return { mode: "auto", rate: defaultRate };
  }
}

/** Saves the plan and tells every display of the same plan to refresh. */
export function saveTaskProgressFinishPlan(
  storageKey: string,
  plan: ITaskProgressFinishPlan
) {
  try {
    localStorage.setItem(storageKey, String(plan.rate));
    localStorage.setItem(`${storageKey}-mode`, plan.mode);
  } catch {
    /* Planning works without storage for this page view. */
  }
  window.dispatchEvent(new CustomEvent(planEvent, { detail: storageKey }));
}

/** The saved plan for `storageKey`, kept in sync with edits made elsewhere. */
export function useTaskProgressFinishPlan(
  storageKey: string,
  defaultRate = 10
): [ITaskProgressFinishPlan, (plan: ITaskProgressFinishPlan) => void] {
  const [plan, setPlan] = useState(() =>
    readTaskProgressFinishPlan(storageKey, defaultRate)
  );
  useEffect(() => {
    const refresh = (event: Event) => {
      const key =
        event instanceof CustomEvent
          ? event.detail
          : (event as StorageEvent).key;
      if (!key || String(key).startsWith(storageKey)) {
        setPlan(readTaskProgressFinishPlan(storageKey, defaultRate));
      }
    };
    window.addEventListener(planEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(planEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [storageKey, defaultRate]);
  const update = (next: ITaskProgressFinishPlan) => {
    setPlan(next);
    saveTaskProgressFinishPlan(storageKey, next);
  };
  return [plan, update];
}

/** Re-renders the caller whenever any finish plan is saved. */
export function useTaskProgressFinishPlanVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    window.addEventListener(planEvent, bump);
    return () => window.removeEventListener(planEvent, bump);
  }, []);
  return version;
}

export interface ITaskProgressFinishInput {
  history: readonly ITaskProgressReportHistoryDay[];
  remaining: number;
  status?: string;
  startedOn?: string;
}

/** Estimated finish for a plan: observed pace by default, or the user's rate. */
export function taskProgressFinishEstimate(
  {
    history,
    remaining,
    status = "ACTIVE",
    startedOn,
  }: ITaskProgressFinishInput,
  plan: ITaskProgressFinishPlan,
  today = progressToday()
) {
  const forecast = progressLedgerForecast(
    history,
    remaining,
    today,
    status,
    startedOn
  );
  const manual = plan.mode === "custom";
  const date =
    remaining === 0
      ? today
      : manual
      ? plannedTaskProgressFinishDate(remaining, plan.rate, today)
      : forecast.date;
  return {
    date,
    manual,
    rate: manual
      ? plan.rate
      : forecast.assumesNoIncoming
      ? forecast.completedRate
      : forecast.netRate,
    /** True when the estimate ignores new items arriving. */
    assumesNoIncoming: manual || forecast.assumesNoIncoming,
    observedDays: forecast.days,
  };
}

/** Whole days from `today` until `date`. */
export function taskProgressDaysUntil(date: string, today = progressToday()) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000
  );
}
