export type ActivityTypeDurationsCustom = {
  sex: number;
  oral: number;
  solo: number;
};

const activityTypeOrderCustom = ["sex", "oral", "solo"] as const;

export function getPartitionPercentagesCustom<T extends string>(
  durations: Record<T, number>,
  order: readonly T[]
): Record<T, number> {
  const safeDurations = Object.fromEntries(
    order.map((key) => [
      key,
      Number.isFinite(durations[key]) ? Math.max(0, durations[key]) : 0,
    ])
  ) as Record<T, number>;
  const total = order.reduce((sum, key) => sum + safeDurations[key], 0);
  if (total <= 0) {
    return Object.fromEntries(order.map((key) => [key, 0])) as Record<
      T,
      number
    >;
  }

  const exact = Object.fromEntries(
    order.map((key) => [key, (safeDurations[key] / total) * 100])
  ) as Record<T, number>;
  const result = Object.fromEntries(
    order.map((key) => [key, Math.floor(exact[key])])
  ) as Record<T, number>;
  let remainder = 100 - order.reduce((sum, key) => sum + result[key], 0);

  [...order]
    .sort(
      (left, right) =>
        exact[right] - result[right] - (exact[left] - result[left]) ||
        order.indexOf(left) - order.indexOf(right)
    )
    .forEach((key) => {
      if (remainder <= 0) return;
      result[key] += 1;
      remainder -= 1;
    });

  return result;
}

// CUSTOM: Allocate whole-number display percentages with the largest-remainder
// method so the three classified activity types always add up to exactly 100.
export function getActivityTypePercentagesCustom(
  durations: ActivityTypeDurationsCustom
): ActivityTypeDurationsCustom {
  return getPartitionPercentagesCustom(durations, activityTypeOrderCustom);
}
