export function tagMarkerIncludeSubTagsFromSearch(
  search: string
): boolean | undefined {
  const value = new URLSearchParams(search).get("includeSubTags");
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}
