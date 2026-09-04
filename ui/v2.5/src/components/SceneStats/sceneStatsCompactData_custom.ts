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
  o_counter_past_year: number;
  is_past_year: boolean;
  is_release_past_year: boolean;
  duration: number;
  filesize: number;
  performer_count: number;
  performer_count_past_year: number;
  performer_ethnicities: string[];
  performer_countries: string[];
  scene_markers: SceneStatsMarker[];
  tags: string[];
  primary_width?: number | null;
  primary_height?: number | null;
  most_recent_o_date?: string | null;
  has_royal_sapphire_bonus: boolean;
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
  p: number;
  n: boolean;
  l: boolean;
  u: number;
  z: number;
  v: number;
  w: number;
  j: string[];
  k: string[];
  m: CompactSceneStatsMarker[];
  g: string[];
  x?: number | null;
  y?: number | null;
  q?: string | null;
  h: boolean;
};

export type SceneStatsCompactData = {
  s: {
    r: CompactSceneStatsScene[];
  };
};

export function expandSceneStatsCompactData(
  data?: SceneStatsCompactData
): SceneStatsScene[] {
  return (data?.s.r ?? []).map((scene) => ({
    id: scene.i,
    title: scene.t,
    date: scene.d,
    effective_date: scene.e,
    rating100: scene.a,
    o_counter: scene.o,
    o_counter_past_year: scene.p,
    is_past_year: scene.n,
    is_release_past_year: scene.l,
    duration: scene.u,
    filesize: scene.z,
    performer_count: scene.v,
    performer_count_past_year: scene.w,
    performer_ethnicities: scene.j,
    performer_countries: scene.k,
    scene_markers: scene.m.map((marker) => ({ tag_ids: marker.g })),
    tags: scene.g,
    primary_width: scene.x,
    primary_height: scene.y,
    most_recent_o_date: scene.q,
    has_royal_sapphire_bonus: scene.h,
  }));
}
