import { PerformersCriterionOption } from "./criteria/performers";
import { MarkersScenesCriterionOption } from "./criteria/scenes";
import { SceneTagsCriterionOption, TagsCriterionOption } from "./criteria/tags";
import { StudiosCriterionOption } from "./criteria/studios";
import { ListFilterOptions } from "./filter-options";
import { ModifierCriterionOption } from "./criteria/criterion";
import { CriterionModifier } from "src/core/generated-graphql";
import { CountryCriterion } from "./criteria/country";
import { PerformerRatingCriterionOption, RatingCriterion } from "./criteria/rating";
import { EthnicityCriterionOption, EthnicityCriterion } from "./criteria/ethnicity";
import { DisplayMode } from "./types";
import { PerformerSceneTagsWithAttrsCriterionOption } from "./criteria/performer-scene-tags-with-attrs";
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
import { PerformersCriterion } from "./criteria/performers";
import { defaultRatingSystemOptions } from "src/utils/rating";

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

// Marker performers criterion option - filters by performers assigned directly to the marker
const MarkerPerformersCriterionOption = new ModifierCriterionOption({
  messageID: "marker_performers",
  type: "marker_performers",
  modifierOptions: [
    CriterionModifier.Includes,
    CriterionModifier.IncludesAll,
    CriterionModifier.Excludes,
    CriterionModifier.IsNull,
    CriterionModifier.NotNull,
  ],
  defaultModifier: CriterionModifier.Includes,
  inputType: "performers",
  makeCriterion: (o) => new PerformersCriterion(o),
});

// Marker performer ethnicity criterion option
const MarkerPerformerEthnicityCriterionOption = new ModifierCriterionOption({
  messageID: "marker_performer_ethnicity",
  type: "marker_performer_ethnicity",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.Includes,
    CriterionModifier.IncludesAll,
  ],
  defaultModifier: CriterionModifier.Includes,
  inputType: "text",
  makeCriterion: (o) => new EthnicityCriterion(o),
});

// Marker performer country criterion option
const MarkerPerformerCountryCriterionOption = new ModifierCriterionOption({
  messageID: "marker_performer_country",
  type: "marker_performer_country",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.Includes,
    CriterionModifier.IncludesAll,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "text",
  makeCriterion: (o) => new CountryCriterion(o as unknown as ModifierCriterionOption),
});

// Marker performer rating criterion option
const MarkerPerformerRatingCriterionOption = new ModifierCriterionOption({
  messageID: "marker_performer_rating",
  type: "marker_performer_rating",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.GreaterThan,
    CriterionModifier.LessThan,
    CriterionModifier.IsNull,
    CriterionModifier.NotNull,
    CriterionModifier.Between,
    CriterionModifier.NotBetween,
  ],
  defaultModifier: CriterionModifier.GreaterThan,
  inputType: "number",
  makeCriterion: (o) => new RatingCriterion(defaultRatingSystemOptions, o as unknown as ModifierCriterionOption),
});

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
  makeCriterion: (o) => new StringCriterion(o),
});

// Has Marker Performers criterion option
const HasMarkerPerformersCriterionOption = new StringBooleanCriterionOption(
  "has_marker_performers",
  "has_marker_performers",
  () => new StringBooleanCriterion(HasMarkerPerformersCriterionOption)
);

// Has End Time criterion option
const HasEndTimeCriterionOption = new BooleanCriterionOption(
  "has_end_time",
  "has_end_time",
  () => new BooleanCriterion(HasEndTimeCriterionOption)
);

const criterionOptions = [
  TagsCriterionOption,
  MarkersScenesCriterionOption,
  SceneTagsCriterionOption,
  PerformerSceneTagsWithAttrsCriterionOption,
  PerformersCriterionOption,
  StudiosCriterionOption,
  EthnicityCriterionOption,
  new ModifierCriterionOption({
    messageID: "performer_country",
    type: "performer_country",
    modifierOptions: [
      CriterionModifier.Equals,
      CriterionModifier.NotEquals,
      CriterionModifier.Includes,
      CriterionModifier.IncludesAll,
    ],
    defaultModifier: CriterionModifier.Equals,
    inputType: "text",
    makeCriterion: (o) => new CountryCriterion(o as unknown as ModifierCriterionOption),
  }),
  PerformerRatingCriterionOption,
  // Marker performer filters (filter by performers assigned directly to the marker)
  MarkerPerformersCriterionOption,
  MarkerPerformerEthnicityCriterionOption,
  MarkerPerformerCountryCriterionOption,
  MarkerPerformerRatingCriterionOption,
  HasMarkerPerformersCriterionOption,
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
