import assert from "node:assert/strict";
import test from "node:test";
import {
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
