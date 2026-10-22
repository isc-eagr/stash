import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as sass from "sass";
import { SEMANTIC_COLORS_CUSTOM } from "../src/utils/semanticColors_custom.ts";
import { ROLE_COLORS_CUSTOM } from "../src/utils/roleColors_custom.ts";
import {
  STATS_QUALITY_COLORS,
  STATS_METALLIC_COLORS,
  statsSegmentInk,
} from "../src/utils/statsChartColors_custom.ts";
const css = sass.compile(
  new URL(
    "../src/styles/semanticPalette_custom.scss",
    import.meta.url
  ).pathname.replace(/^\/([A-Z]:)/, "$1"),
  { logger: sass.Logger.silent }
).css;
const docs = readFileSync(
  new URL("../../../docs/UI_PALETTE_CUSTOM.md", import.meta.url),
  "utf8"
);
const tokens = [...css.matchAll(/--semantic-([a-z-]+): (#[0-9a-f]+);/g)].filter(
  ([, token]) => !token.endsWith("-ink")
);
assert.equal(
  tokens.length,
  22,
  "Every semantic color has a documented meaning"
);
function luminance(hex: string) {
  const full =
    hex.length === 4
      ? "#" + [...hex.slice(1)].map((value) => value + value).join("")
      : hex;
  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
for (const [, token, color] of tokens) {
  const ink = css.match(
    new RegExp("--semantic-" + token + "-ink: (#[0-9a-f]+);")
  )?.[1];
  assert.ok(ink);
  const levels = [luminance(color), luminance(ink)].sort((a, b) => b - a);
  assert.ok(
    (levels[0] + 0.05) / (levels[1] + 0.05) >= 4.5,
    token + " has readable segment text"
  );
  assert.ok(
    docs
      .split("\n")
      .some(
        (row) =>
          row.includes(color) && new RegExp("\\| " + token + " +\\|").test(row)
      ),
    token + " is documented"
  );
  assert.ok(
    css.includes("--semantic-" + token + "-ink:"),
    token + " has a contrast color"
  );
}
for (const reference of Object.values(SEMANTIC_COLORS_CUSTOM))
  assert.ok(css.includes(reference.slice(4, -1) + ":"), reference);
assert.equal(ROLE_COLORS_CUSTOM.top.variant, "role-top");
assert.equal(ROLE_COLORS_CUSTOM.bottom.variant, "role-bottom");
assert.ok(css.includes(".badge-role-bottom"));
assert.equal(STATS_QUALITY_COLORS.really_hot, SEMANTIC_COLORS_CUSTOM.reallyHot);
assert.equal(STATS_QUALITY_COLORS.goat, SEMANTIC_COLORS_CUSTOM.goat);
assert.equal(
  STATS_METALLIC_COLORS.royal_sapphire,
  SEMANTIC_COLORS_CUSTOM.royalSapphire
);
assert.equal(
  statsSegmentInk(SEMANTIC_COLORS_CUSTOM.goat),
  "var(--semantic-goat-ink)"
);
assert.ok(!/animation:/.test(css), "Semantic colors do not animate");
