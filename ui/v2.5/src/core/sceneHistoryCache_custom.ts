export interface ISceneHistoryEntryCustom {
  date: string;
  videoTimestamp?: number | null;
}

function compareHistoryEntriesCustom(
  left: ISceneHistoryEntryCustom,
  right: ISceneHistoryEntryCustom
) {
  return new Date(right.date).getTime() - new Date(left.date).getTime();
}

export function addSceneHistoryEntriesCustom(
  history: readonly string[] | undefined,
  dates: readonly string[],
  videoTimestamps?: readonly (number | null)[],
  addedVideoTimestamps?: readonly (number | null)[]
): ISceneHistoryEntryCustom[] {
  const entries = (history ?? []).map((date, index) => ({
    date,
    videoTimestamp: videoTimestamps?.[index] ?? null,
  }));

  entries.push(
    ...dates.map((date, index) => ({
      date,
      videoTimestamp: addedVideoTimestamps?.[index] ?? null,
    }))
  );
  entries.sort(compareHistoryEntriesCustom);

  return entries;
}

export function removeSceneHistoryEntriesCustom(
  history: readonly string[] | undefined,
  dates: readonly string[] | undefined,
  videoTimestamps?: readonly (number | null)[]
): ISceneHistoryEntryCustom[] {
  const entries = (history ?? []).map((date, index) => ({
    date,
    videoTimestamp: videoTimestamps?.[index] ?? null,
  }));

  if (!dates?.length) {
    return entries.slice(1);
  }

  for (const date of dates) {
    const index = entries.findIndex((entry) => entry.date === date);
    if (index >= 0) entries.splice(index, 1);
  }

  return entries;
}
