import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

// CUSTOM: Render real shared components without connecting to an app database.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_PLAYER_BROWSER_MODULE || "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = ["index.scss", "components/statsBarChart_custom.scss", "components/statsCharts_custom.scss", "components/statsTopCards_custom.scss"].map(file => sass.compile(resolve(ui, "src", file), {
  loadPaths: [ui, resolve(ui, "node_modules")],
  logger: sass.Logger.silent,
}).css).join("\n");
const bundle = await esbuild.build({
  stdin: {
    contents: `
      import React, {useState} from "react";
      import {render} from "react-dom";
      import {IntlProvider} from "react-intl";
      import {BrowserRouter, useHistory} from "react-router-dom";
      import {Badge} from "react-bootstrap";
      import {ModalComponent} from "./src/components/Shared/Modal";
      import {useConfirmActionCustom} from "./src/components/Shared/useConfirmAction_custom";
      import {StatsTopCards} from "./src/components/StatsTopCards_custom";
      import {StatsBarChart} from "./src/components/StatsBarChart_custom";
      import {SEMANTIC_COLORS_CUSTOM as colors} from "./src/utils/semanticColors_custom";
      function Fixture() {
        window.fixtureHistory = useHistory();
        const {confirm, confirmModal} = useConfirmActionCustom();
        const [busy, setBusy] = useState(false);
        const [show, setShow] = useState(false);
        const [readOnly, setReadOnly] = useState(false);
        window.setFixtureBusy = setBusy;
        return <>
          <button onClick={async()=>{window.confirmResult = await confirm({header:"Confirm action", message:"Continue?", confirmText:"Delete"});}}>Confirm</button>
          <button onClick={()=>setShow(true)}>Open busy dialog</button>
          <ModalComponent show={show} header="Busy dialog" onHide={()=>setShow(false)} isRunning={busy}
            accept={{text:"Save",onClick:()=>setShow(false)}} cancel={{text:"Cancel",onClick:()=>setShow(false)}}>Test action</ModalComponent>
          <button onClick={()=>setReadOnly(true)}>Read only</button>
          <ModalComponent show={readOnly} header="Information" onHide={()=>setReadOnly(false)}>Details</ModalComponent>
          <button onClick={async()=>{await document.querySelector("#root").requestFullscreen(); await confirm({header:"Fullscreen confirmation",message:"Continue?",confirmText:"Continue"});}}>Fullscreen confirm</button>
          {confirmModal}
          <Badge variant="role-top">Top</Badge><Badge variant="role-bottom">Bottom</Badge>
          <div className="stats-page">
            <StatsBarChart title="Activity" variant="ranked" unit={["second","seconds"]} total={60} maxValue={60}
              data={[{key:"sex",label:"Fucking",count:60},{key:"oral",label:"Mamando Rifle",count:60},{key:"solo",label:"Jerking",count:30}]} />
            <StatsBarChart title="Quality" variant="ranked" unit={["event","events"]}
              data={[{key:"REGULAR",label:"Regular",count:1},{key:"REALLY_HOT",label:"Really Hot",count:1},{key:"GOAT",label:"GOAT",count:1}]} />
            <StatsBarChart title="Empty" unit={["event","events"]} data={[]} />
            <StatsTopCards title="Rankings" variant="scene" emptyLabel="Empty" items={[{key:"1",title:"Scene One",to:"/scenes/1",value:"1 event"}]} />
          </div>
        </>;
      }
      render(<IntlProvider locale="en" messages={{"actions.cancel":"Cancel","actions.close":"Close"}}><BrowserRouter><Fixture /></BrowserRouter></IntlProvider>,document.querySelector("#root"));
      window.fixtureReady = true;
    `,
    resolveDir: ui,
    loader: "tsx",
  },
  absWorkingDir: ui,
  tsconfig: resolve(ui, "tsconfig.json"),
  bundle: true,
  write: false,
  logLevel: "silent",
  loader: { ".scss": "empty" },
  define: { "process.env.NODE_ENV": '"development"' },
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://consistency.test/**", route => route.fulfill({
    contentType: "text/html",
    body: `<html><head><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
  }));
  await page.goto("http://consistency.test/?from=2026-10-01");
  await page.waitForFunction(() => window.fixtureReady);
  for (const theme of ["", "application-theme-masculine-black"]) {
    await page.evaluate(theme => { document.documentElement.className = theme; }, theme);
    const values = await page.evaluate(() => {
      const style = selector => getComputedStyle(document.querySelector(selector));
      const fill = title => [...document.querySelectorAll(".stats-bar-chart")].find(element => element.textContent.includes(title));
      return {
        roles: [style(".badge-role-top").backgroundColor, style(".badge-role-bottom").backgroundColor],
        activity: [...fill("Activity").querySelectorAll(".stats-bar-chart-fill")].map(element=>getComputedStyle(element).backgroundColor),
        quality: [...fill("Quality").querySelectorAll(".stats-bar-chart-fill")].map(element=>({label:element.closest(".stats-bar-chart-row").querySelector(".stats-bar-chart-label").textContent,background:getComputedStyle(element).backgroundColor,glow:getComputedStyle(element).boxShadow})),
        surface: style(".stats-bar-chart").backgroundColor,
        total: fill("Empty").textContent,
      };
    });
    assert.deepEqual(values.roles,["rgb(23, 162, 184)","rgb(40, 167, 69)"]);
    assert.deepEqual(values.activity,["rgb(217, 130, 43)","rgb(0, 179, 164)","rgb(168, 85, 247)"]);
    assert.deepEqual(Object.fromEntries(values.quality.map(value=>[value.label,value.background])), {Regular:"rgb(138, 155, 168)","Really Hot":"rgb(255, 215, 0)",GOAT:"rgb(91, 141, 239)"});
    assert(values.quality.filter(value=>value.label!=="Regular").every(value=>value.glow!=="none"));
    assert.match(values.total,/0 events/);
    assert.equal(values.surface,theme ? "rgb(17, 19, 21)" : "rgb(48, 64, 77)");
  }
  await page.getByRole("button",{name:"Confirm",exact:true}).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>window.confirmResult===false);
  await page.getByRole("button",{name:"Confirm",exact:true}).click();
  await page.getByRole("button",{name:"Delete",exact:true}).click();
  await page.waitForFunction(()=>window.confirmResult===true);
  await page.getByRole("button",{name:"Read only",exact:true}).click();
  await page.getByRole("button",{name:"Close",exact:true}).last().click();
  await page.getByRole("dialog").waitFor({state:"hidden"});
  await page.getByRole("button",{name:"Confirm",exact:true}).click();
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.getByRole("dialog").waitFor({state:"hidden"});
  await page.getByRole("button",{name:"Fullscreen confirm",exact:true}).click();
  await page.getByRole("dialog").waitFor();
  assert(await page.getByRole("dialog").evaluate(element=>document.fullscreenElement.contains(element)));
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await page.evaluate(()=>document.exitFullscreen());
  await page.getByRole("button",{name:"Open busy dialog",exact:true}).click();
  await page.evaluate(()=>window.setFixtureBusy(true));
  await page.keyboard.press("Escape");
  assert(await page.getByRole("dialog").isVisible());
  assert(await page.getByRole("button",{name:"Cancel",exact:true}).isDisabled());
  await page.evaluate(()=>window.setFixtureBusy(false));
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({state:"hidden"});
  await page.getByRole("button",{name:"View as table",exact:true}).click();
  assert.equal(new URL(page.url()).searchParams.get("rankingView"),"table");
  assert.equal(new URL(page.url()).searchParams.get("from"),"2026-10-01");
  assert(await page.locator(".stats-top-table").isVisible());
  await page.reload();
  await page.locator(".stats-top-table").waitFor();
  await page.getByRole("button",{name:"View as cards",exact:true}).click();
  await page.evaluate(()=>window.fixtureHistory.goBack());
  await page.locator(".stats-top-table").waitFor();
  assert.deepEqual(errors,[]);
  console.log("PASS: both themes preserve semantic chart/badge colors and static glows; empty totals, confirmation dismissal, busy protection, and ranking refresh/back are consistent.");
} finally {
  await browser.close();
}
