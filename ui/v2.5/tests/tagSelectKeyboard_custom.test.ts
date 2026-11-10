import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldPreventCreateOptionEnter } from "../src/components/Tags/tagSelectKeyboard_custom";

function makeSelectRoot(
  activeOptionId: string | null,
  createOptionFocused: boolean
): HTMLElement {
  const activeDescendant = {
    getAttribute: (name: string) =>
      name === "aria-activedescendant" ? activeOptionId : null,
  };
  const focusedOption = {
    getAttribute: (name: string) =>
      name === "data-tag-create-option" && createOptionFocused ? "true" : null,
  };

  return {
    querySelector: (selector: string) =>
      selector === "[aria-activedescendant]" ? activeDescendant : null,
    ownerDocument: {
      getElementById: (id: string) =>
        id === activeOptionId ? focusedOption : null,
    },
  } as unknown as HTMLElement;
}

assert.equal(
  shouldPreventCreateOptionEnter("Enter", makeSelectRoot("new-tag", true)),
  true,
  "Enter is blocked when the create option is focused"
);
assert.equal(
  shouldPreventCreateOptionEnter(
    "Enter",
    makeSelectRoot("existing-tag", false)
  ),
  false,
  "Enter remains available for existing tags"
);
assert.equal(
  shouldPreventCreateOptionEnter("Enter", makeSelectRoot(null, true)),
  false,
  "Enter is unaffected when no option is focused"
);
assert.equal(
  shouldPreventCreateOptionEnter("Tab", makeSelectRoot("new-tag", true)),
  false,
  "the helper only blocks Enter"
);

const tagSelectSource = readFileSync(
  new URL("../src/components/Tags/TagSelect.tsx", import.meta.url),
  "utf8"
);
assert.match(
  tagSelectSource,
  /const isCreateOption = object\.id === "";[\s\S]*?data-tag-create-option/,
  "the create option is marked in every tag selector"
);
assert.match(
  tagSelectSource,
  /if \(\s*shouldPreventCreateOptionEnter\([\s\S]*?event\.preventDefault\(\)[\s\S]*?onKeyDown=\{onKeyDown\}/,
  "TagSelect prevents the keyboard selection before react-select handles it"
);
assert.match(
  tagSelectSource,
  /tabSelectsValue=\{false\}/,
  "Tab navigates away without selecting the create option"
);
