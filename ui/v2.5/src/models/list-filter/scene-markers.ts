import { PerformersCriterionOption } from "./criteria/performers";
import { MarkersScenesCriterionOption } from "./criteria/scenes";
// CUSTOM: TagsCriterionOption is still imported for potential future use but commented out in criterionOptions
// Tags functionality is now integrated into MarkerPerformersCriterionOption
import { SceneTagsCriterionOption, TagsCriterionOption } from "./criteria/tags";
import { MarkerPerformersCriterionOption } from "./criteria/marker-performers"; // CUSTOM
import { StudiosCriterionOption } from "./criteria/studios"; // CUSTOM
import { ListFilterOptions } from "./filter-options";
import { ModifierCriterionOption } from "./criteria/criterion"; // CUSTOM
import { CriterionModifier } from "src/core/generated-graphql"; // CUSTOM
import { DisplayMode } from "./types";
import {
  createDateCriterionOption,
  createMandatoryTimestampCriterionOption,
  createNullDurationCriterionOption,
  StringBooleanCriterionOption, // CUSTOM
  StringBooleanCriterion, // CUSTOM
  StringCriterion, // CUSTOM
  BooleanCriterionOption, // CUSTOM
  BooleanCriterion, // CUSTOM
  NumberCriterion, // CUSTOM
} from "./criteria/criterion";
import { SceneMarkerCustomFiltersCriterionOption } from "./criteria/custom-filters"; // CUSTOM
import { HasRolesCriterionOptionInstance } from "./criteria/has-roles"; // CUSTOM

const defaultSortBy = "title";
const sortByOptions = [
  "duration",
  "title",
  "seconds",
  "scene_id",
  "random",
  "scenes_updated_at",
].map(ListFilterOptions.createSortBy);
const displayModeOptions = [DisplayMode.Grid, DisplayMode.Wall];

// CUSTOM: begin
// Scene Director criterion option
const SceneDirectorCriterionOption = new ModifierCriterionOption({
  messageID: "scene_director",
  type: "scene_director",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.Includes,
    CriterionModifier.Excludes,
    CriterionModifier.IsNull,
    CriterionModifier.NotNull,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "text",
  makeCriterion: (o) =>
    new StringCriterion(o as unknown as ModifierCriterionOption),
});

// Has End Time criterion option
const HasEndTimeCriterionOption = new BooleanCriterionOption(
  "has_end_time",
  "has_end_time",
  () => new HasEndTimeCriterion()
);

class HasEndTimeCriterion extends BooleanCriterion {
  constructor() {
    super(HasEndTimeCriterionOption);
  }
}

// Marker Length criterion option (Equals, >=, <=)
// Markers with no end time are treated as 20 seconds
const MarkerLengthCriterionOption: ModifierCriterionOption = new ModifierCriterionOption({
  messageID: "marker_length",
  type: "marker_length",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.GreaterThanEquals,
    CriterionModifier.LessThanEquals,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "number",
  makeCriterion: () => new NumberCriterion(MarkerLengthCriterionOption),
});

// Scene Performer Count criterion option (Equals, >=, <=)
const ScenePerformerCountCriterionOption: ModifierCriterionOption = new ModifierCriterionOption({
  messageID: "scene_performer_count",
  type: "scene_performer_count",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.GreaterThanEquals,
    CriterionModifier.LessThanEquals,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "number",
  makeCriterion: () => new NumberCriterion(ScenePerformerCountCriterionOption),
});
// CUSTOM: end

const criterionOptions = [
  // CUSTOM: Commented out TagsCriterionOption - tags functionality is now integrated
  // into MarkerPerformersCriterionOption for a unified filter experience.
  // Preserving this comment for merge compatibility with upstream.
  // TagsCriterionOption,
  MarkersScenesCriterionOption,
  SceneTagsCriterionOption,
  MarkerPerformersCriterionOption, // CUSTOM
  PerformersCriterionOption,
  StudiosCriterionOption, // CUSTOM
  HasEndTimeCriterionOption, // CUSTOM
  HasRolesCriterionOptionInstance, // CUSTOM
  SceneDirectorCriterionOption, // CUSTOM
  SceneMarkerCustomFiltersCriterionOption, // CUSTOM
  createNullDurationCriterionOption("duration"),
  MarkerLengthCriterionOption, // CUSTOM
  ScenePerformerCountCriterionOption, // CUSTOM
  createMandatoryTimestampCriterionOption("created_at"),
  createMandatoryTimestampCriterionOption("updated_at"),
  createDateCriterionOption("scene_date"),
  createMandatoryTimestampCriterionOption("scene_created_at"),
  createMandatoryTimestampCriterionOption("scene_updated_at"),
];

export const SceneMarkerListFilterOptions = new ListFilterOptions(
  defaultSortBy,
  sortByOptions,
  displayModeOptions,
  criterionOptions
);
