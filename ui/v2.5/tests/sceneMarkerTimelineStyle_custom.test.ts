import assert from "node:assert/strict";

import { isSceneMarkerTimelineRoyalSapphire } from "../src/components/ScenePlayer/sceneMarkerTimelineStyle_custom.ts";

type TestTag = {
  id: string;
  parents?: TestTag[];
};

const marker = (primaryTag: TestTag, tags: TestTag[] = []) => ({
  primary_tag: primaryTag,
  tags,
});

const config = {
  goatTagId: "goat",
  royalSapphireTagId: "royal-sapphire",
};

assert.equal(
  isSceneMarkerTimelineRoyalSapphire(marker({ id: "goat" }), config),
  true,
  "a direct GOAT primary tag gives the timeline marker Royal Sapphire styling"
);

assert.equal(
  isSceneMarkerTimelineRoyalSapphire(
    marker({ id: "highlight" }, [
      { id: "goat-child", parents: [{ id: "goat" }] },
    ]),
    config
  ),
  true,
  "a child of the configured GOAT tag gives the timeline marker Royal Sapphire styling"
);

assert.equal(
  isSceneMarkerTimelineRoyalSapphire(marker({ id: "royal-sapphire" }), config),
  true,
  "the configured Royal Sapphire override tag uses the same timeline treatment"
);

assert.equal(
  isSceneMarkerTimelineRoyalSapphire(marker({ id: "plain" }), config),
  false,
  "ordinary timeline markers keep their semantic tag color"
);
