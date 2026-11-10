import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getSceneOutstandingCaptionCustom } from "../src/components/Scenes/sceneCardInsightsData_custom.ts";

const roleTagIds = {
  sexTagId: "sex",
  orgasmTagId: "orgasm",
  facialTagId: "facial",
  reallyHotTagId: "really-hot",
  secondCameraTagId: "second-camera",
  goatTagId: "goat",
  outstandingActivityCommonTagIds: ["kissing", "notvisible"],
};

const tag = (id: string, parents: Array<{ id: string }> = []) => ({
  id,
  name: id,
  parents,
});
const orgasmChild = (id: string) => tag(id, [{ id: "orgasm" }]);
const marker = (
  id: string,
  seconds: number,
  endSeconds: number | null,
  primaryTag: ReturnType<typeof tag>,
  tags: Array<ReturnType<typeof tag>> = []
) => ({
  id,
  seconds,
  end_seconds: endSeconds,
  primary_tag: primaryTag,
  tags,
  top_performers: [],
  bottom_performers: [],
});

const caption = getSceneOutstandingCaptionCustom(
  {
    id: "scene-1",
    files: [{ duration: 600 }],
    performers: [],
    scene_markers: [
      marker("kiss", 0, 100, tag("kissing")),
      // A subtag of a hidden tag still shows.
      marker("peck", 100, 110, tag("peck", [{ id: "kissing" }])),
      marker("stomp", 120, 165, tag("stomp"), [tag("goat")]),
      marker("rim", 540, null, tag("rimming")),
      // Orgasm/Facial subtags lead; the tags themselves, Really Hot, and
      // hidden tags do not appear.
      marker("nut", 560, null, tag("orgasm"), [
        orgasmChild("hands-free"),
        orgasmChild("really-hot"),
      ]),
      marker("nut-2", 570, null, orgasmChild("hands-free")),
      marker("face", 580, 585, orgasmChild("facial"), [
        tag("cum-in-eye", [{ id: "facial" }]),
      ]),
      marker("hidden", 590, null, orgasmChild("notvisible")),
      // Activity and 2nd camera are never caption tags.
      marker("sex", 0, 300, tag("sex")),
      marker("cam", 200, 260, tag("feet"), [
        tag("second-camera"),
        orgasmChild("hands-free"),
      ]),
    ],
  },
  roleTagIds
);

assert.deepEqual(
  caption.map(({ name, duration, markerCount }) => [
    name,
    duration,
    markerCount,
  ]),
  [
    ["cum-in-eye", 5, 1],
    ["hands-free", 0, 2],
    ["stomp", 45, 1],
    ["peck", 10, 1],
    ["rimming", 0, 1],
  ],
  "orgasm/facial subtags first, then activity, longest first; exact hidden tags skipped"
);

const sceneCard = readFileSync(
  new URL("../src/components/Scenes/SceneCard.tsx", import.meta.url),
  "utf8"
);
assert.match(
  sceneCard,
  /maybeRenderInteractiveSpeedOverlay\(\)\}\s*\{\/\* CUSTOM: outstanding activity caption \*\/\}\s*<SceneOutstandingCaption scene=\{props\.scene\} \/>/,
  "the caption sits on the thumbnail beside the specs overlay"
);
const captionSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneOutstandingCaption_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
assert.match(captionSource, /const captionLimit = 3;/, "three tags by default");
