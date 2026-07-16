import assert from "node:assert/strict";

import {
  applyApplicationThemeClass,
  masculineBlackThemeClass,
  normalizeApplicationTheme,
} from "../src/utils/applicationTheme_custom.ts";

class FakeClassList {
  private readonly values = new Set<string>();

  add(...tokens: string[]) {
    tokens.forEach((token) => this.values.add(token));
  }

  remove(...tokens: string[]) {
    tokens.forEach((token) => this.values.delete(token));
  }

  has(token: string) {
    return this.values.has(token);
  }
}

assert.equal(
  normalizeApplicationTheme(undefined),
  "default",
  "a missing setting keeps the upstream Stash theme"
);
assert.equal(
  normalizeApplicationTheme("unknown-theme"),
  "default",
  "an unknown stored value safely falls back to the upstream Stash theme"
);
assert.equal(
  normalizeApplicationTheme("masculine-black"),
  "masculine-black",
  "the masculine black theme is preserved"
);

const classList = new FakeClassList();

applyApplicationThemeClass(classList, "masculine-black");
assert.equal(
  masculineBlackThemeClass,
  "application-theme-masculine-black",
  "Black Steel uses the document class expected by its scoped stylesheet"
);
assert.equal(
  classList.has("application-theme-masculine-black"),
  true,
  "selecting Black Steel applies its document class"
);

applyApplicationThemeClass(classList, "default");
assert.equal(
  classList.has(masculineBlackThemeClass),
  false,
  "switching back to default removes the Black Steel class"
);

applyApplicationThemeClass(classList, "masculine-black");
applyApplicationThemeClass(classList, "invalid");
assert.equal(
  classList.has(masculineBlackThemeClass),
  false,
  "invalid settings cannot leave a stale theme class behind"
);
