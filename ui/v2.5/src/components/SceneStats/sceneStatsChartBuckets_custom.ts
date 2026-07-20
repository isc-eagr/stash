export type SceneStatsActivityType = "sex" | "oral" | "solo";

export function sceneStatsPositiveCount(value?: number | null) {
  return typeof value === "number" && value > 0 ? value : undefined;
}

export function sceneStatsRatingBucket(value?: number | null) {
  if (value === null || value === undefined || value <= 0) return undefined;
  const rating = Math.round(value);
  const start = Math.floor(rating / 5) * 5;
  return `${start}-${start + 4}`;
}

export function sceneStatsActivityType(
  hasSex: boolean,
  hasOral: boolean,
  hasSolo: boolean
): SceneStatsActivityType | undefined {
  if (hasSex) return "sex";
  if (hasOral) return "oral";
  if (hasSolo) return "solo";
  return undefined;
}

export function sceneStatsReleaseYear(value?: string | null) {
  if (!value || !/^\d{4}/.test(value)) return undefined;
  const year = Number(value.slice(0, 4));
  return year > 0 && year !== 9999 ? year : undefined;
}

export function sceneStatsReleaseMonth(value?: string | null) {
  if (
    !value ||
    sceneStatsReleaseYear(value) === undefined ||
    !/^\d{4}-\d{2}/.test(value)
  ) {
    return undefined;
  }
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12 ? month : undefined;
}

export function sceneStatsReleaseDay(value?: string | null) {
  const year = sceneStatsReleaseYear(value);
  const month = sceneStatsReleaseMonth(value);
  if (
    !value ||
    year === undefined ||
    month === undefined ||
    !/^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    return undefined;
  }

  const day = Number(value.slice(8, 10));
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }
  return day;
}
