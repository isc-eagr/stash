import TextUtils from "src/utils/text";

// CUSTOM: merge dialog choices for fork-owned scene data. Combined lists start
// with every destination and source row except source duplicates; the backend
// keeps exactly the IDs it receives.

export interface IMergeChoiceScene {
  id: string;
  title?: string | null;
  rating100?: number | null;
  rating_scores: readonly unknown[];
  stashdb_matches?: number | null;
  releases: readonly {
    id: string;
    title?: string | null;
    code?: string | null;
    date?: string | null;
    studio?: { name: string } | null;
  }[];
  negative_markers: readonly {
    id: string;
    name: string;
    start_seconds: number;
    end_seconds: number;
  }[];
  multi_segment_loop_presets: readonly {
    id: string;
    name: string;
    segments: readonly { start: number; end: number }[];
  }[];
}

export interface IMergeItem {
  id: string;
  sceneID: string;
  label: string;
}

export interface IMergeItemChoice {
  items: IMergeItem[];
  destIDs: string[];
  keptIDs: string[];
}

function itemChoice(
  dest: IMergeChoiceScene,
  sources: readonly IMergeChoiceScene[],
  toItems: (scene: IMergeChoiceScene) => (IMergeItem & { key?: string })[]
): IMergeItemChoice {
  const items = [dest, ...sources].flatMap(toItems);
  const seen = new Set<string>();
  const keptIDs = items
    .filter(({ sceneID, key }) => {
      if (key === undefined) return true;
      const duplicate = sceneID !== dest.id && seen.has(key);
      seen.add(key);
      return !duplicate;
    })
    .map(({ id }) => id);

  return {
    items: items.map(({ id, sceneID, label }) => ({ id, sceneID, label })),
    destIDs: items.filter((i) => i.sceneID === dest.id).map(({ id }) => id),
    keptIDs,
  };
}

export const releaseMergeChoice = (
  dest: IMergeChoiceScene,
  sources: readonly IMergeChoiceScene[]
) =>
  itemChoice(dest, sources, (scene) =>
    scene.releases.map((r) => ({
      id: r.id,
      sceneID: scene.id,
      label: [r.title || r.code || `#${r.id}`, r.studio?.name, r.date]
        .filter(Boolean)
        .join(" · "),
    }))
  );

export const negativeMarkerMergeChoice = (
  dest: IMergeChoiceScene,
  sources: readonly IMergeChoiceScene[]
) =>
  itemChoice(dest, sources, (scene) =>
    scene.negative_markers.map((m) => {
      const range = TextUtils.formatTimestampRange(
        m.start_seconds,
        m.end_seconds
      );
      return {
        id: m.id,
        sceneID: scene.id,
        label: m.name.trim() ? `${m.name.trim()} ${range}` : range,
        key: JSON.stringify([m.name, m.start_seconds, m.end_seconds]),
      };
    })
  );

export const loopPresetMergeChoice = (
  dest: IMergeChoiceScene,
  sources: readonly IMergeChoiceScene[]
) =>
  itemChoice(dest, sources, (scene) =>
    scene.multi_segment_loop_presets.map((p) => {
      const segments = p.segments.map(({ start, end }) => [start, end]);
      const ranges = p.segments
        .slice(0, 3)
        .map(({ start, end }) => TextUtils.formatTimestampRange(start, end));
      if (p.segments.length > 3) ranges.push("…");
      return {
        id: p.id,
        sceneID: scene.id,
        label: `${p.name} · ${ranges.join(", ")}`,
        key: JSON.stringify([p.name, segments]),
      };
    })
  );

const hasRating = (scene: IMergeChoiceScene) =>
  scene.rating100 != null || scene.rating_scores.length > 0;

export interface ISceneValueChoice<
  T extends IMergeChoiceScene = IMergeChoiceScene
> {
  candidates: T[];
  // the default scene when the destination is not used
  sourceID?: string;
  useSource: boolean;
}

// Mirrors the backend default: destination advisor answers win, then the
// first source's answers, then the destination's manual rating.
export function ratingMergeChoice<T extends IMergeChoiceScene>(
  dest: T,
  sources: readonly T[]
): ISceneValueChoice<T> {
  const candidates = sources.filter(hasRating);
  const withAnswers = candidates.find((s) => s.rating_scores.length > 0);
  const source = withAnswers ?? candidates[0];
  const useSource =
    !!source &&
    dest.rating_scores.length === 0 &&
    (!!withAnswers || dest.rating100 == null);
  return { candidates, sourceID: source?.id, useSource };
}

export function stashDBMatchesMergeChoice<T extends IMergeChoiceScene>(
  dest: T,
  sources: readonly T[]
): ISceneValueChoice<T> {
  const candidates = sources.filter(
    (s) =>
      s.stashdb_matches != null && s.stashdb_matches !== dest.stashdb_matches
  );
  return {
    candidates,
    sourceID: candidates[0]?.id,
    useSource: candidates.length > 0 && dest.stashdb_matches == null,
  };
}
