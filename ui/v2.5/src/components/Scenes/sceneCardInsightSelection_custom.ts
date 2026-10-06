import type {
  ISceneCardInsight,
  SceneCardInsightCandidate,
  SceneCardInsightCandidateKind,
} from "./sceneCardInsightTypes_custom";

const sceneCardInsightPriority: Record<SceneCardInsightCandidateKind, number> =
  {
    "orgasm-event": 3,
    "only-scene": 2,
    "rare-role": 1,
  };

function compareSceneCardInsightCandidates(
  a: SceneCardInsightCandidate,
  b: SceneCardInsightCandidate
) {
  return (
    sceneCardInsightPriority[b.kind] - sceneCardInsightPriority[a.kind] ||
    b.score - a.score ||
    a.label.localeCompare(b.label)
  );
}

// Highest priority first, capped at the visible limit when one is given.
export function selectSceneCardInsights(
  candidates: SceneCardInsightCandidate[],
  maxInsights?: number
): ISceneCardInsight[] {
  return [...candidates]
    .sort(compareSceneCardInsightCandidates)
    .slice(0, maxInsights)
    .map(({ kind: _kind, score: _score, ...insight }) => insight);
}
