import { PerformersCriterionOption } from "./criteria/performers";
import { MarkersScenesCriterionOption } from "./criteria/scenes";
// CUSTOM: TagsCriterionOption is still imported for potential future use but commented out in criterionOptions
// Tags functionality is now integrated into MarkerPerformersCriterionOption
import { SceneTagsCriterionOption, TagsCriterionOption } from "./criteria/tags";
import { MarkerPerformersCriterionOption } from "./criteria/marker-performers";
import { StudiosCriterionOption } from "./criteria/studios";
import { ListFilterOptions } from "./filter-options";
import { ModifierCriterionOption } from "./criteria/criterion";
import { CriterionModifier } from "src/core/generated-graphql";
import { DisplayMode } from "./types";
import {
  createDateCriterionOption,
  createMandatoryTimestampCriterionOption,
  createNullDurationCriterionOption,
  StringBooleanCriterionOption,
  StringBooleanCriterion,
  StringCriterion,
  BooleanCriterionOption,
  BooleanCriterion,
} from "./criteria/criterion";

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

const criterionOptions = [
  // CUSTOM: Commented out TagsCriterionOption - tags functionality is now integrated
  // into MarkerPerformersCriterionOption for a unified filter experience.
  // Preserving this comment for merge compatibility with upstream.
  // TagsCriterionOption,
  MarkersScenesCriterionOption,
  SceneTagsCriterionOption,
  MarkerPerformersCriterionOption,
  PerformersCriterionOption,
  StudiosCriterionOption,
  HasEndTimeCriterionOption,
  SceneDirectorCriterionOption,
  createNullDurationCriterionOption("duration"),
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
