import { useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import type { StatsDateRangeInput } from "src/core/generated-graphql";
import {
  readStatsDateRange,
  statsDateRangeVariable,
  writeStatsDateRange,
  type IStatsDateRange,
} from "src/utils/statsDateRange_custom";

export function useStatsDateRange() {
  const history = useHistory();
  const location = useLocation();
  const range = useMemo(
    () => readStatsDateRange(location.search),
    [location.search]
  );
  // Stable across renders so data hooks keyed on it only refetch on change.
  const variableKey = JSON.stringify(statsDateRangeVariable(range));
  const variable = useMemo(
    // The string field values match the generated StatsDateField enum.
    () => JSON.parse(variableKey) as StatsDateRangeInput | null,
    [variableKey]
  );

  function setRange(next: IStatsDateRange) {
    const current = history.location;
    const search = writeStatsDateRange(current.search, next);
    if (search !== current.search) history.push({ ...current, search });
  }

  return { range, variable, setRange };
}
