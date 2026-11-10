import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tagSelectSource = readFileSync(
  new URL("../src/components/Tags/TagSelect.tsx", import.meta.url),
  "utf8"
);
const tagSelectComponentIndex = tagSelectSource.indexOf(
  "const _TagSelect: React.FC<TagSelectProps>"
);

assert.notEqual(
  tagSelectComponentIndex,
  -1,
  "the TagSelect component remains available"
);

["TagOption", "TagMultiValueLabel", "TagValueLabel"].forEach((rendererName) => {
  const rendererIndex = tagSelectSource.indexOf(
    `const ${rendererName}: React.FC`
  );

  assert.notEqual(
    rendererIndex,
    -1,
    `${rendererName} remains available to react-select`
  );
  assert.ok(
    rendererIndex < tagSelectComponentIndex,
    `${rendererName} stays module-scoped so parent rerenders preserve its component identity`
  );
});

assert.match(
  tagSelectSource,
  /components=\{\{\s*Option: TagOption,\s*MultiValueLabel: TagMultiValueLabel,\s*SingleValue: TagValueLabel,/,
  "TagSelect uses the stable module-scoped renderers"
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
  /function renderPrimaryTagField\(\)[\s\S]*?<TagSelect[\s\S]*?function renderTimeField\(\)/,
  "the primary marker tag uses the stable TagSelect"
);
assert.match(
  markerFormSource,
  /function renderTagsField\(\)[\s\S]*?<TagSelect\s+isMulti[\s\S]*?return renderField\("tag_ids"/,
  "secondary marker tags use the same stable TagSelect"
);
