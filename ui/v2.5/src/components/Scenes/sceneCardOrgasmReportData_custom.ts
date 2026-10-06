import type { SceneCardInsightEvent } from "./sceneCardInsightTypes_custom";

// CUSTOM: one icon group per event kind on the scene card orgasm report.
export type SceneCardOrgasmReportGroupCustom = {
  category: SceneCardInsightEvent["category"];
  quality?: SceneCardInsightEvent["quality"];
  count: number;
};

const qualityOrder: ReadonlyArray<SceneCardInsightEvent["quality"]> = [
  undefined,
  "Really Hot",
  "GOAT",
];

// Regular orgasms, then facials; each plain, Really Hot, then GOAT, so the
// best events end up at the right edge.
export function getSceneCardOrgasmReportGroupsCustom(
  events: readonly SceneCardInsightEvent[]
): SceneCardOrgasmReportGroupCustom[] {
  return (["orgasm", "facial"] as const).flatMap((category) =>
    qualityOrder.flatMap((quality) => {
      const count = events.filter(
        (event) => event.category === category && event.quality === quality
      ).length;
      return count > 0
        ? [{ category, ...(quality ? { quality } : {}), count }]
        : [];
    })
  );
}

export function sceneCardOrgasmReportGroupLabelCustom({
  category,
  quality,
  count,
}: SceneCardOrgasmReportGroupCustom) {
  const noun =
    category === "facial"
      ? count === 1
        ? "facial"
        : "facials"
      : count === 1
      ? "orgasm"
      : "orgasms";
  return [count, quality, noun].filter(Boolean).join(" ");
}
