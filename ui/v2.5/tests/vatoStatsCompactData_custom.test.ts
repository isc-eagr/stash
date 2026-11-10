import assert from "node:assert/strict";
import test from "node:test";
import { expandVatoStatsCompactData } from "../src/components/VatoStats/vatoStatsCompactData_custom.ts";

test("compact VatoStats preserves every metric, demographic and age bucket", () => {
  assert.deepEqual(
    expandVatoStatsCompactData({
      p: [
        {
          a: "42",
          b: "Test",
          c: "/image/42",
          d: 85,
          e: 1,
          h: 3,
          i: 4,
          j: 5,
          k: 6,
          l: 7,
          m: 8,
          n: 9,
          o: 10,
          p: "2026-01-02",
          q: 11,
          r: "gold",
          s: "Latino",
          t: "MX",
          u: "Brown",
          v: "Blue",
          w: 180,
          x: 17,
          y: "CUT",
          z: 12,
          ac: [
            { a: "20-29", c: 13 },
            { a: "30-39", c: 14 },
          ],
        },
      ],
    }),
    {
      vatoStatsPerformers: [
        {
          id: "42",
          name: "Test",
          image_path: "/image/42",
          rating100: 85,
          scene_o_count: 1,
          scene_count: 3,
          sex_top_count: 4,
          sex_bottom_count: 5,
          oral_top_count: 6,
          oral_bottom_count: 7,
          solo_scene_count: 8,
          facial_given_count: 9,
          facial_received_count: 10,
          most_recent_o_date: "2026-01-02",
          career_span_days: 11,
          metallic_rating: "gold",
          ethnicity: "Latino",
          country: "MX",
          hair_color: "Brown",
          eye_color: "Blue",
          height_cm: 180,
          penis_length: 17,
          circumcised: "CUT",
          unknown_scene_age_count: 12,
          age_counts: [
            { age_range: "20-29", count: 13 },
            { age_range: "30-39", count: 14 },
          ],
        },
      ],
    }
  );
});

test("compact VatoStats preserves unknowns and an empty scope", () => {
  assert.deepEqual(expandVatoStatsCompactData(), {
    vatoStatsPerformers: [],
  });
  const result = expandVatoStatsCompactData({
    p: [
      {
        a: "1",
        b: "Test",
        c: null,
        d: null,
        e: 0,
        h: 0,
        i: 0,
        j: 0,
        k: 0,
        l: 0,
        m: 0,
        n: 0,
        o: 0,
        p: null,
        q: 0,
        r: null,
        s: null,
        t: null,
        u: null,
        v: null,
        w: null,
        x: null,
        y: null,
        z: 0,
        ac: [],
      },
    ],
  });
  for (const field of [
    "image_path",
    "rating100",
    "most_recent_o_date",
    "metallic_rating",
    "ethnicity",
    "country",
    "hair_color",
    "eye_color",
    "height_cm",
    "penis_length",
    "circumcised",
  ])
    assert.equal(result.vatoStatsPerformers[0][field], null);
  assert.deepEqual(result.vatoStatsPerformers[0].age_counts, []);
});
