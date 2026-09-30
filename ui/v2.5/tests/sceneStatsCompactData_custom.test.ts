import assert from "node:assert/strict";
import test from "node:test";
import { expandSceneStatsCompactData } from "../src/components/SceneStats/sceneStatsCompactData_custom.ts";

test("compact SceneStats rows expand to the dashboard model", () => {
  assert.deepEqual(
    expandSceneStatsCompactData({
      s: {
        r: [
          {
            i: "42",
            t: "Compact scene",
            d: "2025-01-02",
            e: null,
            a: 85,
            o: 3,
            u: 600,
            z: 123456,
            v: 2,
            b: ["7", "8"],
            j: ["Latino"],
            k: ["MX"],
            m: [{ g: ["10", "11"] }],
            g: ["20"],
            x: 1920,
            y: 1080,
            q: "2026-08-01",
            h: true,
          },
        ],
      },
    }),
    {
      scenes: [
        {
          id: "42",
          title: "Compact scene",
          date: "2025-01-02",
          effective_date: null,
          rating100: 85,
          o_counter: 3,
          duration: 600,
          filesize: 123456,
          performer_count: 2,
          performer_ids: ["7", "8"],
          performer_ethnicities: ["Latino"],
          performer_countries: ["MX"],
          scene_markers: [{ tag_ids: ["10", "11"] }],
          tags: ["20"],
          primary_width: 1920,
          primary_height: 1080,
          most_recent_o_date: "2026-08-01",
          has_royal_sapphire_bonus: true,
        },
      ],
    }
  );
  assert.deepEqual(expandSceneStatsCompactData(), {
    scenes: [],
  });
});

test("compact SceneStats accepts an effective date without a duplicate scene date", () => {
  const { scenes } = expandSceneStatsCompactData({
    s: {
      r: [
        {
          i: "42",
          e: "2024-01-02",
          u: 0,
          z: 0,
          v: 0,
          b: [],
          j: [],
          k: [],
          m: [],
          g: [],
          h: false,
        },
      ],
    },
  });
  assert.equal(scenes[0].effective_date, "2024-01-02");
  assert.equal(scenes[0].date, undefined);
});
