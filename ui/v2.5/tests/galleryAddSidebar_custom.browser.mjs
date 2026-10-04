import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_GALLERY_BROWSER_MODULE ||
  "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Exercise the real Add panel and sidebar hook without querying a database.
const bundle = await esbuild.build({
  stdin: {
    contents: `
      import React, { useState } from "react";
      import { render } from "react-dom";
      import { MemoryRouter } from "react-router-dom";
      import { IntlProvider } from "react-intl";
      import localForage from "localforage";
      import { GalleryAddPanel } from "./src/components/Galleries/GalleryDetails/GalleryAddPanel.tsx";
      window.savedSidebar = async () => (await localForage.getItem("interface"))?.viewConfig?.gallery_add?.showSidebar;
      function App() {
        const [gallery, setGallery] = useState("31121");
        return <MemoryRouter><IntlProvider locale="en" messages={{
          "actions.add_to_entity": "Add to {entityType}",
          "gallery": "Gallery",
        }}>
          <button onClick={() => setGallery(undefined)}>Leave</button>
          <button onClick={() => setGallery("31121")}>Gallery one</button>
          <button onClick={() => setGallery("31122")}>Gallery two</button>
          {gallery && <GalleryAddPanel key={gallery} active gallery={{ id: gallery, title: gallery }} />}
        </IntlProvider></MemoryRouter>;
      }
      render(<App />, document.getElementById("root"));
    `,
    resolveDir: ui,
    loader: "tsx",
  },
  absWorkingDir: ui,
  tsconfig: resolve(ui, "tsconfig.json"),
  bundle: true,
  write: false,
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env.DEV": "true",
  },
  plugins: [
    {
      name: "gallery-add-fixture",
      setup(build) {
        build.onLoad({ filter: /[\\/]Images[\\/]ImageList\.tsx$/ }, () => ({
          contents: `
            import React from "react";
            import { useSidebarState } from "src/components/Shared/Sidebar";
            import { useFilteredSidebarKeybinds } from "src/components/List/Filters/FilterSidebar";
            export function FilteredImageList({ view }) {
              const state = useSidebarState(view);
              useFilteredSidebarKeybinds(state);
              if (state.loading) return <div>Loading</div>;
              return <div data-testid="sidebar" data-open={state.showSidebar} data-view={view}>
                <button onClick={() => state.setShowSidebar(!state.showSidebar)}>Toggle sidebar</button>
              </div>;
            }
          `,
          loader: "tsx",
        }));
        build.onLoad({ filter: /[\\/]core[\\/]StashService\.tsx?$/ }, () => ({
          contents: "export const mutateAddGalleryImages = () => {};",
          loader: "ts",
        }));
        build.onLoad({ filter: /[\\/]hooks[\\/]Toast\.tsx$/ }, () => ({
          contents: "export const useToast = () => ({});",
          loader: "ts",
        }));
        build.onLoad({ filter: /[\\/]List[\\/]ItemList\.tsx$/ }, () => ({
          contents: "export const showWhenSelected = () => true;",
          loader: "ts",
        }));
        // Only the Escape key hook is needed; avoid loading filter editors.
        build.onLoad(
          { filter: /[\\/]Filters[\\/]FilterSidebar\.tsx$/ },
          async (args) => {
            const { readFile } = await import("node:fs/promises");
            const source = await readFile(args.path, "utf8");
            return {
              contents: `import { useEffect } from "react"; import Mousetrap from "mousetrap";\n${source.slice(
                source.indexOf("export function useFilteredSidebarKeybinds")
              )}`,
              loader: "ts",
            };
          }
        );
      },
    },
  ],
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://gallery-add.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<div id="root"></div><script>${bundle.outputFiles[0].text}</script>`,
    })
  );
  const expectOpen = async (open) => {
    await page.waitForFunction(
      (expected) =>
        document.querySelector('[data-testid="sidebar"]')?.dataset.open ===
        String(expected),
      open
    );
    assert.equal(
      await page.locator('[data-testid="sidebar"]').getAttribute("data-view"),
      "gallery_add"
    );
  };
  const expectSaved = async (open) => {
    await page.waitForFunction(
      async (expected) => (await window.savedSidebar()) === expected,
      open
    );
  };
  await page.goto("https://gallery-add.test/");
  await expectOpen(false);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expectOpen(true);
  await expectSaved(true);
  await page.getByRole("button", { name: "Gallery two" }).click();
  await expectOpen(true);
  await page.keyboard.press("Escape");
  await expectOpen(false);
  await expectSaved(false);
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await page.getByRole("button", { name: "Gallery one" }).click();
  await expectOpen(false);
  await page.reload();
  await expectOpen(false);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expectSaved(true);
  await page.reload();
  await expectOpen(true);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.reload();
  await expectOpen(false);
  await expectSaved(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expectOpen(true);
  assert.deepEqual(errors, []);
  console.log(
    "Passed Gallery Add sidebar toggle, Escape, remount, reload, and mobile checks."
  );
} finally {
  await browser.close();
}
