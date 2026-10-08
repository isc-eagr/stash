import { useEffect, useState } from "react";
import { progressToday } from "./progressMath_custom";

export function taskProgressLastDataDate(history: readonly { date: string }[]) {
  return history.reduce<string | undefined>(
    (latest, day) => (!latest || day.date > latest ? day.date : latest),
    undefined
  );
}

export function showTaskProgressCurrentPeriods(
  status: string | undefined,
  history: readonly { date: string }[],
  today = progressToday()
) {
  if (status !== "COMPLETED") return true;
  const lastDate = taskProgressLastDataDate(history);
  return !!lastDate && lastDate >= today;
}

// Task Progress uses Mexico City reporting dates, which have a UTC-6 offset.
export function taskProgressNextDayDelay(now = new Date()) {
  return (
    Date.parse(`${progressToday(now)}T00:00:00-06:00`) +
    86400000 -
    now.getTime()
  );
}

export function useTaskProgressReportingDate() {
  const [today, setToday] = useState(() => progressToday());
  useEffect(() => {
    const timer = window.setTimeout(
      () => setToday(progressToday()),
      taskProgressNextDayDelay()
    );
    const refresh = () => setToday(progressToday());
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [today]);
  return today;
}
