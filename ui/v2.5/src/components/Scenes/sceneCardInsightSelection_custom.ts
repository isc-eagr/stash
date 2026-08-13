import type {
  ISceneCardInsight,
  SceneCardInsightCandidate,
  SceneCardInsightCandidateKind,
} from "./sceneCardInsightTypes_custom";

type InsightLane =
  | "automatic"
  | "priority"
  | "activity"
  | "leaning"
  | "context";

type InsightPolicy = {
  lane: InsightLane;
  mandatory?: boolean;
  priority: number;
};

export const sceneCardInsightPolicies: Record<
  SceneCardInsightCandidateKind,
  InsightPolicy
> = {
  goat: { lane: "automatic", mandatory: true, priority: 1000 },
  facial: { lane: "automatic", mandatory: true, priority: 950 },
  "no-orgasm": { lane: "priority", priority: 925 },
  "really-hot-event": { lane: "automatic", priority: 900 },
  "orgasm-event": { lane: "automatic", priority: 850 },
  "activity-quality": { lane: "activity", priority: 830 },
  leaning: { lane: "leaning", priority: 825 },
  interaction: { lane: "context", priority: 800 },
  "negative-rating": { lane: "context", priority: 790 },
  "favorite-lineup": { lane: "context", priority: 780 },
  "country-lineup": { lane: "context", priority: 770 },
  filler: { lane: "context", priority: 760 },
  "few-highlights": { lane: "context", priority: 750 },
  tag: { lane: "context", priority: 700 },
  "everybody-nuts": { lane: "context", priority: 690 },
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

const maxInsights = 7;
const maxActivityInsights = 2;
const ordinaryContextSlots = 5;

export function selectSceneCardInsights(
  candidates: SceneCardInsightCandidate[]
): ISceneCardInsight[] {
  const sorted = [...candidates].sort(compareSceneCardInsightCandidates);
  const mandatory = sorted.filter(
    (candidate) => sceneCardInsightPolicies[candidate.kind].mandatory
  );
  if (mandatory.length > maxInsights) {
    return mandatory.map(
      ({ kind: _kind, score: _score, ...insight }) => insight
    );
  }

  const leaning = sorted.filter(
    (candidate) => sceneCardInsightPolicies[candidate.kind].lane === "leaning"
  );
  const prioritized = sorted.filter(
    (candidate) => sceneCardInsightPolicies[candidate.kind].lane === "priority"
  );
  const optionalAutomatic = sorted.filter((candidate) => {
    const policy = sceneCardInsightPolicies[candidate.kind];
    return policy.lane === "automatic" && !policy.mandatory;
  });

  const automaticCapacity = Math.max(
    0,
    maxInsights - mandatory.length - prioritized.length - leaning.length
  );
  const automatic = [
    ...mandatory,
    ...prioritized,
    ...optionalAutomatic.slice(0, automaticCapacity),
  ];
  const availableAfterAutomatic = Math.max(
    0,
    maxInsights - automatic.length - leaning.length
  );
  const activities = sorted
    .filter(
      (candidate) =>
        sceneCardInsightPolicies[candidate.kind].lane === "activity"
    )
    .slice(0, Math.min(maxActivityInsights, availableAfterAutomatic));
  const contextCapacity = Math.min(
    ordinaryContextSlots,
    Math.max(
      0,
      maxInsights - automatic.length - leaning.length - activities.length
    )
  );
  const context = sorted
    .filter(
      (candidate) => sceneCardInsightPolicies[candidate.kind].lane === "context"
    )
    .slice(0, contextCapacity);

  return [...automatic, ...activities, ...leaning, ...context]
    .sort(compareSceneCardInsightCandidates)
    .slice(0, maxInsights)
    .map(({ kind: _kind, score: _score, ...insight }) => insight);
}
