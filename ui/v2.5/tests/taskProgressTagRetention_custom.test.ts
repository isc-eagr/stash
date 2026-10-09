import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { TaskProgressProject } from "../src/components/TaskProgress/TaskProgressProject.tsx";

const render = (tag_id: string) =>
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      React.createElement(
        MemoryRouter,
        {},
        React.createElement(TaskProgressProject, {
          tracker: { tag_id, tag_name: "Current batch" },
        })
      )
    )
  );
assert.match(render("247"), /href="\/tags\/247"/);
const deleted = render("0");
assert.match(deleted, /Current batch/);
assert.match(deleted, /Deleted tag/);
assert.doesNotMatch(deleted, /href=|<a /);
