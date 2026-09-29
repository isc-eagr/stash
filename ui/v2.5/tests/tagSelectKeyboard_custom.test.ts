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
  /selectProps\.createOnClickOnly && object\.id === ""[\s\S]*?data-tag-create-option/,
  "the create option is marked for opted-in tag selectors"
);
assert.match(
  tagSelectSource,
  /props\.createOnClickOnly &&[\s\S]*?shouldPreventCreateOptionEnter\([\s\S]*?onKeyDown=\{onKeyDown\}/,
  "TagSelect prevents the keyboard selection before react-select handles it"
);
assert.match(
  tagSelectSource,
  /tabSelectsValue=\{props\.createOnClickOnly \? false : undefined\}/,
  "Tab navigates away without selecting the create option"
);

const markerFormSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneMarkerForm.tsx",
    import.meta.url
  ),
  "utf8"
);
assert.match(
  markerFormSource,
  /function renderPrimaryTagField\(\)[\s\S]*?<TagSelect[\s\S]*?createOnClickOnly[\s\S]*?function renderTimeField\(\)/,
  "the marker Primary Tag selector requires clicking to create"
);
assert.match(
  markerFormSource,
  /function renderTagsField\(\)[\s\S]*?<TagSelect\s+isMulti[\s\S]*?createOnClickOnly[\s\S]*?return renderField\("tag_ids"/,
  "the marker Tags selector requires clicking to create"
);
