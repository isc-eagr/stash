import assert from "node:assert/strict";

import { getRatingCardClass } from "../src/utils/ratingCardStyles_custom.ts";
import {
  filterCoveredChronologicalSceneMarkers,
  filterChronologicalSceneMarkers,
  getChronologicalSceneMarkerContextDisplayTags,
  getChronologicalSceneMarkerDisplayTags,
  getChronologicalSceneMarkerDerivedWindows,
  getChronologicalSceneMarkerHighlightPerformers,
  getChronologicalSceneMarkerHighlightPerformerOrgasmRank,
  getChronologicalSceneMarkerPerformers,
  getChronologicalSceneMarkerTags,
  getCompatibleChronologicalSceneMarkerTags,
  getSceneMarkerPerformerTagSummaries,
  groupChronologicalSceneMarkerHighlights,
  timestampBelongsToSceneMarker,
} from "../src/components/Scenes/SceneDetails/sceneMarkerChronologySearch_custom.ts";

type TestTag = {
  id: string;
  name: string;
  parents: TestTag[];
};

const tag = (id: string, name: string, parents: TestTag[] = []): TestTag => ({
  id,
  name,
  parents,
});
const performer = (id: string, name: string, aliases: string[] = []) => ({
  id,
  name,
  alias_list: aliases,
});

const marker = (
  id: string,
  seconds: number,
  endSeconds: number | null,
  primaryTag: ReturnType<typeof tag>,
  secondaryTags: Array<ReturnType<typeof tag>> = [],
  topPerformers: Array<ReturnType<typeof performer>> = [],
  bottomPerformers: Array<ReturnType<typeof performer>> = [],
  sceneId?: string
) => ({
  id,
  seconds,
  end_seconds: endSeconds,
  ...(sceneId ? { scene: { id: sceneId } } : {}),
  primary_tag: primaryTag,
  tags: secondaryTags,
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});

const feet = tag("feet", "Feet");
const verga = tag("verga", "Verga");
const bj = tag("bj", "BJ");
const oral = tag("oral", "Oral");
const orgasm = tag("orgasm", "Orgasm");
const footwear = tag("footwear", "Footwear");
const boots = tag("boots", "Boots", [footwear]);
const juan = performer("juan", "Juan", ["El Guapo"]);
const luis = performer("luis", "Luis");

assert.equal(
  getRatingCardClass({
    tags: [tag("goat", "GOAT")],
    goatTagId: "goat",
    theme: "premium",
  }),
  "rating-card-theme-premium rating-royal-sapphire",
  "GOAT markers use the premium Royal Sapphire rating class"
);

assert.equal(
  getRatingCardClass({
    tags: [tag("goat", "GOAT")],
    goatTagId: "goat",
    theme: "classic",
  }),
  "rating-card-theme-classic rating-royal-sapphire",
  "GOAT markers use the classic Royal Sapphire rating class"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 20, 30, oral),
      marker("2", 10, 15, feet, [verga]),
      marker("3", 40, 50, feet),
    ],
    { tags: [verga, feet], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["2"],
  "a direct marker with both requested tags matches"
);

assert.deepEqual(
  filterCoveredChronologicalSceneMarkers([
    marker("wide", 60, 180, oral),
    marker("contained", 90, 100, bj),
    marker("partial", 170, 220, feet),
  ]).map((m) => m.id),
  ["wide", "partial"],
  "playback/viewer selection skips fully contained markers covered by selected wider markers"
);

assert.deepEqual(
  filterCoveredChronologicalSceneMarkers([
    marker("contained", 90, 100, bj),
  ]).map((m) => m.id),
  ["contained"],
  "playback/viewer selection keeps contained markers when the wider marker is not selected"
);

assert.deepEqual(
  filterCoveredChronologicalSceneMarkers([
    marker("a", 60, 120, oral),
    marker("b", 60, 120, bj),
  ]).map((m) => m.id),
  ["a", "b"],
  "playback/viewer selection keeps same-range markers because neither marker is wider"
);

assert.deepEqual(
  filterCoveredChronologicalSceneMarkers([
    marker("recipient", 15, 60, feet),
    marker("source", 30, 150, oral),
  ]).map((m) => m.id),
  ["recipient", "source"],
  "playback/viewer selection preserves partial-overlap markers even when tag inheritance applies"
);

assert.deepEqual(
  getChronologicalSceneMarkerDerivedWindows(
    [marker("feet-wide", 60, 180, feet), marker("bj-wide", 120, 240, bj)],
    { tags: [feet, bj], topPerformers: [], bottomPerformers: [] },
    []
  ).map((window) => [window.seconds, window.end_seconds]),
  [[120, 180]],
  "derived windows expose partial overlaps that satisfy the active filters"
);

assert.deepEqual(
  getChronologicalSceneMarkerDerivedWindows(
    [marker("feet-wide", 60, 180, feet), marker("bj-wide", 120, 240, bj)],
    { tags: [feet, bj], topPerformers: [], bottomPerformers: [] },
    [marker("covered", 120, 180, feet, [bj])]
  ).map((window) => [window.seconds, window.end_seconds]),
  [],
  "derived windows are hidden when an exact filtered marker already covers the overlap"
);

assert.deepEqual(
  getChronologicalSceneMarkerDerivedWindows(
    [marker("oral-only", 60, 180, oral)],
    { tags: [oral], topPerformers: [], bottomPerformers: [] },
    [marker("oral-only", 60, 180, oral)]
  ).map((window) => [window.seconds, window.end_seconds]),
  [],
  "single-filter exact marker coverage does not create derived windows"
);

assert.deepEqual(
  getChronologicalSceneMarkerDerivedWindows(
    [
      marker("kaue-orgasm", 1249.215, 1259.401, orgasm, [], [luis]),
      marker(
        "chris-facial-orgasm",
        1259.402,
        1273.926,
        orgasm,
        [tag("facial", "Facial")],
        [juan],
        [luis]
      ),
    ],
    { tags: [orgasm], topPerformers: [juan], bottomPerformers: [] },
    [
      marker(
        "chris-facial-orgasm",
        1259.402,
        1273.926,
        orgasm,
        [tag("facial", "Facial")],
        [juan],
        [luis]
      ),
    ]
  ).map((window) => [window.seconds, window.end_seconds]),
  [],
  "single-tag performer filters do not create derived windows from nearby tag-only markers"
);

assert.deepEqual(
  getChronologicalSceneMarkerDerivedWindows(
    [marker("feet-tiny", 60, 120, feet), marker("bj-tiny", 118, 180, bj)],
    { tags: [feet, bj], topPerformers: [], bottomPerformers: [] },
    []
  ).map((window) => [window.seconds, window.end_seconds]),
  [],
  "derived windows shorter than the minimum display duration are discarded"
);

assert.equal(
  timestampBelongsToSceneMarker(marker("1", 10, 20, feet), 10),
  true,
  "marker current timestamp includes the marker start"
);

assert.equal(
  timestampBelongsToSceneMarker(marker("1", 10, 20, feet), 20),
  false,
  "marker current timestamp excludes the marker end"
);

assert.equal(
  timestampBelongsToSceneMarker(marker("1", 10, null, feet), 29),
  true,
  "marker current timestamp uses default duration when no end time exists"
);

assert.equal(
  timestampBelongsToSceneMarker(marker("1", 10, 20, feet), 0),
  false,
  "marker current timestamp ignores the beginning of playback"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 100, feet),
      marker("2", 10, 20, verga),
      marker("3", 120, 130, oral),
    ],
    { tags: [feet, verga], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["2"],
  "contained single-tag markers inherit containing marker tags for multi-tag searches"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 20, feet),
      marker("2", 5, 15, oral),
      marker("3", 40, 50, bj),
    ],
    { tags: [oral], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["2"],
  "a wider marker does not inherit from a narrower marker covering exactly half of it"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [marker("1", 0, 10, feet), marker("2", 11, 20, verga)],
    { tags: [feet, verga], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  [],
  "single-tag markers must overlap by at least half to satisfy a multi-tag context search"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 15, feet),
      marker("2", 10, 20, bj),
      marker("3", 18, 25, orgasm),
    ],
    { tags: [feet, bj, orgasm], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  [],
  "multi-tag searches reject chain overlaps without one qualifying inheritance context"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 30, feet),
      marker("2", 10, 20, bj),
      marker("3", 12, 18, orgasm),
    ],
    { tags: [feet, bj, orgasm], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["3"],
  "multi-tag searches only match recipients that can inherit every selected tag from equal-or-longer sources"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("1", 0, 10, oral, [], [juan], [luis]),
      marker("2", 20, 30, oral, [], [luis], [juan]),
    ],
    { tags: [], topPerformers: [juan], bottomPerformers: [luis] }
  ).map((m) => m.id),
  ["1"],
  "top and bottom performer searches match direct marker roles"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [marker("1", 0, 10, tag("child", "Feet closeup", [feet]))],
    { tags: [feet], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["1"],
  "selected parent tags match child marker tags when parent data is loaded"
);

assert.deepEqual(
  getChronologicalSceneMarkerTags([
    marker("1", 0, 10, feet, [verga]),
    marker("2", 20, 30, boots),
  ]).map((t) => t.id),
  ["boots", "feet", "footwear", "verga"],
  "scene tag options include marker tags and their parent tags"
);

assert.deepEqual(
  getChronologicalSceneMarkerDisplayTags(marker("1", 0, 20, feet, [verga]), [
    marker("1", 0, 20, feet, [verga]),
    marker("2", 10, 30, bj, [oral]),
    marker("3", 30, 40, orgasm),
  ]).map((displayTag) => `${displayTag.kind}:${displayTag.tag.id}`),
  ["primary:feet", "secondary:verga", "overlap:bj", "overlap:oral"],
  "display tags distinguish direct primary, direct secondary, and overlapping marker tags"
);

assert.deepEqual(
  getChronologicalSceneMarkerContextDisplayTags(marker("1", 10, 20, feet), [
    marker("1", 10, 20, feet),
    marker("2", 0, 30, oral),
    marker("3", 15, 25, bj),
  ]).map((displayTag) => `${displayTag.kind}:${displayTag.tag.id}`),
  ["primary:feet", "overlap:oral", "overlap:bj"],
  "card context tags include every source covering at least half of the marker"
);

assert.deepEqual(
  getChronologicalSceneMarkerDisplayTags(marker("1", 0, 20, boots), [
    marker("1", 0, 20, boots),
  ]).map((displayTag) => `${displayTag.kind}:${displayTag.tag.id}`),
  ["primary:boots", "parent:footwear"],
  "display tags include parent hierarchy tags as the lowest tier"
);

assert.deepEqual(
  getChronologicalSceneMarkerDisplayTags(
    marker("1", 0, 20, footwear, [verga]),
    [
      marker("1", 0, 20, footwear, [verga]),
      marker("2", 10, 30, feet, [verga, bj]),
      marker("3", 5, 25, boots),
    ]
  ).map((displayTag) => `${displayTag.kind}:${displayTag.tag.id}`),
  [
    "primary:footwear",
    "secondary:verga",
    "overlap:boots",
    "overlap:feet",
    "overlap:bj",
  ],
  "duplicate display tags keep the highest directness tier"
);

assert.deepEqual(
  getChronologicalSceneMarkerDisplayTags(
    marker("1", 0, 20, feet, [], [], [], "scene-a"),
    [
      marker("1", 0, 20, feet, [], [], [], "scene-a"),
      marker("2", 10, 30, bj, [], [], [], "scene-b"),
    ]
  ).map((displayTag) => `${displayTag.kind}:${displayTag.tag.id}`),
  ["primary:feet"],
  "display tags do not infer overlaps across different scenes"
);

assert.deepEqual(
  getCompatibleChronologicalSceneMarkerTags(
    [
      marker("1", 0, 100, feet),
      marker("2", 10, 20, verga),
      marker("3", 120, 130, oral),
    ],
    [feet]
  ).map((t) => t.id),
  ["verga"],
  "next tag options only include tags that still produce a direct or inherited-context match"
);

assert.deepEqual(
  getCompatibleChronologicalSceneMarkerTags(
    [marker("1", 0, 100, feet), marker("2", 50, 150, oral)],
    [feet]
  ).map((t) => t.id),
  ["oral"],
  "next tag options include tags that can produce a derived overlap window"
);

assert.deepEqual(
  getCompatibleChronologicalSceneMarkerTags(
    [
      marker("1", 0, 15, feet),
      marker("2", 10, 20, bj),
      marker("3", 18, 25, orgasm),
    ],
    [feet, bj]
  ).map((t) => t.id),
  [],
  "next tag options reject chain overlaps without one shared overlap window"
);

assert.deepEqual(
  getChronologicalSceneMarkerPerformers(
    [
      marker("1", 0, 100, feet, [], [juan]),
      marker("2", 10, 20, verga, [], [luis]),
      marker("3", 120, 130, oral, [], [luis]),
    ],
    [feet, verga],
    "top"
  ).map((p) => p.id),
  ["luis"],
  "performer options are derived from tag-filtered marker results"
);

assert.deepEqual(
  getChronologicalSceneMarkerPerformers(
    [
      marker("1", 0, 100, feet, [], [juan]),
      marker("2", 50, 150, oral, [], [luis]),
    ],
    [feet, oral],
    "top"
  ).map((p) => p.id),
  ["juan", "luis"],
  "performer options include markers contributing to derived overlap windows"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("large-feet", 60, 180, feet),
      marker("small-deepthroat", 75, 85, oral),
      marker("partial-deepthroat", 120, 220, oral),
      marker("below-threshold", 131, 231, oral),
    ],
    { tags: [feet], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["large-feet", "small-deepthroat", "partial-deepthroat"],
  "single-tag filters inherit through majority overlap but reject overlap below fifty percent"
);

const body = tag("body", "Body");
const sex = tag("sex", "Sex");
const facial = tag("facial", "Facial");

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [marker("body-wide", 0, 100, body), marker("sex-narrow", 25, 75, sex)],
    { tags: [body, sex], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["sex-narrow"],
  "a narrower marker inherits from a wider marker without the wider marker inheriting back"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [marker("body-majority", 15, 60, body), marker("sex-source", 30, 150, sex)],
    { tags: [body, sex], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  ["body-majority"],
  "tag inheritance is directed by overlap percentage of the receiving marker"
);

assert.deepEqual(
  filterChronologicalSceneMarkers(
    [
      marker("body-below-half", 0, 60, body),
      marker("sex-source", 30.001, 150, sex),
    ],
    { tags: [body, sex], topPerformers: [], bottomPerformers: [] }
  ).map((m) => m.id),
  [],
  "tag inheritance rejects overlap below fifty percent"
);

assert.deepEqual(
  filterChronologicalSceneMarkers([marker("body-bj", 243, 275, body, [bj])], {
    tags: [body, bj],
    topPerformers: [],
    bottomPerformers: [],
  }).map((m) => m.id),
  ["body-bj"],
  "multi-tag filters match a marker with every selected tag in its own context"
);

assert.deepEqual(
  filterChronologicalSceneMarkers([marker("body-bj", 243, 275, body, [bj])], {
    tags: [bj, body],
    topPerformers: [],
    bottomPerformers: [],
  }).map((m) => m.id),
  ["body-bj"],
  "multi-tag filter order does not affect matching"
);

const scenePerformerTagSummaries = getSceneMarkerPerformerTagSummaries([
  marker("feet", 0, 100, feet, [], [juan], [luis]),
  marker("oral", 0, 100, oral, [], [juan], [luis]),
  marker("body", 0, 100, body, [], [juan], [luis]),
  marker("facial", 20, 30, facial, [], [luis], [juan]),
]);
const juanSceneTagSummary = scenePerformerTagSummaries.find(
  (summary) => summary.performer.id === juan.id
);
const luisSceneTagSummary = scenePerformerTagSummaries.find(
  (summary) => summary.performer.id === luis.id
);

assert.deepEqual(
  juanSceneTagSummary?.topTags.map((summaryTag) => summaryTag.id),
  ["feet", "body", "oral"],
  "scene performer summaries union every direct and computed top tag"
);
assert.deepEqual(
  juanSceneTagSummary?.bottomTags,
  [facial],
  "scene performer summaries preserve bottom tags from contained markers"
);
assert.deepEqual(
  luisSceneTagSummary?.topTags.map((summaryTag) => summaryTag.id),
  ["facial"],
  "scene performer summaries preserve top tags from contained markers"
);
assert.deepEqual(
  luisSceneTagSummary?.bottomTags.map((summaryTag) => summaryTag.id),
  ["feet", "body", "oral"],
  "scene performer summaries union every overlapping computed bottom tag"
);

const duplicateRoleTagSummary = getSceneMarkerPerformerTagSummaries([
  marker("top-feet", 0, 10, feet, [], [juan]),
  marker("bottom-feet", 20, 30, feet, [], [], [juan]),
])[0];

assert.deepEqual(
  [
    duplicateRoleTagSummary.topTags.map((summaryTag) => summaryTag.id),
    duplicateRoleTagSummary.bottomTags.map((summaryTag) => summaryTag.id),
  ],
  [["feet"], ["feet"]],
  "the same scene tag remains visible in both colors when a performer has both roles"
);

const parent = tag("parent", "Parent");
const feetWithParent = tag("feet-parented", "Feet", [parent]);
const tyga = performer("tyga", "Tyga Martinez");
const chase = performer("chase", "Chase Carter");
const feetMarker = marker(
  "highlight-1",
  0,
  10,
  feetWithParent,
  [verga, body],
  [tyga]
);
const overlappingSexMarker = marker(
  "highlight-overlap-1",
  0,
  10,
  sex,
  [],
  [chase],
  [tyga]
);
const performerHighlights = getChronologicalSceneMarkerHighlightPerformers(
  feetMarker,
  [feetMarker, overlappingSexMarker]
);
const tygaHighlights = performerHighlights.find(
  (highlight) => highlight.performer.id === tyga.id
);
const chaseHighlights = performerHighlights.find(
  (highlight) => highlight.performer.id === chase.id
);

assert.ok(
  tygaHighlights,
  "Expected Tyga to be included in highlight performers"
);
assert.deepEqual(
  tygaHighlights.topTags.map((highlightTag) => highlightTag.id),
  ["feet-parented", "verga", "body"],
  "direct marker tags render as top pills for the marker top performer"
);
assert.deepEqual(
  tygaHighlights.bottomTags.map((highlightTag) => highlightTag.id),
  ["sex"],
  "overlapping marker tags render as bottom pills for overlap bottom performers"
);
assert.equal(
  tygaHighlights.topOverlapTagIDs.size,
  0,
  "direct marker tags retain their primary hover-pill treatment"
);
assert.equal(
  tygaHighlights.bottomOverlapTagIDs.has(sex.id),
  true,
  "overlapping marker tags are identified for muted hover-pill treatment"
);
assert.equal(
  tygaHighlights.topTags.some((highlightTag) => highlightTag.id === parent.id),
  false,
  "parent tags do not render as highlight performer pills"
);
assert.ok(
  chaseHighlights,
  "Expected Chase to be included in highlight performers"
);
assert.deepEqual(
  chaseHighlights.topTags.map((highlightTag) => highlightTag.id),
  ["sex"],
  "overlapping marker tags render as top pills for overlap top performers"
);
assert.equal(
  chaseHighlights.topOverlapTagIDs.has(sex.id),
  true,
  "overlapping top tags are identified for muted hover-pill treatment"
);
assert.deepEqual(chaseHighlights.bottomTags, []);

const vergaMarker = marker(
  "highlight-2",
  40,
  50,
  verga,
  [feetWithParent, body],
  [tyga]
);
const secondOverlappingSexMarker = marker(
  "highlight-overlap-2",
  40,
  50,
  sex,
  [],
  [chase],
  [tyga]
);
const groups = groupChronologicalSceneMarkerHighlights(
  [feetMarker, vergaMarker],
  [feetMarker, overlappingSexMarker, vergaMarker, secondOverlappingSexMarker]
);

assert.equal(
  groups.length,
  1,
  "matching highlight performer/tag-role configurations group together"
);
assert.deepEqual(
  groups[0].markers.map((groupMarker) => groupMarker.id),
  ["highlight-1", "highlight-2"],
  "grouping ignores whether a shared pill came from primary or secondary tags"
);
assert.deepEqual(
  groups[0].segments.map((segment) => [segment.seconds, segment.end_seconds]),
  [
    [0, 10],
    [40, 50],
  ],
  "fully matching highlight configurations group their exact segment ranges"
);

const longFeetMarker = marker(
  "highlight-long-feet",
  60,
  180,
  feetWithParent,
  [],
  [tyga]
);
const firstShortSexMarker = marker(
  "activity-overlap-1",
  90,
  100,
  sex,
  [],
  [chase],
  [tyga]
);
const secondShortSexMarker = marker(
  "activity-overlap-2",
  150,
  156,
  sex,
  [],
  [chase],
  [tyga]
);
const standaloneActivityMarker = marker(
  "activity-standalone",
  220,
  230,
  sex,
  [],
  [chase],
  [tyga]
);
const partialOverlapGroups = groupChronologicalSceneMarkerHighlights(
  [longFeetMarker],
  [
    longFeetMarker,
    firstShortSexMarker,
    secondShortSexMarker,
    standaloneActivityMarker,
  ]
);

assert.equal(
  partialOverlapGroups.length,
  1,
  "partial overlaps keep whole-marker highlight grouping without segment splitting"
);
assert.deepEqual(
  partialOverlapGroups.flatMap((group) =>
    group.segments.map((segment) => [segment.seconds, segment.end_seconds])
  ),
  [[60, 180]],
  "only full markers become timeframe pills"
);
assert.equal(
  partialOverlapGroups[0].performers.some(
    (highlight) =>
      highlight.performer.id === chase.id &&
      highlight.topTags.some((highlightTag) => highlightTag.id === sex.id)
  ),
  false,
  "larger highlight markers do not inherit tags from smaller partial-overlap markers"
);
assert.equal(
  partialOverlapGroups.some((group) =>
    group.segments.some((segment) => segment.seconds === 220)
  ),
  false,
  "standalone activity markers outside highlight ranges do not create cards"
);

const containedMarkerGroups = groupChronologicalSceneMarkerHighlights(
  [firstShortSexMarker, secondShortSexMarker],
  [longFeetMarker, firstShortSexMarker, secondShortSexMarker]
);
const containedMarkerGroup = containedMarkerGroups[0];

assert.equal(
  containedMarkerGroups.length,
  1,
  "fully contained markers with matching final configurations group together"
);
assert.deepEqual(
  containedMarkerGroup.segments.map((segment) => [
    segment.seconds,
    segment.end_seconds,
  ]),
  [
    [90, 100],
    [150, 156],
  ],
  "fully contained markers keep their own full marker pills"
);
assert.equal(
  containedMarkerGroup.performers.some(
    (highlight) =>
      highlight.performer.id === tyga.id &&
      highlight.topTags.some(
        (highlightTag) => highlightTag.id === feetWithParent.id
      ) &&
      highlight.bottomTags.some((highlightTag) => highlightTag.id === sex.id)
  ),
  true,
  "fully contained markers inherit containing marker tags as context"
);

const nearEqualFeetMarker = marker(
  "highlight-near-equal-feet",
  300,
  400,
  feetWithParent,
  [],
  [tyga]
);
const nearEqualSexMarker = marker(
  "highlight-near-equal-sex",
  302,
  402,
  sex,
  [],
  [tyga]
);
const nearEqualGroups = groupChronologicalSceneMarkerHighlights(
  [nearEqualFeetMarker, nearEqualSexMarker],
  [nearEqualFeetMarker, nearEqualSexMarker]
);

assert.equal(
  nearEqualGroups.length,
  1,
  "equal-duration markers with mutual majority overlap share one final configuration card"
);
assert.deepEqual(
  nearEqualGroups[0].segments.map((segment) => [
    segment.seconds,
    segment.end_seconds,
  ]),
  [
    [300, 400],
    [302, 402],
  ],
  "near-equal markers still render one full pill per database marker"
);

assert.deepEqual(
  [
    getChronologicalSceneMarkerHighlightPerformerOrgasmRank(
      { performer: tyga, topTags: [orgasm], bottomTags: [] },
      orgasm.id
    ),
    getChronologicalSceneMarkerHighlightPerformerOrgasmRank(
      { performer: chase, topTags: [], bottomTags: [orgasm] },
      orgasm.id
    ),
    getChronologicalSceneMarkerHighlightPerformerOrgasmRank(
      { performer: juan, topTags: [feetWithParent], bottomTags: [] },
      orgasm.id
    ),
  ],
  [0, 1, 2],
  "configured orgasm top performers rank before orgasm bottoms and neutral performers"
);
