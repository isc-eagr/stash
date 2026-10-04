import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Use an installed Playwright runtime without adding a production dependency.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_IMAGE_BROWSER_MODULE ||
  "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(
  require.resolve("bootstrap/dist/css/bootstrap.css"),
  "utf8"
);
const bundle = await esbuild.build({
  stdin: {
    contents: `
      import React from "react";
      import { render } from "react-dom";
      import { IntlProvider } from "react-intl";
      import { ImageInput } from "./src/components/Shared/ImageInput.tsx";
      import { ToastProvider } from "./src/hooks/Toast.tsx";
      render(<IntlProvider locale="en" messages={{
        "actions.set_image": "Set image…",
        "actions.from_file": "From file…",
        "actions.from_url": "From URL…",
        "actions.from_clipboard": "From clipboard",
        "dialogs.set_image_url_title": "Set image URL",
        "actions.confirm": "Confirm",
        "actions.cancel": "Cancel",
        "url": "URL",
      }}><ToastProvider><ImageInput isEditing onImageChange={() => {}}
        onImageURL={(url) => { window.selectedURL = url; }} />
      </ToastProvider></IntlProvider>, document.getElementById("root"));
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
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://image-input.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
        <body><div id="root" style="position:absolute;left:120px;top:80px"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
    })
  );
  await page.goto("https://image-input.test/");
  assert.deepEqual(errors, [], "the ImageInput fixture renders successfully");
  const trigger = page.getByRole("button", { name: "Set image…", exact: true });
  const menu = page.locator("#set-image-popover");
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 393, height: 852 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [top, placement] of [
      [80, "bottom"],
      [300, "top"],
      [viewport.height - 60, "top"],
    ]) {
      await page.locator("#root").evaluate((root, y) => {
        root.style.top = `${y}px`;
      }, top);
      await trigger.click();
      await page.waitForFunction(
        (expected) =>
          document
            .getElementById("set-image-popover")
            ?.getAttribute("data-popper-placement") === expected,
        placement
      );
      const bounds = await menu.boundingBox();
      const button = await trigger.boundingBox();
      assert.ok(bounds && button);
      assert.ok(bounds.y >= 0, "the first option stays inside the viewport");
      assert.ok(bounds.y + bounds.height <= viewport.height);
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
      assert.ok(
        placement === "bottom"
          ? bounds.y >= button.y + button.height
          : bounds.y + bounds.height <= button.y,
        "the menu uses the available side of the button"
      );
      await menu
        .getByText("From file…", { exact: true })
        .click({ trial: true });
      await menu.getByRole("button", { name: "From clipboard" }).click({
        trial: true,
      });
      await trigger.click();
      await menu.waitFor({ state: "hidden" });
    }
  }
  await trigger.click();
  await menu.getByRole("button", { name: "From URL…" }).click();
  await page
    .getByPlaceholder("URL", { exact: true })
    .fill("https://example.test/photo.jpg");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.selectedURL),
    "https://example.test/photo.jpg",
    "the URL action still submits the selected image"
  );
  assert.deepEqual(errors, []);
  console.log("Passed Set Image placement and action browser checks.");
} finally {
  await browser.close();
}
