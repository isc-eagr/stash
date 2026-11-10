import { SortDirectionEnum } from "src/core/generated-graphql";
import type { ListFilterModel } from "src/models/list-filter/filter";
import type { IColumn } from "./ListTable";

// Header click on a list table: the active column flips direction; a new
// column starts ascending for text sorts and descending for metrics.
export function sortFilterByColumnCustom(
  filter: ListFilterModel,
  sortBy: string,
  ascendingFirst: readonly string[]
): ListFilterModel {
  if (filter.sortBy === sortBy) return filter.toggleSortDirection();

  const next = filter.setSortBy(sortBy);
  next.sortDirection = ascendingFirst.includes(sortBy)
    ? SortDirectionEnum.Asc
    : SortDirectionEnum.Desc;
  return next;
}

// The active sort's column, when it is hidden, so the table can show it
// without saving it to the user's column choice.
export function sortColumnExtrasCustom(
  allColumns: readonly IColumn[],
  selectedColumns: readonly string[],
  sortBy: string | undefined
): string[] {
  const sortColumn = allColumns.find((col) => col.sortBy === sortBy);
  if (
    !sortBy ||
    !sortColumn ||
    sortColumn.mandatory ||
    selectedColumns.includes(sortColumn.value)
  ) {
    return [];
  }
  return [sortColumn.value];
}
