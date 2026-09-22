export const taskProgressFilterValues = [
  "CURRENT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
  "ALL",
] as const;

export type TaskProgressFilter = (typeof taskProgressFilterValues)[number];

function isTaskProgressFilter(
  value: string | null
): value is TaskProgressFilter {
  return (
    value !== null &&
    taskProgressFilterValues.includes(value as TaskProgressFilter)
  );
}

export function taskProgressFilterFromSearch(
  search: string
): TaskProgressFilter {
  const value = new URLSearchParams(search).get("status");
  return isTaskProgressFilter(value) ? value : "CURRENT";
}

export function taskProgressSearchForFilter(
  search: string,
  filter: string
): string {
  const parameters = new URLSearchParams(search);
  if (!isTaskProgressFilter(filter) || filter === "CURRENT") {
    parameters.delete("status");
  } else {
    parameters.set("status", filter);
  }

  const value = parameters.toString();
  return value ? `?${value}` : "";
}
