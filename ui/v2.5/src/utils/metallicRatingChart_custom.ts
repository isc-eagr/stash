export type MetallicRatingChartKey =
  | "none"
  | "bronze"
  | "silver"
  | "gold"
  | "royal_sapphire";

export type MetallicRatingChartBucket = {
  key: MetallicRatingChartKey;
  label: string;
  sortValue: number;
};

const metallicRatingChartBuckets: Record<
  MetallicRatingChartKey,
  MetallicRatingChartBucket
> = {
  none: { key: "none", label: "None", sortValue: 0 },
  bronze: { key: "bronze", label: "Bronze", sortValue: 1 },
  silver: { key: "silver", label: "Silver", sortValue: 2 },
  gold: { key: "gold", label: "Gold", sortValue: 3 },
  royal_sapphire: {
    key: "royal_sapphire",
    label: "Royal Sapphire",
    sortValue: 4,
  },
};

export function metallicRatingChartBucket(
  rating?: number | null,
  metallicRating?: string | null
): MetallicRatingChartBucket | undefined {
  if (
    metallicRating &&
    Object.prototype.hasOwnProperty.call(
      metallicRatingChartBuckets,
      metallicRating
    )
  ) {
    return metallicRatingChartBuckets[metallicRating as MetallicRatingChartKey];
  }

  if (rating === null || rating === undefined) return undefined;
  return metallicRatingChartBuckets.none;
}
