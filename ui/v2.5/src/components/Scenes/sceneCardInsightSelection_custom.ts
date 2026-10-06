import type {
  ISceneCardInsight,
  SceneCardInsightCandidate,
  SceneCardInsightCandidateKind,
} from "./sceneCardInsightTypes_custom";

type InsightPolicy = {
  // Mandatory chips always show; reserved chips outrank optional ones for a slot.
  mandatory?: boolean;
  reserved?: boolean;
  priority: number;
};

export const sceneCardInsightPolicies: Record<
  SceneCardInsightCandidateKind,
  InsightPolicy
> = {
  goat: { mandatory: true, priority: 1000 },
  "outstanding-activity": { mandatory: true, priority: 975 },
  "outstanding-activity-presence": { mandatory: true, priority: 970 },
  "event-report": { mandatory: true, priority: 950 },
  "no-orgasm": { reserved: true, priority: 925 },
  "orgasm-event": { priority: 850 },
  "activity-quality": { priority: 830 },
  leaning: { priority: 825 },
  "only-scene": { priority: 810 },
  // CUSTOM: History-backed rare roles outrank broad interaction patterns.
  "rare-role": { priority: 805 },
  interaction: { priority: 800 },
  "negative-rating": { priority: 790 },
  "short-outstanding": { priority: 785 },
  "favorite-lineup": { priority: 780 },
  "country-lineup": { priority: 770 },
};

export function compareSceneCardInsightCandidates(
  a: SceneCardInsightCandidate,
  b: SceneCardInsightCandidate
) {
  return (
    sceneCardInsightPolicies[b.kind].priority -
      sceneCardInsightPolicies[a.kind].priority ||
    b.score - a.score ||
    a.label.localeCompare(b.label)
  );
}

export function hasSceneCardInsightOverflow(
  totalInsights: number,
  visibleInsights: number
) {
  return totalInsights > visibleInsights;
}

function withoutSelectionFields({
  kind: _kind,
  score: _score,
  ...insight
}: SceneCardInsightCandidate): ISceneCardInsight {
  return insight;
}

export function selectSceneCardInsights(
  candidates: SceneCardInsightCandidate[],
  maxInsights: number
): ISceneCardInsight[] {
  const sorted = candidates
    .filter((candidate) => !candidate.statsOnly)
    .sort(compareSceneCardInsightCandidates);
  const mandatory = sorted.filter(
    (candidate) => sceneCardInsightPolicies[candidate.kind].mandatory
  );
  if (mandatory.length >= maxInsights) {
    return mandatory.slice(0, maxInsights).map(withoutSelectionFields);
  }

  const reserved = sorted.filter(
    (candidate) => sceneCardInsightPolicies[candidate.kind].reserved
  );
  const guaranteed = [...mandatory, ...reserved].slice(0, maxInsights);
  const optional = sorted.filter(
    (candidate) => !guaranteed.includes(candidate)
  );
  return [
    ...guaranteed,
    ...optional.slice(0, Math.max(0, maxInsights - guaranteed.length)),
  ]
    .sort(compareSceneCardInsightCandidates)
    .map(withoutSelectionFields);
}

export function selectAllSceneCardInsights(
  candidates: SceneCardInsightCandidate[]
): ISceneCardInsight[] {
  return [...candidates]
    .filter((candidate) => !candidate.statsOnly)
    .sort(compareSceneCardInsightCandidates)
    .map(withoutSelectionFields);
}
