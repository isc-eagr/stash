import type { ISortMetricBadgeCustom } from "./SortMetricBadge_custom";

export interface IResolvedSortMetricCustom extends ISortMetricBadgeCustom {
  sortBy: string;
}

export type SortMetricDefinitionCustom<T> = Omit<
  ISortMetricBadgeCustom,
  "value"
> & {
  value: (source: T) => ISortMetricBadgeCustom["value"];
};

export function resolveSortMetricCustom<T>(
  sortBy: string | undefined,
  defaultSortBy: string,
  definitions: Record<string, SortMetricDefinitionCustom<T>>,
  source: T
): IResolvedSortMetricCustom | undefined {
  if (
    !sortBy ||
    sortBy === defaultSortBy ||
    sortBy === "random" ||
    sortBy.startsWith("random_")
  ) {
    return undefined;
  }

  const normalizedSort = sortBy;
  const definition = definitions[normalizedSort];
  if (!definition) return undefined;

  return {
    sortBy: normalizedSort,
    messageID: definition.messageID,
    format: definition.format,
    value: definition.value(source),
  };
}
