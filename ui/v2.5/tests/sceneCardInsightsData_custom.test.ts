import assert from "node:assert/strict";
import test from "node:test";

import { getSceneCardInsights } from "../src/components/Scenes/sceneCardInsightsData_custom.ts";

const tag = (
  id: string,
  name: string,
  parents: Array<{ id: string }> = []
) => ({ id, name, parents });

const performer = (
  id: string,
  name: string,
  metadata: {
    country?: string;
    rating100?: number;
    rating_tier_tags?: Array<{ id: string }>;
  } = {}
) => ({ id, name, ...metadata });

const ratingScore = (key: string, rawValue: number, section = "criterion") => ({
  section,
  key,
  raw_value: rawValue,
});

const marker = (
  id: string,
  primaryTag: ReturnType<typeof tag>,
  seconds: number,
  endSeconds: number | null,
  secondaryTags: Array<ReturnType<typeof tag>> = [],
  topPerformers: Array<ReturnType<typeof performer>> = [],
  bottomPerformers: Array<ReturnType<typeof performer>> = []
) => ({
  id,
  seconds,
  end_seconds: endSeconds,
  primary_tag: primaryTag,
  tags: secondaryTags,
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});

const roleTagIds = {
  sexTagId: "sex",
  oralTagId: "oral",
  soloTagId: "solo",
  orgasmTagId: "orgasm",
  facialTagId: "facial",
  secondCameraTagId: "second-camera",
  reallyHotTagId: "really-hot",
  goatTagId: "goat",
};

const makeScene = (
  sceneMarkers: ReturnType<typeof marker>[],
  duration = 600,
  scenePerformers?: Array<ReturnType<typeof performer>>
) => {
  const derivedPerformers = new Map<string, ReturnType<typeof performer>>();
  sceneMarkers.forEach((sceneMarker) =>
    [...sceneMarker.top_performers, ...sceneMarker.bottom_performers].forEach(
      (scenePerformer) =>
        derivedPerformers.set(scenePerformer.id, scenePerformer)
    )
  );
  return {
    id: "scene-1",
    files: [{ duration }],
    performers: scenePerformers ?? Array.from(derivedPerformers.values()),
    scene_markers: sceneMarkers,
  };
};

const labels = (
  sceneMarkers: ReturnType<typeof marker>[],
  duration = 600,
  thresholds = {},
  scenePerformers?: Array<ReturnType<typeof performer>>
) =>
  getSceneCardInsights(
    makeScene(sceneMarkers, duration, scenePerformers),
    roleTagIds,
    thresholds
  ).map((insight) => insight.label);

const suppressNegatives = {
  fewHighlightsMaxEpisodes: 0,
  fillerTotalPercent: 100,
};

const ratingCriterionLabels = (
  performerCount: number,
  ratingScores: Array<ReturnType<typeof ratingScore>>
) => {
  const scenePerformers = Array.from({ length: performerCount }, (_, index) =>
    performer(`vato-${index}`, `Vato ${index}`)
  );
  return getSceneCardInsights(
    {
      ...makeScene([], 100, scenePerformers),
      rating_scores: ratingScores,
    },
    roleTagIds,
    suppressNegatives
  ).map((insight) => insight.label);
};

const interactionMarker = (
  id: string,
  category: "sex" | "oral",
  top: ReturnType<typeof performer>,
  bottom: ReturnType<typeof performer>,
  start = 0
) =>
  marker(id, tag(category, category), start, start + 61, [], [top], [bottom]);

test("ordinary tags require minimum scene coverage", () => {
  const feet = tag("feet", "Feet");
  const closeup = tag("closeup", "Closeup");
  const sceneLabels = labels(
    [
      marker("feet-1", feet, 0, 61),
      marker("closeup-1", closeup, 100, 120),
      marker("closeup-2", closeup, 140, 160),
      marker("closeup-3", closeup, 180, 200),
    ],
    500,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Good amount of Feet"));
  assert.ok(sceneLabels.includes("Good amount of Closeup"));
});

test("overlapping tag ranges count as one distinct episode", () => {
  const feet = tag("feet", "Feet");
  assert.equal(
    labels(
      [
        marker("feet-1", feet, 0, 25),
        marker("feet-2", feet, 10, 30),
        marker("feet-3", feet, 20, 35),
      ],
      600,
      suppressNegatives
    ).includes("Lots of Feet"),
    false
  );
});

test("tag levels are based solely on scene coverage", () => {
  const feet = tag("feet", "Feet");
  const sceneLabels = labels(
    [marker("feet-1", feet, 0, 10)],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Good amount of Feet"));
});

test("highlight tags merge only when performer and amount level both match", () => {
  const tyga = performer("tyga", "Tyga Martinez");
  const sceneLabels = labels(
    [
      marker("pito", tag("pito", "Dick"), 0, 61, [], [tyga]),
      marker("body-1", tag("body", "Body"), 70, 80, [], [tyga]),
      marker("body-2", tag("body", "Body"), 90, 100, [], [tyga]),
      marker("body-3", tag("body", "Body"), 110, 120, [], [tyga]),
    ],
    200,
    { ...suppressNegatives, tagEyeCanSeeMinPercent: 80 }
  );

  assert.ok(sceneLabels.includes("Lots of Dick from Tyga Martinez"));
  assert.ok(sceneLabels.includes("Good amount of Body from Tyga Martinez"));
  assert.equal(
    sceneLabels.filter((label) => label.includes("Tyga Martinez")).length,
    2
  );
});

test("same-performer highlight tags at the same amount level still merge", () => {
  const tyga = performer("tyga", "Tyga Martinez");
  const sceneLabels = labels(
    [
      marker("pito", tag("pito", "Dick"), 0, 61, [], [tyga]),
      marker("body", tag("body", "Body"), 70, 125, [], [tyga]),
    ],
    200,
    { ...suppressNegatives, tagEyeCanSeeMinPercent: 80 }
  );

  assert.ok(sceneLabels.includes("Lots of Dick and Body from Tyga Martinez"));
  assert.equal(
    sceneLabels.filter((label) => label.includes("Tyga Martinez")).length,
    1
  );
});

test("the same outstanding tag from different performers stays one generic chip", () => {
  const peuops = performer("peuops", "Peuops Ramos");
  const erivaldo = performer("erivaldo", "Erivaldo Ribeiro");
  const pito = tag("pito", "pito");
  const sceneLabels = labels(
    [
      marker("pito-peuops", pito, 0, 31, [], [peuops]),
      marker("pito-erivaldo", pito, 40, 71, [], [erivaldo]),
    ],
    100,
    { ...suppressNegatives, tagEyeCanSeeMinPercent: 80 }
  );

  assert.ok(sceneLabels.includes("Lots of pito"));
  assert.equal(
    sceneLabels.some(
      (label) =>
        label.includes("Peuops Ramos") || label.includes("Erivaldo Ribeiro")
    ),
    false
  );
});

test("standard Facials are always reported below ordinary tag coverage thresholds", () => {
  const sceneLabels = labels(
    [marker("facial", tag("facial", "Facial"), 0, 1)],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Facials ×1"));
});

test("Facial-family subtags aggregate into one semantic count", () => {
  const facial = tag("facial", "Facial", [tag("orgasm", "Orgasm")]);
  const selfFacial = tag("self-facial", "Self Facial", [facial]);
  const sceneLabels = labels(
    [
      marker("facial-1", facial, 0, 5),
      marker("facial-2", facial, 10, 15),
      marker("self-facial-1", selfFacial, 20, 25),
      marker("self-facial-2", selfFacial, 30, 35),
    ],
    100,
    suppressNegatives
  );

  assert.deepEqual(
    sceneLabels.filter((label) => label.startsWith("Facials ×")),
    ["Facials ×4"]
  );
});

test("standard, Really Hot, and GOAT Facials use only three scene-wide variants", () => {
  const peuops = performer("peuops", "Peuops Ramos");
  const qualifiers = {
    goat: tag("goat", "GOAT"),
    reallyHot: tag("really-hot", "Really Hot"),
  };
  const sceneLabels = labels(
    [
      marker("standard-1", tag("facial", "Facial"), 0, 5, [], [peuops]),
      marker("standard-2", tag("facial", "Facial"), 10, 15, [], [peuops]),
      marker(
        "hot-1",
        tag("facial", "Facial"),
        20,
        25,
        [qualifiers.reallyHot],
        [peuops]
      ),
      marker(
        "hot-2",
        tag("facial", "Facial"),
        30,
        35,
        [qualifiers.reallyHot],
        [peuops]
      ),
      marker(
        "goat-1",
        tag("facial", "Facial"),
        40,
        45,
        [qualifiers.goat],
        [peuops]
      ),
    ],
    100,
    suppressNegatives
  );
  const facialLabels = sceneLabels.filter((label) => label.includes("Facials"));

  assert.deepEqual(facialLabels.sort(), [
    "Facials ×2",
    "GOAT Facials ×1",
    "Really Hot Facials ×2",
  ]);
  assert.equal(
    facialLabels.some((label) => label.includes("Peuops")),
    false
  );
});

test("2nd Camera markers never inflate any Facial variant", () => {
  const secondCamera = tag("second-camera", "2nd Camera");
  const reallyHot = tag("really-hot", "Really Hot");
  const goat = tag("goat", "GOAT");
  const sceneLabels = labels(
    [
      marker("standard", tag("facial", "Facial"), 0, 5),
      marker("standard-camera", tag("facial", "Facial"), 0, 5, [secondCamera]),
      marker("hot", tag("facial", "Facial"), 10, 15, [reallyHot]),
      marker("hot-camera", tag("facial", "Facial"), 10, 15, [
        reallyHot,
        secondCamera,
      ]),
      marker("goat", tag("facial", "Facial"), 20, 25, [goat]),
      marker("goat-camera", tag("facial", "Facial"), 20, 25, [
        goat,
        secondCamera,
      ]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Facials ×1"));
  assert.ok(sceneLabels.includes("Really Hot Facials ×1"));
  assert.ok(sceneLabels.includes("GOAT Facials ×1"));
  assert.equal(
    sceneLabels.some((label) => label.includes("Facials ×2")),
    false
  );
});

test("generic marker names preserve the exact tag name", () => {
  assert.ok(
    labels([marker("pito", tag("pito", "pito"), 0, 61)], 100).includes(
      "pito as far as the eye can see"
    )
  );
  assert.ok(
    labels([marker("pito", tag("pito", "Dick"), 0, 61)], 100).includes(
      "Dick as far as the eye can see"
    )
  );
});

test("tag amount levels use configurable scene-coverage percentages", () => {
  const pito = tag("pito", "pito");
  const markers = [
    marker("pito-1", pito, 0, 50),
    marker("pito-2", pito, 60, 105),
    marker("pito-3", pito, 120, 160),
    marker("pito-4", pito, 180, 220),
  ];
  const defaultInsight = getSceneCardInsights(
    makeScene(markers, 600),
    roleTagIds,
    suppressNegatives
  ).find((insight) => insight.label === "Lots of pito");

  assert.equal(
    defaultInsight?.detail,
    "29% of scene · 2:55 (across 4 markers)"
  );
  assert.ok(
    labels(markers, 600, {
      ...suppressNegatives,
      tagGoodAmountMinPercent: 5,
      tagLotsMinPercent: 20,
      tagEyeCanSeeMinPercent: 25,
    }).includes("pito as far as the eye can see")
  );
  assert.ok(
    labels(markers, 600, {
      ...suppressNegatives,
      tagGoodAmountMinPercent: 5,
      tagLotsMinPercent: 40,
      tagEyeCanSeeMinPercent: 80,
    }).includes("Good amount of pito")
  );

  const configuredInsights = getSceneCardInsights(
    makeScene(markers, 600),
    roleTagIds,
    {
      ...suppressNegatives,
      tagGoodAmountMinPercent: 5,
      tagLotsMinPercent: 40,
      tagEyeCanSeeMinPercent: 80,
    }
  );
  assert.equal(
    configuredInsights.find((insight) =>
      insight.label.startsWith("Good amount of")
    )?.detail,
    "29% of scene · 2:55 (across 4 markers)"
  );
  const eyeCanSeeInsight = getSceneCardInsights(
    makeScene(markers, 600),
    roleTagIds,
    {
      ...suppressNegatives,
      tagGoodAmountMinPercent: 5,
      tagLotsMinPercent: 20,
      tagEyeCanSeeMinPercent: 25,
    }
  ).find((insight) => insight.label.endsWith("as far as the eye can see"));
  assert.equal(
    eyeCanSeeInsight?.detail,
    "29% of scene · 2:55 (across 4 markers)"
  );
});

test("amount levels apply generically to primary and secondary highlight tags", () => {
  const sceneLabels = labels(
    [marker("highlight", tag("feet", "Feet"), 0, 61, [tag("body", "Body")])],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Feet as far as the eye can see"));
  assert.ok(sceneLabels.includes("Body as far as the eye can see"));
});

test("GOAT emits every direct named tag and treats GOAT as a qualifier", () => {
  const sceneLabels = labels(
    [
      marker("goat-1", tag("sex", "Sex"), 0, 20, [
        tag("goat", "GOAT"),
        tag("feet", "Feet"),
        tag("pito", "Dick"),
      ]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("GOAT Feet"));
  assert.ok(sceneLabels.includes("GOAT Dick"));
  assert.ok(sceneLabels.includes("GOAT Sex"));
  assert.equal(
    sceneLabels.some((label) => label === "GOAT GOAT"),
    false
  );
});

test("a GOAT activity marker preserves its exact tag name", () => {
  assert.ok(
    labels(
      [marker("goat-1", tag("oral", "BJ"), 0, 20, [tag("goat", "GOAT")])],
      100,
      suppressNegatives
    ).includes("GOAT BJ")
  );
});

test("a GOAT marker with no non-qualifier tag reports a GOAT moment", () => {
  assert.ok(
    labels(
      [marker("goat-1", tag("goat", "GOAT"), 0, 20)],
      100,
      suppressNegatives
    ).includes("GOAT moment")
  );
});

test("GOAT outstanding insights include a consistently associated performer", () => {
  const tyga = performer("tyga", "Tyga Martinez");
  assert.ok(
    labels(
      [
        marker(
          "goat-1",
          tag("pito", "Pito"),
          0,
          20,
          [tag("goat", "GOAT")],
          [tyga]
        ),
      ],
      100,
      suppressNegatives
    ).includes("GOAT Pito from Tyga Martinez")
  );
});

test("GOAT tag suppression applies only to the matching performer scope", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const goat = tag("goat", "GOAT");
  const pito = tag("pito", "Pito");
  const sceneLabels = labels(
    [
      marker("goat-first", pito, 0, 5, [goat], [first]),
      marker("ordinary-first", pito, 10, 45, [], [first]),
      marker("ordinary-second", pito, 50, 80, [], [second]),
    ],
    100,
    { ...suppressNegatives, tagEyeCanSeeMinPercent: 80 }
  );

  assert.ok(sceneLabels.includes("GOAT Pito from First Vato"));
  assert.ok(sceneLabels.includes("Lots of Pito from Second Vato"));
  assert.equal(sceneLabels.includes("Lots of Pito from First Vato"), false);
});

test("GOAT tag suppression distinguishes grouped and unassigned scopes", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const third = performer("third", "Third Vato");
  const goat = tag("goat", "GOAT");
  const pito = tag("pito", "Pito");
  const groupedLabels = labels(
    [
      marker("goat-group", pito, 0, 5, [goat], [first, second]),
      marker("ordinary-group", pito, 10, 45, [], [first, second]),
      marker("ordinary-third", pito, 50, 80, [], [third]),
    ],
    100,
    { ...suppressNegatives, tagEyeCanSeeMinPercent: 80 }
  );
  const unassignedLabels = labels(
    [
      marker("goat-unassigned", pito, 0, 5, [goat]),
      marker("ordinary-unassigned", pito, 10, 45),
      marker("ordinary-first", pito, 50, 80, [], [first]),
    ],
    100,
    { ...suppressNegatives, tagEyeCanSeeMinPercent: 80 }
  );

  assert.ok(groupedLabels.includes("GOAT Pito from First Vato & Second Vato"));
  assert.ok(groupedLabels.includes("Lots of Pito from Third Vato"));
  assert.ok(unassignedLabels.includes("GOAT Pito"));
  assert.ok(unassignedLabels.includes("Lots of Pito from First Vato"));
});

test("GOAT Facial preserves separate GOAT Orgasm markers", () => {
  const tyga = performer("tyga", "Tyga Martinez");
  const goat = tag("goat", "GOAT");
  const sceneLabels = labels(
    [
      marker("goat-orgasm", tag("orgasm", "Orgasm"), 0, 20, [goat], [tyga]),
      marker("goat-facial", tag("facial", "Facial"), 30, 50, [goat], [tyga]),
      marker("goat-pito", tag("pito", "Pito"), 60, 80, [goat], [tyga]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("GOAT Facials ×1"));
  assert.ok(sceneLabels.includes("GOAT Orgasm ×1 and Pito from Tyga Martinez"));
});

test("GOAT Facial takes precedence when Facial descends from Orgasm", () => {
  const peuops = performer("peuops", "Peuops Ramos");
  const goat = tag("goat", "GOAT");
  const orgasm = tag("orgasm", "Orgasm");
  const facial = tag("facial", "Facial", [orgasm]);
  const sceneLabels = labels(
    [
      marker("goat-pito", tag("pito", "pito"), 0, 20, [goat], [peuops]),
      marker(
        "goat-facial",
        orgasm,
        30,
        50,
        [facial, goat, tag("really-hot", "Really Hot", [orgasm])],
        [peuops]
      ),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("GOAT Facials ×1"));
  assert.equal(
    sceneLabels.some(
      (label) => label.startsWith("GOAT Facials") && label.includes("from")
    ),
    false
  );
  assert.ok(sceneLabels.includes("GOAT pito from Peuops Ramos"));
  assert.equal(
    sceneLabels.some((label) => label.startsWith("GOAT Orgasm")),
    false
  );
});

test("GOAT Facial-family subtags aggregate scene-wide without performers", () => {
  const peuops = performer("peuops", "Peuops Ramos");
  const goat = tag("goat", "GOAT");
  const facial = tag("facial", "Facial", [tag("orgasm", "Orgasm")]);
  const selfFacial = tag("self-facial", "Self Facial", [facial]);
  const sceneLabels = labels(
    [
      marker("facial", facial, 0, 5, [goat], [peuops]),
      marker("self-facial", selfFacial, 10, 15, [goat], [peuops]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("GOAT Facials ×2"));
  assert.equal(
    sceneLabels.some(
      (label) => label.startsWith("GOAT Facials") && label.includes("Peuops")
    ),
    false
  );
  assert.equal(
    sceneLabels.some((label) => label.includes("Facial ×1 and Facial ×1")),
    false
  );
});

test("GOAT activity tags stay separated across performer scopes", () => {
  const peuops = performer("peuops", "Peuops Ramos");
  const erivaldo = performer("erivaldo", "Erivaldo Ribeiro");
  const goat = tag("goat", "GOAT");
  const sceneLabels = labels(
    [
      marker("goat-peuops", tag("sex", "Sex"), 0, 5, [goat], [peuops]),
      marker("goat-erivaldo", tag("sex", "Sex"), 10, 15, [goat], [erivaldo]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("GOAT Sex from Peuops Ramos"));
  assert.ok(sceneLabels.includes("GOAT Sex from Erivaldo Ribeiro"));
  assert.equal(sceneLabels.includes("GOAT moments ×2"), false);
});

test("GOAT tags with the same descriptor stay separated across performer scopes", () => {
  const peuops = performer("peuops", "Peuops Ramos");
  const erivaldo = performer("erivaldo", "Erivaldo Ribeiro");
  const goat = tag("goat", "GOAT");
  const pito = tag("pito", "Pito");
  const sceneLabels = labels(
    [
      marker("goat-peuops", pito, 0, 5, [goat], [peuops]),
      marker("goat-erivaldo", pito, 10, 15, [goat], [erivaldo]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("GOAT Pito from Peuops Ramos"));
  assert.ok(sceneLabels.includes("GOAT Pito from Erivaldo Ribeiro"));
  assert.equal(sceneLabels.includes("GOAT Pito"), false);
});

test("all GOAT highlights remain visible beyond the normal chip ceiling", () => {
  const goat = tag("goat", "GOAT");
  const goatMarkers = Array.from({ length: 8 }, (_, index) =>
    marker(
      `goat-${index}`,
      tag(`goat-tag-${index}`, `GOAT Tag ${index}`),
      index * 70,
      index * 70 + 61,
      [goat],
      [performer(`performer-${index}`, `Vato ${index}`)]
    )
  );
  const sceneLabels = labels(goatMarkers, 600, suppressNegatives);

  assert.equal(
    sceneLabels.filter((label) => label.startsWith("GOAT ")).length,
    goatMarkers.length
  );
});

test("Really Hot facial preserves separate Really Hot orgasm markers", () => {
  const reallyHot = tag("really-hot", "Really Hot");
  const tyga = performer("tyga", "Tyga Martinez");
  const sceneLabels = labels(
    [
      marker("orgasm-1", tag("orgasm", "Orgasm"), 10, 20, [reallyHot], [tyga]),
      marker("orgasm-2", tag("orgasm", "Orgasm"), 30, 40, [reallyHot], [tyga]),
      marker("facial-1", tag("facial", "Facial"), 50, 60, [reallyHot], [tyga]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Really Hot Facials ×1"));
  assert.ok(sceneLabels.includes("Really Hot orgasm ×2"));
  assert.ok(sceneLabels.includes("Tyga Martinez nuts twice"));
});

test("Really Hot Facial suppresses only its own redundant Orgasm representation", () => {
  const orgasm = tag("orgasm", "Orgasm");
  const facial = tag("facial", "Facial", [orgasm]);
  const sceneLabels = labels(
    [marker("hot-facial", facial, 10, 20, [tag("really-hot", "Really Hot")])],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Really Hot Facials ×1"));
  assert.equal(
    sceneLabels.some((label) => label.startsWith("Really Hot orgasm")),
    false
  );
});

test("GOAT event markers suppress their matching Really Hot chips", () => {
  const goat = tag("goat", "GOAT");
  const reallyHot = tag("really-hot", "Really Hot");
  const sceneLabels = labels(
    [
      marker("goat-hot-facial", tag("facial", "Facial"), 10, 20, [
        goat,
        reallyHot,
      ]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.some((label) => label.startsWith("GOAT Facials")));
  assert.equal(
    sceneLabels.some((label) => label.startsWith("Really Hot Facials")),
    false
  );
});

test("Really Hot orgasm remains automatic when no Really Hot facial exists", () => {
  const reallyHot = tag("really-hot", "Really Hot");
  const sceneLabels = labels(
    [
      marker("orgasm-1", tag("orgasm", "Orgasm"), 10, 20, [reallyHot]),
      marker("orgasm-2", tag("orgasm", "Orgasm"), 30, 40, [reallyHot]),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Really Hot orgasm ×2"));
});

test("ordinary orgasm and facial insights include marker counts", () => {
  const tyga = performer("tyga", "Tyga Martinez");
  const sceneLabels = labels(
    [
      marker("orgasm-1", tag("orgasm", "Orgasm"), 0, 10, [], [tyga]),
      marker("orgasm-2", tag("orgasm", "Orgasm"), 20, 30, [], [tyga]),
      marker("orgasm-3", tag("orgasm", "Orgasm"), 40, 50, [], [tyga]),
      marker("facial-1", tag("facial", "Facial"), 60, 70, [], [tyga]),
      marker("facial-2", tag("facial", "Facial"), 80, 90, [], [tyga]),
      marker("facial-3", tag("facial", "Facial"), 100, 110, [], [tyga]),
    ],
    200,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Tyga Martinez nuts 3 times"));
  assert.ok(sceneLabels.includes("Orgasm ×3"));
  assert.ok(sceneLabels.includes("Facials ×3"));
});

test("Everybody Nuts accepts Orgasm or Facial finishes and ignores 2nd Camera", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const sceneLabels = labels(
    [
      marker("first-orgasm", tag("orgasm", "Orgasm"), 10, 15, [], [first]),
      marker("second-facial", tag("facial", "Facial"), 20, 25, [], [second]),
      marker(
        "camera-only-third",
        tag("orgasm", "Orgasm"),
        30,
        35,
        [tag("second-camera", "2nd Camera")],
        [performer("third", "Third Vato")]
      ),
    ],
    100,
    suppressNegatives,
    [first, second, performer("third", "Third Vato")]
  );

  assert.equal(sceneLabels.includes("Everybody Nuts"), false);
  assert.ok(
    labels(
      [
        marker("first-orgasm", tag("orgasm", "Orgasm"), 10, 15, [], [first]),
        marker("second-facial", tag("facial", "Facial"), 20, 25, [], [second]),
      ],
      100,
      suppressNegatives,
      [first, second]
    ).includes("Everybody Nuts")
  );
});

test("outstanding amount chips display before Everybody Nuts", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const sceneLabels = labels(
    [
      marker("first-orgasm", tag("orgasm", "Orgasm"), 0, 5, [], [first]),
      marker("second-orgasm", tag("orgasm", "Orgasm"), 10, 15, [], [second]),
      marker("body", tag("body", "Body"), 20, 80, [], [first]),
    ],
    100,
    suppressNegatives,
    [first, second]
  );
  const amountIndex = sceneLabels.indexOf(
    "Body as far as the eye can see from First Vato"
  );
  const everybodyNutsIndex = sceneLabels.indexOf("Everybody Nuts");

  assert.notEqual(amountIndex, -1);
  assert.notEqual(everybodyNutsIndex, -1);
  assert.ok(amountIndex < everybodyNutsIndex);
});

test("orgasm chips detect simultaneous top vatos and repeated top orgasms", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const orgasmSubtag = tag("orgasm-subtag", "Big Orgasm", [
    tag("orgasm", "Orgasm"),
  ]);
  const sceneLabels = labels(
    [
      marker("simultaneous", orgasmSubtag, 0, 10, [], [first, second]),
      marker("first-repeat", tag("orgasm", "Orgasm"), 20, 30, [], [first]),
      marker("first-repeat-2", tag("orgasm", "Orgasm"), 40, 50, [], [first]),
      marker(
        "first-camera",
        tag("orgasm", "Orgasm"),
        60,
        70,
        [tag("second-camera", "2nd Camera")],
        [first]
      ),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("2 vatos nut at the same time"));
  assert.ok(sceneLabels.includes("First Vato nuts 3 times"));
  assert.equal(sceneLabels.includes("Orgasm ×4"), false);
});

test("flattened ancestor IDs classify deep event descendants", () => {
  const first = performer("first", "First Vato");
  const markers = [
    marker(
      "deep-orgasm-1",
      tag("deep-orgasm", "Deep Orgasm"),
      0,
      5,
      [],
      [first]
    ),
    marker(
      "deep-orgasm-2",
      tag("deep-orgasm", "Deep Orgasm"),
      10,
      15,
      [],
      [first]
    ),
  ];
  const scene = {
    ...makeScene(markers, 100),
    scene_marker_tag_ancestors: [
      { tag_id: "deep-orgasm", ancestor_ids: ["orgasm"] },
    ],
  };
  const sceneLabels = getSceneCardInsights(
    scene,
    roleTagIds,
    suppressNegatives
  ).map((insight) => insight.label);

  assert.ok(sceneLabels.includes("First Vato nuts twice"));
  assert.equal(sceneLabels.includes("Lots of Deep Orgasm"), false);
});

test("highlight performer attribution uses top performers only", () => {
  const top = performer("top", "Top Vato");
  const bottom = performer("bottom", "Bottom Vato");
  const sceneLabels = labels(
    [marker("top-feet", tag("feet", "Feet"), 0, 61, [], [top], [bottom])],
    100,
    { ...suppressNegatives, tagEyeCanSeeMinPercent: 80 }
  );

  assert.ok(sceneLabels.includes("Lots of Feet from Top Vato"));
  assert.equal(sceneLabels.includes("Lots of Feet from Bottom Vato"), false);
});

test("activity quality uses outstanding density and outstanding lean to assign levels", () => {
  const sceneLabels = labels(
    [
      marker("oral", tag("oral", "Oral"), 0, 120),
      marker("sex", tag("sex", "Sex"), 200, 320),
      marker("oral-highlight", tag("feet", "Feet"), 0, 72),
      marker("sex-highlight", tag("pito", "Pito"), 200, 248),
    ],
    400,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Amazing oral"));
  assert.ok(sceneLabels.includes("Great sex"));
});

test("single-activity scenes ignore the meaningless 100% highlight lean", () => {
  const markers = [
    marker("oral", tag("oral", "Oral"), 0, 120),
    marker("oral-highlight", tag("feet", "Feet"), 0, 72),
  ];
  const sceneInsights = getSceneCardInsights(
    makeScene(markers, 120),
    roleTagIds,
    suppressNegatives
  );
  const oralInsight = sceneInsights.find((insight) =>
    insight.label.endsWith(" oral")
  );

  assert.equal(oralInsight?.label, "Amazing oral");
  assert.doesNotMatch(oralInsight?.detail ?? "", /activity-linked highlights/);
});

test("single-activity scenes can still be near-perfect from outstanding coverage", () => {
  const sceneLabels = labels(
    [
      marker("oral", tag("oral", "Oral"), 0, 120),
      marker("oral-highlight", tag("feet", "Feet"), 0, 96),
    ],
    120,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Near-perfect oral"));
});

test("activity quality uses only the percentage of the activity that is outstanding", () => {
  const markers = [
    marker("oral", tag("oral", "Oral"), 0, 100),
    marker("highlight", tag("feet", "Feet"), 51, 151),
  ];
  assert.ok(labels(markers, 200, suppressNegatives).includes("Great oral"));

  const oralInsight = getSceneCardInsights(
    makeScene(markers, 200),
    roleTagIds,
    suppressNegatives
  ).find((insight) => insight.label.endsWith(" oral"));
  assert.equal(oralInsight?.detail, "49% of oral is Outstanding (0:49)");
});

test("tiny activity evidence cannot create a whole-scene quality claim", () => {
  const sceneLabels = labels(
    [marker("tiny-sex", tag("sex", "Sex"), 0, 1, [tag("pito", "pito")])],
    100,
    suppressNegatives
  );

  assert.equal(
    sceneLabels.some((label) => label.endsWith(" sex")),
    false
  );
});

test("only the two strongest ordinary activity-quality insights are shown", () => {
  const sceneLabels = labels(
    [
      marker("oral", tag("oral", "Oral"), 0, 100),
      marker("sex", tag("sex", "Sex"), 120, 220),
      marker("solo", tag("solo", "Solo"), 240, 340),
      marker("oral-highlight", tag("oral-hot", "Oral Hot"), 0, 80),
      marker("sex-highlight", tag("sex-hot", "Sex Hot"), 120, 200),
      marker("solo-highlight", tag("solo-hot", "Solo Hot"), 240, 320),
    ],
    400,
    suppressNegatives
  );

  assert.equal(
    sceneLabels.filter((label) =>
      ["Near-perfect oral", "Near-perfect sex", "Near-perfect solo"].includes(
        label
      )
    ).length,
    2
  );
});

test("sex scenes are classified as sex leaning, oral leaning, or balanced", () => {
  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 150),
        marker("oral", tag("oral", "Oral"), 150, 200),
      ],
      200,
      suppressNegatives
    ).includes("Sex Leaning Scene with a good amount of oral")
  );
  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 50),
        marker("oral", tag("oral", "Oral"), 50, 200),
      ],
      200,
      suppressNegatives
    ).includes("Oral Leaning Scene with a good amount of sex")
  );
  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 100),
        marker("oral", tag("oral", "Oral"), 100, 200),
      ],
      200,
      suppressNegatives
    ).includes("Balanced Scene")
  );
});

test("leaning tooltips show each activity percentage and duration", () => {
  const insight = getSceneCardInsights(
    makeScene(
      [
        marker("sex", tag("sex", "Sex"), 0, 630),
        marker("oral", tag("oral", "Oral"), 630, 1260),
      ],
      1260
    ),
    roleTagIds,
    suppressNegatives
  ).find((candidate) => candidate.label === "Balanced Scene");

  assert.equal(insight?.detail, "50% sex (10:30) - 50% oral (10:30)");
});

test("single-activity scenes do not get a leaning chip", () => {
  const oralOnly = labels(
    [marker("oral", tag("oral", "Oral"), 0, 100)],
    100,
    suppressNegatives
  );
  const soloOnly = labels(
    [marker("solo", tag("solo", "Solo"), 0, 100)],
    100,
    suppressNegatives
  );
  const sexOnly = labels(
    [marker("sex", tag("sex", "Sex"), 0, 100)],
    100,
    suppressNegatives
  );

  assert.equal(
    oralOnly.some((label) => label.endsWith("Scene")),
    false
  );
  assert.equal(
    soloOnly.some((label) => label.endsWith("Scene")),
    false
  );
  assert.equal(
    sexOnly.some((label) => label.endsWith("Scene")),
    false
  );

  assert.equal(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 100),
        marker("solo", tag("solo", "Solo"), 100, 200),
      ],
      200,
      suppressNegatives
    ).some((label) => label.includes("Leaning Scene")),
    false
  );
});

test("balanced-scene tolerance is configurable", () => {
  const markers = [
    marker("sex", tag("sex", "Sex"), 0, 54),
    marker("oral", tag("oral", "Oral"), 54, 100),
  ];

  assert.ok(labels(markers, 100, suppressNegatives).includes("Balanced Scene"));
  assert.ok(
    labels(markers, 100, {
      ...suppressNegatives,
      leaningBalanceTolerancePercent: 5,
    }).includes("Sex Leaning Scene with a lot of oral")
  );
});

test("leaning scenes describe the losing activity by configurable levels", () => {
  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 95),
        marker("oral", tag("oral", "Oral"), 95, 100),
      ],
      100,
      suppressNegatives
    ).includes("Sex Leaning Scene with minimal oral")
  );
  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 80),
        marker("oral", tag("oral", "Oral"), 80, 100),
      ],
      100,
      suppressNegatives
    ).includes("Sex Leaning Scene with some oral")
  );
  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 60),
        marker("oral", tag("oral", "Oral"), 60, 100),
      ],
      100,
      suppressNegatives
    ).includes("Sex Leaning Scene with a lot of oral")
  );
  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 80),
        marker("oral", tag("oral", "Oral"), 80, 100),
      ],
      100,
      {
        ...suppressNegatives,
        leaningMinoritySomePercent: 25,
        leaningMinorityGoodAmountPercent: 40,
        leaningMinorityALotPercent: 60,
      }
    ).includes("Sex Leaning Scene with minimal oral")
  );
});

test("filler treats all positive markers as coverage and negative markers as filler", () => {
  const fullyMarked = getSceneCardInsights(
    {
      ...makeScene([marker("other", tag("other", "Other"), 0, 600)], 600),
      negative_markers: [],
    },
    roleTagIds,
    { ...suppressNegatives, fillerTotalPercent: 20 }
  );
  assert.equal(
    fullyMarked.some((insight) => insight.label === "Lots of filler"),
    false
  );

  const negativeOverlap = getSceneCardInsights(
    {
      ...makeScene([marker("sex", tag("sex", "Sex"), 0, 600)], 600),
      negative_markers: [
        { id: "negative", start_seconds: 0, end_seconds: 240 },
      ],
    },
    roleTagIds,
    { ...suppressNegatives, fillerTotalPercent: 20 }
  );
  const filler = negativeOverlap.find(
    (insight) => insight.label === "Lots of filler"
  );
  assert.ok(filler);
  assert.equal(filler?.detail, "40% filler (4:00)");
});

test("two-vato versatility requires reciprocal activity directions", () => {
  const top = performer("top", "Top Vato");
  const bottom = performer("bottom", "Bottom Vato");
  assert.ok(
    labels(
      [interactionMarker("sex", "sex", top, bottom)],
      100,
      suppressNegatives
    ).includes("Traditional Scene")
  );

  const reversedLabels = labels(
    [
      interactionMarker("sex", "sex", top, bottom),
      interactionMarker("oral-reversal", "oral", bottom, top),
    ],
    100,
    suppressNegatives
  );
  assert.equal(reversedLabels.includes("Orally Versatile"), false);
  assert.equal(reversedLabels.includes("Sexually Versatile"), false);
  assert.equal(reversedLabels.includes("Traditional Scene"), false);
});

test("traditional two-vato scenes preserve consistent top and bottom roles across activities", () => {
  const top = performer("top", "Top Vato");
  const bottom = performer("bottom", "Bottom Vato");
  const sceneLabels = labels(
    [
      interactionMarker("sex", "sex", top, bottom),
      interactionMarker("oral", "oral", top, bottom),
    ],
    100,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Traditional Scene"));
  assert.equal(sceneLabels.includes("Sexually Versatile"), false);
  assert.equal(sceneLabels.includes("Orally Versatile"), false);
});

test("two-vato versatility labels use the reciprocal activity", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const sceneLabels = labels(
    [
      interactionMarker("sex-forward", "sex", first, second),
      interactionMarker("sex-reverse", "sex", second, first),
    ],
    100,
    suppressNegatives
  );
  assert.ok(sceneLabels.includes("Sexually Versatile"));
  assert.equal(sceneLabels.includes("Orally Versatile"), false);

  const oralVersatileLabels = labels(
    [
      interactionMarker("oral-forward", "oral", first, second),
      interactionMarker("oral-reverse", "oral", second, first),
    ],
    100,
    suppressNegatives
  );
  assert.ok(oralVersatileLabels.includes("Orally Versatile"));
});

test("versatile chip tooltips omit meaningfully", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const insight = getSceneCardInsights(
    makeScene(
      [
        interactionMarker("sex-forward", "sex", first, second),
        interactionMarker("sex-reverse", "sex", second, first),
        interactionMarker("oral-forward", "oral", first, second, 130),
        interactionMarker("oral-reverse", "oral", second, first, 200),
      ],
      300
    ),
    roleTagIds,
    suppressNegatives
  ).find((candidate) => candidate.label === "Fully Versatile Scene");

  assert.equal(
    insight?.detail,
    "Both vatos top and bottom each other in sex and oral"
  );
  assert.doesNotMatch(insight?.detail ?? "", /meaningfully/i);
});

test("a traditional group may have multiple tops and one consistent bottom", () => {
  const firstTop = performer("top-1", "First Top");
  const secondTop = performer("top-2", "Second Top");
  const bottom = performer("bottom", "Bottom Vato");
  assert.ok(
    labels(
      [
        interactionMarker("sex-1", "sex", firstTop, bottom),
        interactionMarker("sex-2", "sex", secondTop, bottom),
      ],
      100,
      suppressNegatives
    ).includes("Traditional Scene")
  );
});

test("interaction roles require percentage-based evidence for every direction", () => {
  const top = performer("top", "Top Vato");
  const bottom = performer("bottom", "Bottom Vato");
  const markers = [
    interactionMarker("sex", "sex", top, bottom),
    marker(
      "brief-oral-forward",
      tag("oral", "oral"),
      65,
      75,
      [],
      [top],
      [bottom]
    ),
    marker(
      "brief-oral-reverse",
      tag("oral", "oral"),
      80,
      90,
      [],
      [bottom],
      [top]
    ),
  ];
  assert.ok(
    labels(markers, 100, suppressNegatives).includes("Orally Versatile")
  );
});

test("tiny reciprocal markers cannot establish versatility", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const sceneLabels = labels(
    [
      marker("forward", tag("sex", "Sex"), 0, 1, [], [first], [second]),
      marker("reverse", tag("sex", "Sex"), 2, 3, [], [second], [first]),
    ],
    100,
    suppressNegatives
  );

  assert.equal(
    sceneLabels.some((label) => label.includes("Versatile")),
    false
  );
});

test("two-vato role patterns distinguish fully versatile and sexually versatile scenes", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const versatileMarkers = [
    interactionMarker("sex-forward", "sex", first, second),
    interactionMarker("sex-reverse", "sex", second, first),
  ];
  assert.ok(
    labels(versatileMarkers, 100, suppressNegatives).includes(
      "Sexually Versatile"
    )
  );

  const fullyVersatileLabels = labels(
    [
      ...versatileMarkers,
      interactionMarker("oral-forward", "oral", first, second),
      interactionMarker("oral-reverse", "oral", second, first),
    ],
    100,
    suppressNegatives
  );
  assert.ok(fullyVersatileLabels.includes("Fully Versatile Scene"));
  assert.equal(fullyVersatileLabels.includes("Sexually Versatile"), false);
});

test("three-vato graphs distinguish Oral Circle, Versatile Group, and Balanced Threesome", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const third = performer("third", "Third Vato");
  const cycle = (category: "sex" | "oral") => [
    interactionMarker(`${category}-1`, category, first, second),
    interactionMarker(`${category}-2`, category, second, third),
    interactionMarker(`${category}-3`, category, third, first),
  ];

  assert.ok(
    labels(cycle("oral"), 100, suppressNegatives).includes("Oral Circle")
  );
  assert.ok(
    labels(cycle("sex"), 100, suppressNegatives).includes("Versatile Group")
  );
  assert.ok(
    labels(
      [
        interactionMarker("pair-1", "sex", first, second),
        interactionMarker("pair-2", "sex", first, third),
        interactionMarker("pair-3", "sex", second, third),
      ],
      100,
      suppressNegatives
    ).includes("Balanced Threesome")
  );
});

test("four-vato graphs distinguish Round-Robin, Balanced Orgy, and Center Stage", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const third = performer("third", "Third Vato");
  const fourth = performer("fourth", "Fourth Vato");
  const allPairs = [
    [first, second],
    [first, third],
    [first, fourth],
    [second, third],
    [second, fourth],
    [third, fourth],
  ] as const;
  assert.ok(
    labels(
      allPairs.map(([top, bottom], index) =>
        interactionMarker(`round-${index}`, "sex", top, bottom)
      ),
      100,
      suppressNegatives
    ).includes("Round-Robin Scene")
  );

  assert.ok(
    labels(
      [
        interactionMarker("balanced-1", "sex", first, second),
        interactionMarker("balanced-2", "sex", first, fourth),
        interactionMarker("balanced-3", "sex", second, third),
        interactionMarker("balanced-4", "sex", third, fourth),
      ],
      100,
      suppressNegatives
    ).includes("Balanced Orgy")
  );

  assert.ok(
    labels(
      [
        interactionMarker("center-1", "sex", first, second),
        interactionMarker("center-2", "sex", first, third),
        interactionMarker("center-3", "sex", first, fourth),
      ],
      100,
      suppressNegatives
    ).includes("One Vato Center Stage")
  );
});

test("interaction patterns require every listed scene performer to participate", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const sidelined = performer("sidelined", "Sidelined Vato");
  const sceneInsights = getSceneCardInsights(
    makeScene([interactionMarker("sex", "sex", first, second)], 100, [
      first,
      second,
      sidelined,
    ]),
    roleTagIds,
    suppressNegatives
  );

  assert.equal(
    sceneInsights.some((insight) => insight.tone === "interaction"),
    false
  );
});

test("two- and three-vato scenes report ugly top and bottom scene criteria", () => {
  [2, 3].forEach((performerCount) => {
    const uglyLabels = ratingCriterionLabels(performerCount, [
      ratingScore("topAttractiveness", 0),
      ratingScore("bottomAttractiveness", 0),
    ]);
    assert.ok(uglyLabels.includes("Ugly Top"));
    assert.ok(uglyLabels.includes("Ugly Bottom"));

    const nonUglyLabels = ratingCriterionLabels(performerCount, [
      ratingScore("topAttractiveness", 1),
      ratingScore("bottomAttractiveness", 1),
    ]);
    assert.equal(nonUglyLabels.includes("Ugly Top"), false);
    assert.equal(nonUglyLabels.includes("Ugly Bottom"), false);
  });
});

test("group scenes report an ugly top lineup only at zero or one", () => {
  [0, 1].forEach((rawValue) => {
    assert.ok(
      ratingCriterionLabels(4, [
        ratingScore("groupTopAttractiveness", rawValue),
      ]).includes("Ugly Tops")
    );
  });

  assert.equal(
    ratingCriterionLabels(4, [
      ratingScore("groupTopAttractiveness", 2),
      ratingScore("topAttractiveness", 0),
      ratingScore("bottomAttractiveness", 0),
    ]).some((label) => label.startsWith("Ugly")),
    false
  );
});

test("ugly-role insights ignore performer ratings and non-criterion rows", () => {
  const scenePerformers = [
    { ...performer("top", "Top"), rating100: 0 },
    { ...performer("bottom", "Bottom"), rating100: 0 },
  ];
  const sceneLabels = getSceneCardInsights(
    {
      ...makeScene([], 100, scenePerformers),
      rating_scores: [ratingScore("topAttractiveness", 0, "bonus")],
    },
    roleTagIds,
    suppressNegatives
  ).map((insight) => insight.label);

  assert.equal(
    sceneLabels.some((label) => label.startsWith("Ugly")),
    false
  );
});

test("Mexican lineup chips distinguish one, several, and an all-Mexican cast", () => {
  const mexican = performer("mexican", "Mexican Vato", { country: "MX" });
  const legacyMexican = performer("legacy", "Legacy Vato", {
    country: "Mexico",
  });
  const brazilian = performer("brazilian", "Brazilian Vato", {
    country: "BR",
  });
  const lineupLabels = (scenePerformers: ReturnType<typeof performer>[]) =>
    getSceneCardInsights(
      makeScene([], 100, scenePerformers),
      roleTagIds,
      suppressNegatives
    ).map((insight) => insight.label);

  assert.ok(lineupLabels([mexican, brazilian]).includes("Mexican vato"));
  assert.ok(
    lineupLabels([mexican, legacyMexican, brazilian]).includes(
      "Mexican vatos ×2"
    )
  );
  assert.ok(lineupLabels([mexican, legacyMexican]).includes("All-Mexican"));
});

test("Favorite Vatos uses exact Royal Sapphire metallic rating precedence", () => {
  const thresholdFavorite = performer("threshold", "Threshold Favorite", {
    rating100: 90,
  });
  const overrideFavorite = performer("override", "Override Favorite", {
    rating100: 10,
    rating_tier_tags: [{ id: "royal" }],
  });
  const downgradedByOverride = performer("gold", "Gold Override", {
    rating100: 99,
    rating_tier_tags: [{ id: "gold" }],
  });
  const insights = getSceneCardInsights(
    makeScene([], 100, [
      thresholdFavorite,
      overrideFavorite,
      downgradedByOverride,
    ]),
    roleTagIds,
    suppressNegatives,
    {
      overrideTagIds: {
        goldTagId: "gold",
        royalSapphireTagId: "royal",
      },
      thresholds: { performer: { royalSapphire: 90 } },
    }
  );
  const favorite = insights.find(
    (insight) => insight.label === "Favorite Vatos ×2"
  );

  assert.equal(
    favorite?.detail,
    "Royal Sapphire: Override Favorite, Threshold Favorite"
  );
});

test("No Orgasm appears only when no countable Orgasm or Facial exists", () => {
  assert.ok(labels([], 100, suppressNegatives).includes("No Orgasm"));
  assert.equal(
    labels(
      [marker("facial", tag("facial", "Facial"), 10, 15)],
      100,
      suppressNegatives
    ).includes("No Orgasm"),
    false
  );
  assert.ok(
    labels(
      [
        marker("camera", tag("orgasm", "Orgasm"), 10, 15, [
          tag("second-camera", "2nd Camera"),
        ]),
      ],
      100,
      suppressNegatives
    ).includes("No Orgasm")
  );
});

test("Few highlights and Lots of filler use their configurable cutoffs", () => {
  const markers = [
    marker("sex", tag("sex", "Sex"), 0, 100),
    marker("highlight", tag("feet", "Feet"), 200, 210),
  ];
  const defaultLabels = labels(markers, 600);
  assert.ok(defaultLabels.includes("Few highlights"));
  assert.ok(defaultLabels.includes("Lots of filler"));

  const configuredLabels = labels(markers, 600, {
    fewHighlightsMaxEpisodes: 0,
    fillerTotalPercent: 100,
  });
  assert.equal(configuredLabels.includes("Few highlights"), false);
  assert.equal(configuredLabels.includes("Lots of filler"), false);
});

test("Few highlights requires both the episode and scene-percentage limits", () => {
  const oneShortHighlight = [marker("highlight", tag("feet", "Feet"), 0, 30)];
  const matchingInsight = getSceneCardInsights(
    makeScene(oneShortHighlight, 600),
    roleTagIds,
    {
      ...suppressNegatives,
      fewHighlightsMaxEpisodes: 1,
      fewHighlightsMaxPercent: 5,
    }
  ).find((insight) => insight.label === "Few highlights");
  assert.equal(
    matchingInsight?.detail,
    "5% highlights · 0:30 (across 1 marker)"
  );

  assert.equal(
    labels([marker("long-highlight", tag("feet", "Feet"), 0, 31)], 600, {
      ...suppressNegatives,
      fewHighlightsMaxEpisodes: 1,
      fewHighlightsMaxPercent: 5,
    }).includes("Few highlights"),
    false
  );
  assert.equal(
    labels(
      [
        marker("highlight-1", tag("feet", "Feet"), 0, 10),
        marker("highlight-2", tag("feet", "Feet"), 20, 30),
      ],
      600,
      {
        ...suppressNegatives,
        fewHighlightsMaxEpisodes: 1,
        fewHighlightsMaxPercent: 5,
      }
    ).includes("Few highlights"),
    false
  );
});

test("an unmarked scene reports both missing highlights and filler", () => {
  const sceneLabels = labels([], 600);

  assert.ok(sceneLabels.includes("Few highlights"));
  assert.ok(sceneLabels.includes("Lots of filler"));
});

test("quality level thresholds are configurable", () => {
  const markers = [
    marker("oral", tag("oral", "Oral"), 0, 100),
    marker("highlight", tag("feet", "Feet"), 0, 50),
  ];
  const sceneLabels = labels(markers, 100, {
    ...suppressNegatives,
    goodOutstandingPercent: 70,
    greatOutstandingPercent: 80,
    amazingOutstandingPercent: 90,
    nearPerfectOutstandingPercent: 95,
  });

  assert.equal(
    sceneLabels.some((label) => label.endsWith(" oral")),
    false
  );
});

test("No Orgasm reserves a high-priority slot near the chip ceiling", () => {
  const goat = tag("goat", "GOAT");
  const sceneLabels = labels(
    [
      marker("sex", tag("sex", "Sex"), 0, 40),
      marker("oral", tag("oral", "Oral"), 50, 90),
      marker("goat-1", tag("highlight-1", "Highlight 1"), 0, 10, [goat]),
      marker("goat-2", tag("highlight-2", "Highlight 2"), 12, 22, [goat]),
      marker("goat-3", tag("highlight-3", "Highlight 3"), 24, 34, [goat]),
      marker("goat-4", tag("highlight-4", "Highlight 4"), 50, 60, [goat]),
      marker("goat-5", tag("highlight-5", "Highlight 5"), 62, 72, [goat]),
    ],
    100,
    suppressNegatives
  );

  assert.equal(sceneLabels.length, 7);
  assert.ok(sceneLabels.includes("No Orgasm"));
  assert.ok(
    sceneLabels.indexOf("No Orgasm") < sceneLabels.indexOf("Balanced Scene")
  );
  assert.equal(
    sceneLabels.some(
      (label) => label.endsWith(" sex") || label.endsWith(" oral")
    ),
    false
  );
});

test("all GOAT tags remain visible even beyond the seven-chip ceiling", () => {
  const goat = tag("goat", "GOAT");
  const sceneLabels = labels(
    [
      marker("goat-1", tag("other", "Other"), 0, 20, [
        goat,
        tag("a", "A"),
        tag("b", "B"),
        tag("c", "C"),
        tag("d", "D"),
        tag("e", "E"),
        tag("f", "F"),
        tag("g", "G"),
        tag("h", "H"),
      ]),
    ],
    100,
    suppressNegatives
  );

  assert.equal(sceneLabels.length, 9);
  assert.equal(
    sceneLabels.every((label) => label.startsWith("GOAT ")),
    true
  );
});

test("Facials remain visible beyond the ordinary chip ceiling", () => {
  const goat = tag("goat", "GOAT");
  const goatMarkers = Array.from({ length: 7 }, (_, index) =>
    marker(
      `goat-${index}`,
      tag(`goat-tag-${index}`, `GOAT Tag ${index}`),
      index * 10,
      index * 10 + 5,
      [goat]
    )
  );
  const sceneLabels = labels(
    [
      ...goatMarkers,
      marker("standard-facial", tag("facial", "Facial"), 80, 81),
    ],
    100,
    suppressNegatives
  );

  assert.equal(sceneLabels.length, 8);
  assert.ok(sceneLabels.includes("Facials ×1"));
});

test("Everybody Nuts yields to automatic orgasm chips near the insight ceiling", () => {
  const markers = Array.from({ length: 7 }, (_, index) => {
    const scenePerformer = performer(`vato-${index}`, `Vato ${index}`);
    return [
      marker(
        `orgasm-${index}-1`,
        tag("orgasm", "Orgasm"),
        index * 10,
        index * 10 + 2,
        [],
        [scenePerformer]
      ),
      marker(
        `orgasm-${index}-2`,
        tag("orgasm", "Orgasm"),
        index * 10 + 3,
        index * 10 + 5,
        [],
        [scenePerformer]
      ),
    ];
  }).flat();
  markers.push(
    marker(
      "really-hot-facial",
      tag("facial", "Facial", [tag("orgasm", "Orgasm")]),
      90,
      95,
      [tag("really-hot", "Really Hot")]
    )
  );
  const sceneLabels = labels(markers, 100, suppressNegatives);

  assert.ok(sceneLabels.includes("Really Hot Facials ×1"));
  assert.equal(sceneLabels.includes("Everybody Nuts"), false);
  assert.equal(
    sceneLabels.filter((label) => label.includes("nuts twice")).length,
    6
  );
});
