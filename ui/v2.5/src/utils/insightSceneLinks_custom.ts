const prefix = "stash-insight-match:";
const lifetime = 12 * 60 * 60 * 1000;
export type InsightMatchEntity = "scene" | "performer";
type MatchSnapshot = {
  label: string;
  ids: string[];
  created: number;
  entity?: InsightMatchEntity;
};

export function readInsightEntityMatch(
  key: string,
  entity: InsightMatchEntity
): MatchSnapshot | undefined {
  try {
    const match = JSON.parse(localStorage.getItem(prefix + key) ?? "null");
    if (
      !match ||
      Date.now() - match.created >= lifetime ||
      !Array.isArray(match.ids)
    )
      return undefined;
    // Snapshots created before entity drilldowns were always Scene matches.
    if ((match.entity ?? "scene") !== entity) return undefined;
    return match;
  } catch {
    return undefined;
  }
}

export function readInsightSceneMatch(key: string): MatchSnapshot | undefined {
  return readInsightEntityMatch(key, "scene");
}

export function createInsightEntityLink(
  entity: InsightMatchEntity,
  label: string,
  ids: string[]
) {
  // Small matching-ID snapshots keep URLs short and preserve the exact preview.
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (
      key?.startsWith(prefix) &&
      !["scene", "performer"].some((candidate) =>
        readInsightEntityMatch(
          key.slice(prefix.length),
          candidate as InsightMatchEntity
        )
      )
    )
      localStorage.removeItem(key);
  }
  // getRandomValues also works on Stash installations served over plain LAN HTTP.
  const key = Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
    value.toString(16).padStart(8, "0")
  ).join("");
  const match: MatchSnapshot = {
    label,
    ids: [...new Set(ids)],
    created: Date.now(),
    entity,
  };
  localStorage.setItem(prefix + key, JSON.stringify(match));
  const path = entity === "scene" ? "/scenes" : "/performers";
  return `${path}?c=${encodeURIComponent(
    JSON.stringify({ type: "insight_chip", modifier: "EQUALS", value: key })
  )}&z=2`;
}

export function createInsightSceneLink(label: string, ids: string[]) {
  return createInsightEntityLink("scene", label, ids);
}

export function openInsightEntityLink(
  entity: InsightMatchEntity,
  label: string,
  ids: string[]
) {
  return (
    window.open(
      createInsightEntityLink(entity, label, ids),
      "_blank",
      "noopener,noreferrer"
    ) !== null
  );
}

export function openInsightSceneLink(label: string, ids: string[]) {
  return openInsightEntityLink("scene", label, ids);
}
