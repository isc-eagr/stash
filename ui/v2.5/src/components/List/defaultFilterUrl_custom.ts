import { ListFilterModel } from "src/models/list-filter/filter";

// CUSTOM: Menu links may carry a preferred card zoom without representing a
// filter. Apply that presentation preference on top of the configured default.
export function getDefaultFilterForListLocationCustom(
  defaultFilter: ListFilterModel,
  search: string
): ListFilterModel | undefined {
  const params = new URLSearchParams(search);
  const keys = Array.from(params.keys());

  if (keys.length === 0) return defaultFilter.clone();
  if (keys.some((key) => key !== "z")) return undefined;

  const rawZoom = params.get("z");
  if (rawZoom === null) return defaultFilter.clone();

  const zoomIndex = Number.parseInt(rawZoom, 10);
  return zoomIndex >= 0
    ? defaultFilter.setZoom(zoomIndex)
    : defaultFilter.clone();
}
