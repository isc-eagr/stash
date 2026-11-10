export type StatsViewFilter<C extends string = string> = {
  category: C;
  label: string;
  value: string;
};

export type StatsViewState<C extends string, M extends string> = {
  filters: StatsViewFilter<C>[];
  metric: M;
  studio?: {
    id: string;
    name: string;
    aliases: string[];
    image_path?: string | null;
  };
  includeChildStudios: boolean;
  showList: boolean;
};

export type StatsViewOptions<C extends string, M extends string> = {
  prefix: string;
  categories: readonly C[];
  metrics: readonly M[];
  defaultMetric: M;
};

export function readStatsView<C extends string, M extends string>(
  search: string,
  options: StatsViewOptions<C, M>
): StatsViewState<C, M> {
  const params = new URLSearchParams(search);
  const key = (name: string) => `${options.prefix}${name}`;
  const metric = params.get(key("Metric")) as M;
  const filters: StatsViewFilter<C>[] = [];
  for (const value of params.getAll(key("Filter"))) {
    try {
      const filter = JSON.parse(value);
      if (
        filter &&
        options.categories.includes(filter.category) &&
        typeof filter.value === "string" &&
        typeof filter.label === "string" &&
        !filters.some(
          (item) =>
            item.category === filter.category && item.value === filter.value
        )
      ) {
        filters.push({
          category: filter.category,
          label: filter.label,
          value: filter.value,
        });
      }
    } catch {
      // Ignore malformed URL filters without losing the rest of the view.
    }
  }
  const studioID = params.get(key("Studio"));
  return {
    filters,
    metric: options.metrics.includes(metric) ? metric : options.defaultMetric,
    studio: studioID
      ? {
          id: studioID,
          name: params.get(key("StudioName")) || `Studio ${studioID}`,
          aliases: [],
          image_path: "",
        }
      : undefined,
    includeChildStudios: params.get(key("Children")) !== "false",
    showList: params.get(key("List")) === "true",
  };
}

export function writeStatsView<C extends string, M extends string>(
  search: string,
  options: StatsViewOptions<C, M>,
  view: StatsViewState<C, M>
) {
  const params = new URLSearchParams(search);
  const key = (name: string) => `${options.prefix}${name}`;
  for (const name of [
    "Filter",
    "Metric",
    "Studio",
    "StudioName",
    "Children",
    "List",
  ]) {
    params.delete(key(name));
  }
  for (const filter of view.filters)
    params.append(key("Filter"), JSON.stringify(filter));
  if (view.metric !== options.defaultMetric)
    params.set(key("Metric"), view.metric);
  if (view.studio) {
    params.set(key("Studio"), view.studio.id);
    params.set(key("StudioName"), view.studio.name);
  }
  if (!view.includeChildStudios) params.set(key("Children"), "false");
  if (view.showList) params.set(key("List"), "true");
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function removeStatsFilter<C extends string>(
  filters: StatsViewFilter<C>[],
  index: number
) {
  return filters.filter((_, itemIndex) => itemIndex !== index);
}
