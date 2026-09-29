type VatoStatsAgeCount = {
  age_range: string;
  count: number;
};

export type VatoStatsPerformer = {
  id: string;
  name: string;
  image_path?: string | null;
  rating100?: number | null;
  scene_o_count: number;
  scene_o_count_past_year: number;
  is_past_year: boolean;
  scene_count: number;
  sex_top_count: number;
  sex_bottom_count: number;
  oral_top_count: number;
  oral_bottom_count: number;
  solo_scene_count: number;
  facial_given_count: number;
  facial_received_count: number;
  most_recent_o_date?: string | null;
  career_span_days: number;
  metallic_rating?: string | null;
  ethnicity?: string | null;
  country?: string | null;
  hair_color?: string | null;
  eye_color?: string | null;
  height_cm?: number | null;
  penis_length?: number | null;
  circumcised?: string | null;
  unknown_scene_age_count: number;
  age_counts: VatoStatsAgeCount[];
};

// Short transport keys avoid repeating long field names for every performer.
export type VatoStatsCompactData = {
  p: Array<{
    a: VatoStatsPerformer["id"];
    b: VatoStatsPerformer["name"];
    c: VatoStatsPerformer["image_path"];
    d: VatoStatsPerformer["rating100"];
    e: VatoStatsPerformer["scene_o_count"];
    f: VatoStatsPerformer["scene_o_count_past_year"];
    g: VatoStatsPerformer["is_past_year"];
    h: VatoStatsPerformer["scene_count"];
    i: VatoStatsPerformer["sex_top_count"];
    j: VatoStatsPerformer["sex_bottom_count"];
    k: VatoStatsPerformer["oral_top_count"];
    l: VatoStatsPerformer["oral_bottom_count"];
    m: VatoStatsPerformer["solo_scene_count"];
    n: VatoStatsPerformer["facial_given_count"];
    o: VatoStatsPerformer["facial_received_count"];
    p: VatoStatsPerformer["most_recent_o_date"];
    q: VatoStatsPerformer["career_span_days"];
    r: VatoStatsPerformer["metallic_rating"];
    s: VatoStatsPerformer["ethnicity"];
    t: VatoStatsPerformer["country"];
    u: VatoStatsPerformer["hair_color"];
    v: VatoStatsPerformer["eye_color"];
    w: VatoStatsPerformer["height_cm"];
    x: VatoStatsPerformer["penis_length"];
    y: VatoStatsPerformer["circumcised"];
    z: VatoStatsPerformer["unknown_scene_age_count"];
    ac: Array<{ a: string; c: number }>;
  }>;
  o: number;
  t: number;
};

export function expandVatoStatsCompactData(data?: VatoStatsCompactData) {
  return {
    vatoStatsPerformers: (data?.p ?? []).map(
      (p): VatoStatsPerformer => ({
        id: p.a,
        name: p.b,
        image_path: p.c,
        rating100: p.d,
        scene_o_count: p.e,
        scene_o_count_past_year: p.f,
        is_past_year: p.g,
        scene_count: p.h,
        sex_top_count: p.i,
        sex_bottom_count: p.j,
        oral_top_count: p.k,
        oral_bottom_count: p.l,
        solo_scene_count: p.m,
        facial_given_count: p.n,
        facial_received_count: p.o,
        most_recent_o_date: p.p,
        career_span_days: p.q,
        metallic_rating: p.r,
        ethnicity: p.s,
        country: p.t,
        hair_color: p.u,
        eye_color: p.v,
        height_cm: p.w,
        penis_length: p.x,
        circumcised: p.y,
        unknown_scene_age_count: p.z,
        age_counts: p.ac.map((age) => ({ age_range: age.a, count: age.c })),
      })
    ),
    sceneOrgasmCount: data?.o ?? 0,
    totalOrgasmTime: data?.t ?? 0,
  };
}
