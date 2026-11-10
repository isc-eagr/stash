// Release edits affect scene lists, effective dates, galleries, ratings, and
// global histories. Refresh mounted queries after discrete mutations so views
// sharing those counts do not retain stale cache entries.
export const releaseMutationCacheRefreshCustom = {
  refetchQueries: "active" as const,
  awaitRefetchQueries: true,
};
