import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Form } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { formatStatsTotal } from "src/utils/statsDrilldown_custom";
import {
  addOStatsStudioScopeToPath,
  getOStatsStudioScopeVariables,
  type IOStatsStudioScope,
} from "./oStatsStudioScope_custom";
import {
  buildOStatsCalendar,
  summarizeOStatsCalendar,
} from "./oStatsCalendar_custom";

const SCENE_O_CALENDAR_DAY_COUNTS = gql`
  query OStatsCalendarDayCounts($year: Int!, $studioId: ID, $depth: Int) {
    sceneOCalendarDayCounts(year: $year, studio_id: $studioId, depth: $depth) {
      date
      count
    }
  }
`;

interface IDayCounts {
  sceneOCalendarDayCounts: Array<{ date: string; count: number }>;
}

function dayCountMap(data?: IDayCounts) {
  return new Map(
    (data?.sceneOCalendarDayCounts ?? []).map((item) => [item.date, item.count])
  );
}

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function monthLabel(month: number) {
  return new Date(Date.UTC(2024, month - 1, 1)).toLocaleString(
    getAppLocaleCustom(),
    {
      month: "short",
      timeZone: "UTC",
    }
  );
}

function longDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(
    getAppLocaleCustom(),
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  );
}

// The heatmap picks its own calendar year, so it ignores the page date range.
export const OStatsCalendarHeatmap: React.FC<{
  years: number[];
  studioScope?: IOStatsStudioScope;
  // Year in Review shows one year and has its own year navigation.
  fixedYear?: number;
}> = ({ years, studioScope, fixedYear }) => {
  const currentYear = new Date().getFullYear();
  const defaultYear = years.includes(currentYear)
    ? currentYear
    : (years[years.length - 1] ?? currentYear);
  const [pickedYear, setYear] = useState(defaultYear);
  const year = fixedYear ?? pickedYear;

  useEffect(() => {
    if (!years.includes(pickedYear)) setYear(defaultYear);
  }, [defaultYear, pickedYear, years]);

  const variables = getOStatsStudioScopeVariables(studioScope);
  const { data, error, loading } = useQuery<IDayCounts>(
    SCENE_O_CALENDAR_DAY_COUNTS,
    { variables: { year, ...variables } }
  );
  // The neighbouring years complete a streak that runs over New Year.
  const { data: before } = useQuery<IDayCounts>(SCENE_O_CALENDAR_DAY_COUNTS, {
    variables: { year: year - 1, ...variables },
  });
  const { data: after } = useQuery<IDayCounts>(SCENE_O_CALENDAR_DAY_COUNTS, {
    variables: { year: year + 1, ...variables },
    skip: year >= currentYear,
  });
  const counts = useMemo(() => dayCountMap(data), [data]);
  const calendar = useMemo(
    () => buildOStatsCalendar(year, counts),
    [counts, year]
  );
  const summary = useMemo(
    () =>
      summarizeOStatsCalendar(
        year,
        new Map([...dayCountMap(before), ...counts, ...dayCountMap(after)])
      ),
    [after, before, counts, year]
  );

  return (
    <section className="ostats-section ostats-calendar">
      <div className="ostats-subheader">
        <h2>O Calendar</h2>
        {fixedYear === undefined && (
          <Form.Group
            className="ostats-calendar-year"
            controlId="oCalendarYear"
          >
            <Form.Label className="sr-only">Calendar year</Form.Label>
            <Form.Control
              as="select"
              size="sm"
              value={year}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setYear(Number(event.target.value))
              }
            >
              {(years.length > 0 ? years : [currentYear]).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        )}
      </div>
      {error && <ErrorMessage error={error.message} />}
      {!error && loading && <LoadingIndicator inline />}
      {!error && !loading && (
        <>
          <div className="ostats-calendar-summary">
            <span>{formatStatsTotal(summary.total, "O", "O's")}</span>
            <span>
              {summary.activeDays.toLocaleString(getAppLocaleCustom())} active{" "}
              {summary.activeDays === 1 ? "day" : "days"}
            </span>
            {summary.bestDay && (
              <span>
                Best day:{" "}
                {summary.bestDay.count.toLocaleString(getAppLocaleCustom())} on{" "}
                {longDate(summary.bestDay.date)}
              </span>
            )}
            <span title="Counted whole when it runs over New Year">
              Longest streak:{" "}
              {summary.longestStreak.toLocaleString(getAppLocaleCustom())}{" "}
              {summary.longestStreak === 1 ? "day" : "days"}
            </span>
          </div>
          <div className="ostats-calendar-scroll">
            <div
              className="ostats-calendar-grid"
              style={{
                gridTemplateColumns: `auto repeat(${calendar.weeks.length}, var(--ostats-calendar-cell))`,
              }}
            >
              <span className="ostats-calendar-corner" />
              {calendar.weeks.map((_, week) => {
                const start = calendar.monthStarts.find(
                  (item) => item.week === week
                );
                return (
                  <span className="ostats-calendar-month" key={`m-${week}`}>
                    {start ? monthLabel(start.month) : ""}
                  </span>
                );
              })}
              {WEEKDAY_LABELS.map((label, weekday) => (
                <React.Fragment key={`row-${weekday}`}>
                  <span className="ostats-calendar-weekday">{label}</span>
                  {calendar.weeks.map((week, weekIndex) => {
                    const day = week[weekday];
                    if (!day) {
                      return (
                        <span
                          className="ostats-calendar-cell ostats-calendar-cell--outside"
                          key={`${weekIndex}-${weekday}`}
                        />
                      );
                    }
                    const cellLabel = `${longDate(day.date)}: ${
                      day.tracked
                        ? formatStatsTotal(day.count, "O", "O's")
                        : "before reliable O tracking"
                    }`;
                    const className = `ostats-calendar-cell ostats-calendar-level-${
                      day.level
                    }${day.tracked ? "" : " ostats-calendar-cell--untracked"}`;
                    if (day.count > 0) {
                      const [y, m, d] = day.date.split("-").map(Number);
                      return (
                        <Link
                          aria-label={cellLabel}
                          className={className}
                          key={day.date}
                          title={cellLabel}
                          to={addOStatsStudioScopeToPath(
                            `/ostats/${y}/${m}/${d}`,
                            studioScope
                          )}
                        />
                      );
                    }
                    return (
                      <span
                        aria-label={cellLabel}
                        className={className}
                        key={day.date}
                        title={cellLabel}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="ostats-calendar-legend" aria-hidden="true">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span
                className={`ostats-calendar-cell ostats-calendar-level-${level}`}
                key={level}
              />
            ))}
            <span>More</span>
          </div>
        </>
      )}
    </section>
  );
};
