import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_PERFORMER_BROWSER_MODULE ||
  "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = [
  "src/index.scss",
  "src/components/Performers/PerformerDetails/versatilityScale_custom.scss",
]
  .map(
    (path) =>
      sass.compile(resolve(ui, path), {
        loadPaths: [ui, resolve(ui, "node_modules")],
        logger: sass.Logger.silent,
      }).css
  )
  .join("\n");
const bundle = await esbuild.build({
  stdin: {
    contents: `
      import React from "react";
      import { render } from "react-dom";
      import { MemoryRouter } from "react-router-dom";
      import { IntlProvider } from "react-intl";
      import { ConfigurationContext } from "./src/hooks/Config";
      import { SceneCardPerformerPopover } from "./src/components/Scenes/SceneCardPerformerPopover_custom";
      const tag = id => ({ id, name: id });
      const marker = (category, top, bottom, id) => ({
        id, seconds: 0, end_seconds: 10, primary_tag: tag(category), tags: [],
        top_performers: top.map(id => ({id})), bottom_performers: bottom.map(id => ({id})),
      });
      window.showScene = (count, facial = true, oral = true) => {
        const performers = Array.from({ length: count }, (_, i) => ({
          id: String(i + 1), name: i === 1 ? "B Performer with a long wrapping name" : String.fromCharCode(65 + i),
          gender: "MALE", rating100: i === 0 ? 100 : null, tags: [], rating_tier_tags: [],
        }));
        const scene = { id: "scene", performers, files: [{duration: 100}], scene_markers: [
          marker("sex", ["1"], ["2"], "sex"),
          ...(oral ? [marker("oral", ["2"], ["3"], "oral")] : []),
          ...(facial ? [marker("facial", ["1"], ["2"], "facial")] : []),
          ...performers.map(p => marker("orgasm", [p.id], [], "o" + p.id)),
        ] };
        render(<MemoryRouter><IntlProvider locale="en"><ConfigurationContext.Provider value={{configuration: {ui: {
          roleTagIds: {sexTagId: "sex", oralTagId: "oral", facialTagId: "facial", orgasmTagId: "orgasm"},
        }}}}><SceneCardPerformerPopover scene={scene} /></ConfigurationContext.Provider></IntlProvider></MemoryRouter>, document.getElementById("root"));
      };
      window.showScene(6);
    `,
    resolveDir: ui,
    loader: "tsx",
  },
  absWorkingDir: ui,
  tsconfig: resolve(ui, "tsconfig.json"),
  bundle: true,
  write: false,
  logLevel: "silent",
  loader: {
    ".scss": "empty",
    ".css": "empty",
    ".svg": "dataurl",
    ".png": "dataurl",
    ".jpg": "dataurl",
    ".woff2": "dataurl",
  },
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env": "{}",
    "import.meta.env.DEV": "true",
  },
  plugins: [
    {
      name: "show-popover-content",
      setup(build) {
        // Render the real popover content directly so placement/timers cannot
        // affect layout measurements. Performer tiles and strips stay real.
        build.onLoad({ filter: /[\\/]HoverPopover\.tsx$/ }, () => ({
          contents: `import React from "react";
            export const HoverPopover = ({content, children, popoverClassName}) =>
              popoverClassName?.includes("scene-card-performer-count-popover")
                ? <div className={"hover-popover-content popover " + popoverClassName}>{content}</div>
                : <>{children}</>;`,
          loader: "tsx",
          resolveDir: ui,
        }));
      },
    },
  ],
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://performer-popup.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<style>${css}</style><div id="root"></div>`,
    })
  );
  await page.goto("https://performer-popup.test/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  assert.deepEqual(errors, [], "the real performer popup renders");
  const measure = () =>
    page.locator(".scene-marker-activity-performer").evaluateAll((tiles) => {
      const box = (el) => {
        if (!el) return null;
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      };
      return tiles.map((tile) => ({
        portrait: box(
          tile.querySelector(".scene-marker-activity-performer-image")
        ),
        name: box(tile.querySelector(".scene-marker-activity-performer-name")),
        icons: box(tile.querySelector(".performer-role-badges")),
        ...Object.fromEntries(
          ["sex", "oral", "facial"].map((category) => [
            category,
            box(
              tile.querySelector(
                '[data-category="' +
                  category +
                  '"] .performer-card-versatility-track'
              )
            ),
          ])
        ),
      }));
    });
  const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1, message);
  for (const width of [1280, 540, 393]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.showScene(6));
    const tiles = await measure();
    const rows = Map.groupBy
      ? Map.groupBy(tiles, (tile) => tile.portrait.y)
      : tiles.reduce(
          (rows, tile) =>
            rows.set(tile.portrait.y, [
              ...(rows.get(tile.portrait.y) || []),
              tile,
            ]),
          new Map()
        );
    for (const row of rows.values()) {
      for (const category of ["sex", "oral", "facial"]) {
        const bars = row.map((tile) => tile[category]).filter(Boolean);
        for (const bar of bars)
          near(bar.y, bars[0].y, `${category} bars align at width ${width}`);
      }
      for (const tile of row)
        near(
          tile.icons.y,
          row[0].icons.y,
          `missing bars reserve space at width ${width}`
        );
    }
    const bars = tiles
      .flatMap((tile) => [tile.sex, tile.oral, tile.facial])
      .filter(Boolean);
    for (const bar of bars)
      near(bar.width, bars[0].width, `all tracks have equal width at ${width}`);
    if (tiles[0].portrait.y === tiles[1].portrait.y) {
      near(
        tiles[0].sex.y,
        tiles[1].sex.y,
        "rated and unrated performers align"
      );
    }
    // The second visual row has no activities: all three tracks collapse.
    const empty = tiles[tiles.length - 1];
    assert.ok(
      empty.icons.y - (empty.name.y + empty.name.height) < 20,
      "a row with no bars reserves no activity space"
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.showScene(3, true, false));
  const withoutOral = await measure();
  assert.ok(
    withoutOral.every((tile) => !tile.oral),
    "oral is omitted when nobody has it"
  );
  await page.evaluate(() => window.showScene(3, false, false));
  const withoutFacial = await measure();
  assert.ok(
    withoutFacial.every((tile) => !tile.facial),
    "facial is omitted when nobody has it"
  );
  assert.ok(
    withoutFacial[0].icons.y < withoutOral[0].icons.y - 15,
    "removing the last facial bar collapses its track"
  );
  assert.deepEqual(errors, [], "no browser errors during resize or rerender");
  console.log("Scene performer popup layout browser tests passed.");
} finally {
  await browser.close();
}
