import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.js";
import cx from "classnames";
import ts from "typescript";
import * as scale from "../src/components/Performers/PerformerDetails/versatilityScale_custom.ts";
import * as navigation from "../src/utils/navigation_custom.ts";

let roleTagIds = { sexTagId: "sex", oralTagId: "oral", facialTagId: "facial" };
function loadComponent(file: string) {
  const exports: Record<string, React.FC<any>> = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL(
          `../src/components/Performers/PerformerDetails/${file}`,
          import.meta.url
        ),
        "utf8"
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
      }
    ).outputText,
    {
      exports,
      require: (name: string) => {
        if (name === "react") return React;
        if (name === "classnames") return cx;
        if (name === "./versatilityScale_custom") return scale;
        if (name === "src/utils/navigation_custom") return navigation;
        if (name === "src/hooks/Config")
          return {
            useConfigurationContext: () => ({
              configuration: { ui: { roleTagIds } },
            }),
          };
        if (name === "react-router-dom")
          return {
            Link: ({ to, children, ...props }: any) =>
              React.createElement("a", { href: to, ...props }, children),
          };
        if (
          name.endsWith(".scss") ||
          name === "src/utils/text" ||
          name === "src/components/Shared/HoverPopover"
        )
          return {};
        throw new Error(`Unexpected dependency: ${name}`);
      },
    }
  );
  return exports;
}

const { PerformerCardVersatilityRow } = loadComponent(
  "PerformerCardVersatility_custom.tsx"
);
const cardProps = {
  category: "sex",
  icon: null,
  toppedPartners: 1,
  bottomedPartners: 2,
  topUrl: "/top",
  bottomUrl: "/bottom",
};
const card = renderToStaticMarkup(
  React.createElement(PerformerCardVersatilityRow, {
    ...cardProps,
    showPercentages: true,
  })
);
assert.match(card, /is-bottom">67%/);
assert.match(card, /is-top">33%/);
assert.match(card, /href="\/bottom"[^>]*>2<\/a>/);
assert.match(card, /href="\/top"[^>]*>1<\/a>/);
assert.doesNotMatch(
  renderToStaticMarkup(
    React.createElement(PerformerCardVersatilityRow, cardProps)
  ),
  /performer-versatility-percent/
);
assert.doesNotMatch(
  renderToStaticMarkup(
    React.createElement(PerformerCardVersatilityRow, {
      ...cardProps,
      toppedPartners: 0,
      bottomedPartners: 0,
      showPercentages: true,
    })
  ),
  /performer-versatility-percent/
);

const { PerformerVersatility } = loadComponent(
  "PerformerVersatility_custom.tsx"
);
const detailProps = {
  performer: { id: "42", name: "Vato" },
  linkTarget: "_blank",
  sexToppedPartners: 1,
  sexBottomedPartners: 2,
  oralToppedPartners: 3,
  oralBottomedPartners: 4,
  facialToppedPartners: 5,
  facialBottomedPartners: 0,
};
const detail = renderToStaticMarkup(
  React.createElement(PerformerVersatility, detailProps)
);
const links = [...detail.matchAll(/href="([^"]+)"/g)].map((match) =>
  match[1].replaceAll("&amp;", "&")
);
assert.equal(links.length, 5, "zero partner counts stay unlinked");
for (const [index, role, tag, depth] of [
  [0, "bottom", "sex", 0],
  [1, "top", "sex", 0],
  [2, "bottom", "oral", -1],
  [3, "top", "oral", -1],
] as const) {
  const url = new URL(links[index], "http://localhost");
  assert.equal(url.pathname, "/scenes");
  const criteria = url.searchParams.getAll("c").map(JSON.parse);
  assert.equal(criteria.length, 1, "oral links also include sex scenes");
  const group = criteria[0].groups[0];
  assert.equal(group.tag_ids[0].id, tag);
  assert.equal(group.depth, depth);
  assert.equal(group[`${role}_performer_ids`][0].id, "42");
}
const facial = new URL(links[4], "http://localhost");
assert.equal(facial.pathname, "/scenes/markers");
assert.equal(
  JSON.parse(facial.searchParams.get("c")!).top_performer_ids[0].id,
  "42"
);
assert.match(detail, /target="_blank"/);
roleTagIds = {} as typeof roleTagIds;
assert.doesNotMatch(
  renderToStaticMarkup(React.createElement(PerformerVersatility, detailProps)),
  /href=/,
  "missing configured tags leave readable plain labels"
);
console.log("Versatility percentage and role link tests passed.");
