import { useMemo } from "react";
import type { SetStateAction } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  readStatsView,
  writeStatsView,
  type StatsViewOptions,
  type StatsViewState,
} from "src/utils/statsViewState_custom";

export function useStatsViewState<C extends string, M extends string>(
  options: StatsViewOptions<C, M>
) {
  const history = useHistory();
  const location = useLocation();
  const view = useMemo(
    () => readStatsView(location.search, options),
    [location.search, options]
  );

  function updateView(
    update:
      | Partial<StatsViewState<C, M>>
      | ((current: StatsViewState<C, M>) => Partial<StatsViewState<C, M>>),
    pathname = history.location.pathname
  ) {
    const currentLocation = history.location;
    const current = readStatsView(currentLocation.search, options);
    const patch = typeof update === "function" ? update(current) : update;
    const search = writeStatsView(currentLocation.search, options, {
      ...current,
      ...patch,
    });
    if (
      search !== currentLocation.search ||
      pathname !== currentLocation.pathname
    ) {
      history.push({ ...currentLocation, pathname, search });
    }
  }

  function setField<K extends keyof StatsViewState<C, M>>(
    key: K,
    value: SetStateAction<StatsViewState<C, M>[K]>
  ) {
    updateView((current) => ({
      [key]: typeof value === "function" ? value(current[key]) : value,
    }));
  }

  return {
    view,
    updateView,
    setFilters: (value: SetStateAction<StatsViewState<C, M>["filters"]>) =>
      setField("filters", value),
    setMetric: (value: M) => setField("metric", value),
    setShowList: (value: SetStateAction<boolean>) =>
      setField("showList", value),
  };
}
