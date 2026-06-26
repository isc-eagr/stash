export type SceneStatsDurationBucket = {
  key: string;
  label: string;
  sortValue: number;
};

export function durationBucketForMinutes(
  minutes: number
): SceneStatsDurationBucket {
  if (minutes <= 4) {
    return {
      key: "0-4",
      label: "0-4m",
      sortValue: 0,
    };
  }

  if (minutes <= 45) {
    return {
      key: String(minutes),
      label: `${minutes}m`,
      sortValue: minutes,
    };
  }

  const start = Math.floor((minutes - 46) / 5) * 5 + 46;
  const end = start + 4;

  return {
    key: `${start}-${end}`,
    label: `${start}-${end}m`,
    sortValue: start,
  };
}
