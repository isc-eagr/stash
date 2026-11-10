import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAppDateCustom,
  formatAppDateTimeCustom,
  getAppLocaleCustom,
  setAppLocaleCustom,
} from "../src/utils/appLocale_custom.ts";

test("O timestamps follow app locale changes and preserve unreadable values", () => {
  const previous = getAppLocaleCustom();
  const value = "2026-10-28T18:30:00Z";
  try {
    for (const locale of ["en-GB", "es-MX"]) {
      setAppLocaleCustom(locale);
      assert.equal(
        formatAppDateTimeCustom(value),
        new Date(value).toLocaleString(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      );
    }
    assert.equal(formatAppDateTimeCustom("missing date"), "missing date");
  } finally {
    setAppLocaleCustom(previous);
  }
});

test("date-only values keep their calendar day in the app locale", () => {
  const previous = getAppLocaleCustom();
  try {
    setAppLocaleCustom("en-GB");
    assert.equal(formatAppDateCustom("2026-03-08"), "8 Mar 2026");
    setAppLocaleCustom("en-US");
    assert.equal(formatAppDateCustom("2026-12-31"), "Dec 31, 2026");
    assert.equal(formatAppDateCustom("soon"), "soon");
  } finally {
    setAppLocaleCustom(previous);
  }
});
