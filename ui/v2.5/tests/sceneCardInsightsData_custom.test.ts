import assert from "node:assert/strict";
import test from "node:test";

import { getSceneCardInsights } from "../src/components/Scenes/sceneCardInsightsData_custom.ts";

const tag = (
  id: string,
  name: string,
  parents: Array<{ id: string }> = []
) => ({ id, name, parents });

const performer = (id: string, name: string) => ({ id, name });

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

const interactionMarker = (
  id: string,
  category: "sex" | "oral",
  top: ReturnType<typeof performer>,
  bottom: ReturnType<typeof performer>,
  start = 0
) =>
  marker(id, tag(category, category), start, start + 61, [], [top], [bottom]);

test("ordinary tags become relevant by merged duration or distinct episodes without scene coverage", () => {
  const feet = tag("feet", "Feet");
  const closeup = tag("closeup", "Closeup");
  const sceneLabels = labels(
    [
      marker("feet-1", feet, 0, 61),
      marker("closeup-1", closeup, 100, 110),
      marker("closeup-2", closeup, 120, 130),
      marker("closeup-3", closeup, 140, 150),
    ],
    3600,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Lots of Feet"));
  assert.ok(sceneLabels.includes("Lots of Closeup"));
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

test("tag relevance duration and episode thresholds are configurable", () => {
  const feet = tag("feet", "Feet");
  const sceneLabels = labels(
    [marker("feet-1", feet, 0, 20), marker("feet-2", feet, 30, 50)],
    600,
    {
      ...suppressNegatives,
      relevantMinEpisodes: 2,
      relevantMinDurationSeconds: 30,
    }
  );

  assert.ok(sceneLabels.includes("Lots of Feet"));
});

test("relevant outstanding tags for the same performer merge into one chip", () => {
  const tyga = performer("tyga", "Tyga Martinez");
  const sceneLabels = labels(
    [
      marker("pito", tag("pito", "Dick"), 0, 61, [], [tyga]),
      marker("body-1", tag("body", "Body"), 70, 80, [], [tyga]),
      marker("body-2", tag("body", "Body"), 90, 100, [], [tyga]),
      marker("body-3", tag("body", "Body"), 110, 120, [], [tyga]),
    ],
    200,
    suppressNegatives
  );

  assert.ok(sceneLabels.includes("Lots of Dick and Body from Tyga Martinez"));
  assert.equal(
    sceneLabels.filter((label) => label.includes("Tyga Martinez")).length,
    1
  );
});

test("generic marker names preserve the exact tag name", () => {
  assert.ok(
    labels([marker("pito", tag("pito", "pito"), 0, 61)], 100).includes(
      "Lots of pito"
    )
  );
  assert.ok(
    labels([marker("pito", tag("pito", "Dick"), 0, 61)], 100).includes(
      "Lots of Dick"
    )
  );
});

test("GOAT emits every direct non-activity tag and treats GOAT as a qualifier", () => {
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
  assert.equal(
    sceneLabels.some((label) => label === "GOAT GOAT"),
    false
  );
});

test("a GOAT activity marker with no other descriptive tag still reports a GOAT moment", () => {
  assert.ok(
    labels(
      [marker("goat-1", tag("sex", "Sex"), 0, 20, [tag("goat", "GOAT")])],
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

test("GOAT Facial suppresses GOAT Orgasm and stays separate from performer tags", () => {
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

  assert.ok(sceneLabels.some((label) => label.startsWith("GOAT Facial")));
  assert.ok(sceneLabels.includes("GOAT Pito from Tyga Martinez"));
  assert.equal(
    sceneLabels.some((label) => label.includes("and Pito from Tyga Martinez")),
    false
  );
  assert.equal(
    sceneLabels.some((label) => label.startsWith("GOAT Orgasm")),
    false
  );
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

test("Really Hot facial suppresses redundant Really Hot orgasm", () => {
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

  assert.ok(sceneLabels.includes("Really Hot facial ×1"));
  assert.equal(
    sceneLabels.some((label) => label.startsWith("Really Hot orgasm")),
    false
  );
  assert.ok(sceneLabels.includes("Tyga Martinez nuts twice"));
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

  assert.ok(sceneLabels.some((label) => label.startsWith("GOAT Facial")));
  assert.equal(
    sceneLabels.some((label) => label.startsWith("Really Hot facial")),
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
  assert.ok(sceneLabels.includes("Facial ×3"));
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

test("highlight performer attribution uses top performers only", () => {
  const top = performer("top", "Top Vato");
  const bottom = performer("bottom", "Bottom Vato");
  const sceneLabels = labels(
    [marker("top-feet", tag("feet", "Feet"), 0, 61, [], [top], [bottom])],
    100,
    suppressNegatives
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

  assert.ok(
    labels(
      [
        marker("sex", tag("sex", "Sex"), 0, 100),
        marker("solo", tag("solo", "Solo"), 100, 200),
      ],
      200,
      suppressNegatives
    ).includes("Sex Leaning Scene with no oral")
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
  assert.match(
    filler?.detail ?? "",
    /no positive marker; negative markers count/
  );
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

test("interaction roles reuse the configurable relevance evidence threshold", () => {
  const top = performer("top", "Top Vato");
  const bottom = performer("bottom", "Bottom Vato");
  const markers = [
    interactionMarker("sex", "sex", top, bottom),
    marker(
      "brief-oral-forward",
      tag("oral", "oral"),
      70,
      90,
      [],
      [top],
      [bottom]
    ),
    marker(
      "brief-oral-reverse",
      tag("oral", "oral"),
      140,
      160,
      [],
      [bottom],
      [top]
    ),
  ];
  assert.ok(
    labels(markers, 100, suppressNegatives).includes("Traditional Scene")
  );
  assert.ok(
    labels(markers, 100, {
      ...suppressNegatives,
      relevantMinEpisodes: 1,
    }).includes("Orally Versatile")
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
