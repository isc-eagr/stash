import { useCallback, useEffect, useRef, useState } from "react";
import * as GQL from "src/core/generated-graphql";

export function useTaskProgressTrackers() {
  const query = GQL.useFindTaskProgressTrackersQuery({
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [create] = GQL.useTaskProgressTrackerCreateMutation();
  const [update] = GQL.useTaskProgressTrackerUpdateMutation();
  const [destroy] = GQL.useTaskProgressTrackerDestroyMutation();
  const [reorder] = GQL.useTaskProgressTrackersReorderMutation();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<string>();
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const { refetch } = query;
  const refresh = useCallback(async () => {
    if (locked.current) return;
    try {
      await refetch();
      setLastUpdated(new Date());
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refetch]);
  useEffect(() => {
    if (query.data && !query.loading && !query.error)
      setLastUpdated(new Date());
  }, [query.data, query.loading, query.error]);
  const run = async (action: () => Promise<unknown>) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      // The write succeeded even if refreshing fails; don't invite a duplicate write.
      try {
        await refetch();
        setLastUpdated(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await refetch().catch(() => undefined);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return {
    trackers: query.data?.findTaskProgressTrackers,
    loading: query.loading,
    error: error || query.error?.message,
    lastUpdated,
    busy,
    refresh,
    create: (input: GQL.TaskProgressTrackerCreateInput) =>
      run(() => create({ variables: { input } })),
    update: (input: GQL.TaskProgressTrackerUpdateInput) =>
      run(() => update({ variables: { input } })),
    destroy: (id: string) => run(() => destroy({ variables: { id } })),
    reorder: (ids: string[]) => run(() => reorder({ variables: { ids } })),
  };
}
