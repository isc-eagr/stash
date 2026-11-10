import assert from "node:assert/strict";
import {
  isFreshPlaygroundSnapshot,
  loadPlaygroundSnapshot,
  playgroundCacheLifetime,
  type IPlaygroundCache,
  type PlaygroundSnapshot,
} from "../src/components/Playground/playgroundSnapshot_custom.ts";
import type { StatsScene } from "../src/components/Shared/statsSceneData_custom.ts";
import {
  playgroundScenesFromSnapshot,
  preparePlaygroundScene,
} from "../src/components/Playground/playgroundData_custom.ts";

const now = 100000000;
const scene: StatsScene = {
  id: "cached-scene",
  title: "Shared scene",
  date: "2026-09-11",
  paths: { screenshot: "/shared-screenshot" },
  studio: { id: "studio", name: "Studio" },
  files: [{ duration: 600 }],
  performers: [
    {
      id: "vato",
      name: "Vato",
      ethnicity: "Latin",
      country: "MX",
      rating100: 80,
      rating_tier_tags: [],
    },
  ],
  rating_tier_tags: [{ id: "gold" }],
  rating_scores: [
    { section: "penalty", key: "production", raw_value: 0, weighted_value: -1 },
  ],
  scene_markers: [
    {
      id: "marker",
      seconds: 0,
      end_seconds: 10,
      primary_tag: { id: "oral", name: "Oral" },
      tags: [],
      top_performers: [],
      bottom_performers: [],
    },
  ],
  scene_marker_tag_ancestors: [],
  negative_markers: [],
};
const snapshot: PlaygroundSnapshot = {
  sceneDataVersion: 2,
  scannedAt: new Date(now).toISOString(),
  scenes: [scene],
};
assert.equal(isFreshPlaygroundSnapshot(snapshot, now), true);
assert.equal(
  isFreshPlaygroundSnapshot(snapshot, now + playgroundCacheLifetime - 1),
  true
);
assert.equal(
  isFreshPlaygroundSnapshot(snapshot, now + playgroundCacheLifetime),
  false
);
assert.equal(isFreshPlaygroundSnapshot(snapshot, now - 1), false);
for (const invalid of [
  undefined,
  null,
  {},
  { ...snapshot, sceneDataVersion: 1 },
  { ...snapshot, scannedAt: "invalid" },
  { ...snapshot, scenes: null },
  { scenes: [scene], scannedAt: snapshot.scannedAt },
]) {
  assert.equal(
    isFreshPlaygroundSnapshot(invalid, now),
    false,
    "legacy and invalid snapshots require an enriched scan"
  );
}
const adapted = playgroundScenesFromSnapshot(snapshot.scenes)[0];
assert.equal(adapted.paths.screenshot, "/shared-screenshot");
assert.equal(adapted.studio?.name, "Studio");
assert.equal(adapted.date, "2026-09-11");
const entry = preparePlaygroundScene(adapted, {
  ratingCardOverrideTagIds: { goldTagId: "gold" },
  roleTagIds: { oralTagId: "oral" },
});
assert.deepEqual(entry.ethnicities, ["Latin"]);
assert.deepEqual(entry.countries, ["MX"]);
assert.equal(entry.metallic, "gold");
assert.equal(entry.sceneType, "oral");
assert.equal(
  entry.adjustments.has("penalty:production"),
  true,
  "weighted-only penalties survive the shared cache"
);
assert.equal(
  "tags" in snapshot.scenes[0],
  false,
  "the adapter does not mutate the stored Playground scene"
);

const stored = new Map<string, unknown>();
const cache: IPlaygroundCache = {
  read: async (key) => stored.get(key),
  write: async (key, value) => {
    stored.set(key, value);
    return true;
  },
  remove: async (key) => {
    stored.delete(key);
  },
};
let loads = 0;
const signal = new AbortController().signal;
const url = "https://example.invalid/stash/graphql";
const options = {
  cache,
  now: () => now,
  load: async (requestURL: string, requestSignal: AbortSignal) => {
    assert.equal(requestURL, url);
    assert.equal(requestSignal, signal);
    loads += 1;
    return [scene];
  },
};
const progress = () =>
  assert.fail("a cache hit must not start network progress");
stored.set(url, snapshot);
const hit = await loadPlaygroundSnapshot(url, signal, progress, options);
assert.equal(hit.snapshot, snapshot);
assert.equal(hit.fromCache, true);
assert.equal(hit.cacheAvailable, true);
assert.equal(loads, 0);

stored.set(url, {
  ...snapshot,
  scannedAt: new Date(now - playgroundCacheLifetime).toISOString(),
});
assert.deepEqual(
  (await loadPlaygroundSnapshot(url, signal, progress, options)).snapshot,
  snapshot
);
assert.equal(loads, 1);
assert.deepEqual(stored.get(url), snapshot);
await loadPlaygroundSnapshot(url, signal, progress, {
  ...options,
  force: true,
});
assert.equal(loads, 2, "manual refresh bypasses a fresh shared cache");
stored.set(url, { scenes: [scene], scannedAt: snapshot.scannedAt });
await loadPlaygroundSnapshot(url, signal, progress, options);
assert.equal(
  loads,
  3,
  "an older shared scan is reloaded once to include Playground fields"
);
await loadPlaygroundSnapshot(url, signal, progress, options);
assert.equal(loads, 3);

stored.clear();
stored.set("https://example.invalid/other/graphql", snapshot);
await loadPlaygroundSnapshot(url, signal, progress, options);
assert.equal(loads, 4, "installations and URL prefixes do not share scenes");
assert.equal(stored.has("https://example.invalid/other/graphql"), true);
const brokenCache: IPlaygroundCache = {
  read: async () => {
    throw new Error("Storage disabled");
  },
  write: async () => {
    throw new Error("Quota exceeded");
  },
  remove: async () => {
    throw new Error("Storage disabled");
  },
};
const uncached = await loadPlaygroundSnapshot(url, signal, progress, {
  ...options,
  cache: brokenCache,
});
assert.deepEqual(uncached.snapshot, snapshot);
assert.equal(uncached.cacheAvailable, false);
assert.deepEqual(
  (
    await loadPlaygroundSnapshot(url, signal, progress, {
      ...options,
      cache: brokenCache,
      force: true,
    })
  ).snapshot,
  snapshot
);
assert.equal(loads, 6);

const cancelled = new AbortController();
await assert.rejects(
  loadPlaygroundSnapshot(url, cancelled.signal, progress, {
    ...options,
    cache: {
      ...cache,
      read: async () => {
        cancelled.abort();
        return snapshot;
      },
    },
  }),
  /cancelled/
);
assert.equal(loads, 6);
stored.delete(url);
const interrupted = new AbortController();
await assert.rejects(
  loadPlaygroundSnapshot(url, interrupted.signal, progress, {
    ...options,
    load: async () => {
      interrupted.abort();
      return [scene];
    },
  }),
  /cancelled/
);
assert.equal(stored.has(url), false);
stored.set(url, snapshot);
await assert.rejects(
  loadPlaygroundSnapshot(url, signal, progress, {
    ...options,
    force: true,
    load: async () => {
      throw new Error("Incomplete scan");
    },
  }),
  /Incomplete scan/
);
assert.equal(
  stored.has(url),
  false,
  "a failed explicit reload cannot silently restore old data"
);
const empty = await loadPlaygroundSnapshot(url, signal, progress, {
  ...options,
  load: async () => [],
});
assert.deepEqual(empty.snapshot.scenes, []);
assert.equal(isFreshPlaygroundSnapshot(stored.get(url), now), true);
console.log("Shared Playground cache and data compatibility tests passed.");
