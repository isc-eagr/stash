const fs = require("fs");
const path = require("path");
const { parse, print, visit } = require("graphql");

const base = path.resolve(__dirname, "..", "graphql");
const definitions = [];
for (const folder of ["data", "queries"]) {
  for (const name of fs.readdirSync(path.join(base, folder))) {
    if (name.endsWith(".graphql")) {
      definitions.push(...parse(fs.readFileSync(path.join(base, folder, name), "utf8")).definitions);
    }
  }
}
const operation = definitions.find((item) => item.kind === "OperationDefinition" && item.name?.value === "FindScene");
const fragments = new Map(definitions.filter((item) => item.kind === "FragmentDefinition").map((item) => [item.name.value, item]));
const included = new Map();
function includeSpreads(node) {
  visit(node, {
    FragmentSpread(spread) {
      const name = spread.name.value;
      if (included.has(name)) return;
      const fragment = fragments.get(name);
      if (!fragment) throw new Error(`Missing fragment ${name}`);
      included.set(name, fragment);
      includeSpreads(fragment);
    },
  });
}
includeSpreads(operation);
const text = [operation, ...included.values()].map(print).join("\n");
fs.writeFileSync(path.resolve(__dirname, "..", "..", "..", ".local", "findscene_query.graphql"), text);
const out = path.resolve(__dirname, "..", "..", "..", ".local");
const releaseOperation = parse('query FindScene($id: ID!) { findScene(id: $id) { releases { ...SceneReleaseData } } }').definitions[0];
function buildDocument(selectedOperation, fragmentMap) {
  const found = new Map();
  function walk(node) {
    visit(node, { FragmentSpread(spread) {
      const name = spread.name.value;
      if (found.has(name)) return;
      const fragment = fragmentMap.get(name);
      if (!fragment) throw new Error(`Missing fragment ${name}`);
      found.set(name, fragment);
      walk(fragment);
    } });
  }
  walk(selectedOperation);
  return [selectedOperation, ...found.values()].map(print).join("\n");
}
fs.writeFileSync(path.join(out, "findscene_releaseonly_query.graphql"), buildDocument(releaseOperation, fragments));
const parentFragments = [...included.values()].map((fragment) => {
  if (fragment.name.value !== "SceneData") return fragment;
  return {
    ...fragment,
    selectionSet: {
      ...fragment.selectionSet,
      selections: fragment.selectionSet.selections.filter((selection) => selection.name?.value !== "releases"),
    },
  };
});
fs.writeFileSync(path.join(out, "findscene_parentonly_query.graphql"), buildDocument(operation, new Map(parentFragments.map((fragment) => [fragment.name.value, fragment]))));
const sceneGroups = {
  scalars: ['id','title','code','details','director','urls','date','effective_date','rating100','o_counter','organized','interactive','interactive_speed','created_at','updated_at','resume_time','last_played_at','play_duration','play_count','play_history','o_history','o_timestamps','custom_fields'],
  rating: ['id','rating_scores'],
  files: ['id','files'],
  media: ['id','paths','captions','sceneStreams'],
  markers: ['id','scene_markers','scene_marker_tag_ancestors'],
  galleries: ['id','galleries','direct_galleries'],
  people: ['id','performers'],
  tags: ['id','tags'],
  groups: ['id','groups'],
  studio: ['id','studio'],
  ranges: ['id','negative_markers','multi_segment_loop_presets'],
  ids: ['id','stash_ids'],
};
for (const [name, fields] of Object.entries(sceneGroups)) {
  const selected = parentFragments.map((fragment) => fragment.name.value !== 'SceneData' ? fragment : {
    ...fragment, selectionSet: { ...fragment.selectionSet,
      selections: fragment.selectionSet.selections.filter((selection) => fields.includes(selection.name?.value)) }
  });
  fs.writeFileSync(path.join(out, `findscene_${name}_query.graphql`), buildDocument(operation, new Map(selected.map((fragment) => [fragment.name.value, fragment]))));
}
console.log(`FindScene with ${included.size} fragments, ${text.length} chars`);
