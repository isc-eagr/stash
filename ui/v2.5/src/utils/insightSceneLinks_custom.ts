const prefix = "stash-insight-match:";
const lifetime = 12 * 60 * 60 * 1000;
type MatchSnapshot = { label: string; ids: string[]; created: number };

export function readInsightSceneMatch(key: string): MatchSnapshot | undefined {
  try {
    const match = JSON.parse(localStorage.getItem(prefix + key) ?? "null");
    if (
      !match ||
      Date.now() - match.created >= lifetime ||
      !Array.isArray(match.ids)
    )
      return undefined;
    return match;
  } catch {
    return undefined;
  }
}

export function createInsightSceneLink(label: string, ids: string[]) {
  // Small matching-ID snapshots keep URLs short and preserve the exact preview.
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (
      key?.startsWith(prefix) &&
      !readInsightSceneMatch(key.slice(prefix.length))
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
  };
  localStorage.setItem(prefix + key, JSON.stringify(match));
  return `/scenes?c=${encodeURIComponent(
    JSON.stringify({ type: "insight_chip", modifier: "EQUALS", value: key })
  )}`;
}

export function openInsightSceneLink(label: string, ids: string[]) {
  return (
    window.open(
      createInsightSceneLink(label, ids),
      "_blank",
      "noopener,noreferrer"
    ) !== null
  );
}
