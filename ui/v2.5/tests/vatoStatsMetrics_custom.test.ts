import assert from "node:assert/strict";
import test from "node:test";
import {
  VATO_O_PER_SCENE_MIN_SCENES,
  buildVatoAgeChartData,
  vatoOPerScene,
} from "../src/components/VatoStats/vatoStatsMetrics_custom.ts";
import {
  performerVersatility,
  performerVersatilityColor,
  performerVersatilityLabel,
  versatilityRoleText,
} from "../src/components/Performers/PerformerDetails/versatilityScale_custom.ts";

test("O's per scene needs enough scenes to rank", () => {
  assert.equal(VATO_O_PER_SCENE_MIN_SCENES, 3);
  assert.equal(vatoOPerScene({ scene_o_count: 9, scene_count: 2 }), undefined);
  assert.equal(vatoOPerScene({ scene_o_count: 9, scene_count: 3 }), 3);
  assert.equal(vatoOPerScene({ scene_o_count: 0, scene_count: 4 }), 0);
});

test("age chart counts distinct vatos per age", () => {
  const result = buildVatoAgeChartData([
    {
      age_counts: [
        { age_range: "24", count: 3 },
        { age_range: "25", count: 1 },
      ],
      unknown_scene_age_count: 0,
    },
    {
      age_counts: [{ age_range: "24", count: 5 }],
      unknown_scene_age_count: 2,
    },
    { age_counts: [], unknown_scene_age_count: 1 },
  ]);
  assert.deepEqual(
    result.data.map((item) => [item.label, item.count]),
    [
      ["24", 2],
      ["25", 1],
    ],
    "scene counts do not inflate the vato count"
  );
  assert.equal(result.unknownCount, 2);
});

test("versatility runs from exclusive bottom to exclusive top by partners", () => {
  assert.equal(performerVersatility(0, 0), undefined);
  assert.equal(performerVersatility(12, 0)?.label, "Exclusive top");
  assert.equal(performerVersatility(0, 9)?.label, "Exclusive bottom");
  assert.equal(performerVersatility(9, 1)?.label, "Mostly top");
  assert.equal(performerVersatility(7, 3)?.label, "Top-leaning versatile");
  assert.equal(performerVersatility(5, 5)?.label, "Versatile");
  assert.equal(performerVersatility(3, 7)?.label, "Bottom-leaning versatile");
  assert.equal(performerVersatilityLabel(0.1), "Mostly bottom");
  assert.equal(performerVersatility(3, 1)?.topShare, 0.75);
});

test("versatility color darkens toward blue for tops and green for bottoms", () => {
  assert.deepEqual(performerVersatilityColor(1), {
    color: "#0d3b8c",
    textColor: "#ffffff",
  });
  assert.deepEqual(performerVersatilityColor(0), {
    color: "#0e5c2e",
    textColor: "#ffffff",
  });
  assert.deepEqual(performerVersatilityColor(0.5), {
    color: "#ced4da",
    textColor: "#16191d",
  });
  const mildTop = performerVersatilityColor(0.6).color;
  const strongTop = performerVersatilityColor(0.9).color;
  const blueLightness = (hex: string) =>
    parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16);
  assert.ok(
    blueLightness(strongTop) < blueLightness(mildTop),
    "more top is darker"
  );
});

test("versatility copy uses the spicy role wording", () => {
  assert.equal(versatilityRoleText("sex", "top", 3), "Fucked 3 vatos");
  assert.equal(versatilityRoleText("sex", "bottom", 1), "Got fucked by 1 vato");
  assert.equal(
    versatilityRoleText("oral", "top", 2),
    "Got his pito sucked by 2 vatos"
  );
  assert.equal(versatilityRoleText("oral", "bottom", 3), "Sucked 3 pitos");
  assert.equal(versatilityRoleText("facial", "top", 1), "Put mecos on 1 face");
  assert.equal(
    versatilityRoleText("facial", "bottom", 2),
    "Took mecos from 2 vatos"
  );
});
