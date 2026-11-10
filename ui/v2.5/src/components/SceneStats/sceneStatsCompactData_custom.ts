export type SceneStatsMarker = {
  tag_ids: string[];
};

export type SceneStatsScene = {
  id: string;
  title?: string | null;
  date?: string | null;
  effective_date?: string | null;
  rating100?: number | null;
  o_counter?: number | null;
  duration: number;
  filesize: number;
  performer_count: number;
  performer_ids: string[];
  performer_ethnicities: string[];
  performer_countries: string[];
  // Vato ratings in performer_ids order; null when unrated.
  performer_ratings: (number | null)[];
  scene_markers: SceneStatsMarker[];
  tags: string[];
  primary_width?: number | null;
  primary_height?: number | null;
  most_recent_o_date?: string | null;
  has_royal_sapphire_bonus: boolean;
  // Unorganized scenes count only toward Duration and Resolution.
  organized: boolean;
  // StashDB Matches of the scene plus its releases; null when never scraped.
  stashdb_matches?: number | null;
  studio_id?: string | null;
};

type CompactSceneStatsMarker = {
  g: string[];
};

type CompactSceneStatsScene = {
  i: string;
  t?: string | null;
  d?: string | null;
  e?: string | null;
  a?: number | null;
  o?: number | null;
  u: number;
  z: number;
  v: number;
  b: string[];
  j: string[];
  k: string[];
  p: (number | null)[];
  m: CompactSceneStatsMarker[];
  g: string[];
  x?: number | null;
  y?: number | null;
  q?: string | null;
  h: boolean;
  w: boolean;
  n?: number | null;
  c?: string | null;
};

export type SceneStatsCompactData = {
  s: {
    r: CompactSceneStatsScene[];
  };
};

export function expandSceneStatsCompactData(data?: SceneStatsCompactData): {
  scenes: SceneStatsScene[];
} {
  return {
    scenes: (data?.s.r ?? []).map((scene) => ({
      id: scene.i,
      title: scene.t,
      date: scene.d,
      effective_date: scene.e,
      rating100: scene.a,
      o_counter: scene.o,
      duration: scene.u,
      filesize: scene.z,
      performer_count: scene.v,
      performer_ids: scene.b,
      performer_ethnicities: scene.j,
      performer_countries: scene.k,
      performer_ratings: scene.p,
      scene_markers: scene.m.map((marker) => ({ tag_ids: marker.g })),
      tags: scene.g,
      primary_width: scene.x,
      primary_height: scene.y,
      most_recent_o_date: scene.q,
      has_royal_sapphire_bonus: scene.h,
      organized: scene.w,
      stashdb_matches: scene.n,
      studio_id: scene.c,
    })),
  };
}
