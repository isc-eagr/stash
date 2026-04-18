import {
  createNumberCriterionOption,
  createMandatoryNumberCriterionOption,
  createStringCriterionOption,
  createBooleanCriterionOption,
  createDateCriterionOption,
  createMandatoryTimestampCriterionOption,
} from "./criteria/criterion";
import { FavoritePerformerCriterionOption } from "./criteria/favorite";
import { GenderCriterionOption } from "./criteria/gender";
import { CircumcisedCriterionOption } from "./criteria/circumcised";
import { PerformerIsMissingCriterionOption } from "./criteria/is-missing";
import { StashIDCriterionOption } from "./criteria/stash-ids";
import { StudiosCriterionOption } from "./criteria/studios";
import { TagsCriterionOption } from "./criteria/tags";
import { ListFilterOptions } from "./filter-options";
import { CriterionType, DisplayMode } from "./types";
import { CountryCriterionOption } from "./criteria/country";
import { RatingCriterionOption } from "./criteria/rating";
import { CustomFieldsCriterionOption } from "./criteria/custom-fields";
import { GroupsCriterionOption } from "./criteria/groups";
// CUSTOM: begin
import { PerformerMarkersCriterionOption } from "./criteria/performer-markers";
import { PerformerMarkersExcludeCriterionOption } from "./criteria/performer-markers-exclude";
import { HasMarkersCriterionOption } from "./criteria/has-markers";
import { ProfileImageCountCriterionOption } from "./criteria/profile-image-count";
import { PerformerCustomFiltersCriterionOption } from "./criteria/custom-filters";
import { PerformerSceneTypeCriterionOption } from "./criteria/scene-type";
// CUSTOM: end

const defaultSortBy = "name";
const sortByOptions = [
  "name",
  "height",
  "birthdate",
  "tag_count",
  "random",
  "rating",
  "penis_length",
  "play_count",
  "last_played_at",
  "latest_scene",
  "career_start",
  "career_end",
  "weight",
  "measurements",
  "scenes_duration",
  "scenes_size",
]
  .map(ListFilterOptions.createSortBy)
  .concat([
    {
      messageID: "scene_count",
      value: "scenes_count",
    },
    {
      messageID: "image_count",
      value: "images_count",
    },
    {
      messageID: "gallery_count",
      value: "galleries_count",
    },
    {
      messageID: "o_count",
      value: "o_counter",
      sfwMessageID: "o_count_sfw",
    },
    {
      messageID: "last_o_at",
      value: "last_o_at",
      sfwMessageID: "last_o_at_sfw",
    },
    // CUSTOM: begin - role-based metric sort options
    {
      messageID: "sex_scene_count",
      value: "sex_scenes_count",
    },
    {
      messageID: "oral_scene_count",
      value: "oral_scenes_count",
    },
    {
      messageID: "facial_scene_count",
      value: "facial_scenes_count",
    },
    {
      messageID: "solo_scene_count",
      value: "solo_scenes_count",
    },
    {
      messageID: "orgasm_count",
      value: "orgasm_count",
    },
    {
      messageID: "feet_markers_count",
      value: "feet_markers_count",
    },
    {
      messageID: "facial_given_count",
      value: "facial_given_count",
    },
    {
      messageID: "facial_received_count",
      value: "facial_received_count",
    },
    {
      messageID: "sex_unique_partners",
      value: "sex_unique_partners",
    },
    {
      messageID: "oral_unique_partners",
      value: "oral_unique_partners",
    },
    {
      messageID: "facial_unique_partners",
      value: "facial_unique_partners",
    },
    {
      messageID: "sex_topped_partners",
      value: "sex_topped_partners",
    },
    {
      messageID: "oral_topped_partners",
      value: "oral_topped_partners",
    },
    {
      messageID: "facial_topped_partners",
      value: "facial_topped_partners",
    },
    {
      messageID: "sex_bottomed_partners",
      value: "sex_bottomed_partners",
    },
    {
      messageID: "oral_bottomed_partners",
      value: "oral_bottomed_partners",
    },
    {
      messageID: "facial_bottomed_partners",
      value: "facial_bottomed_partners",
    },
    // CUSTOM: end
  ]);

const displayModeOptions = [
  DisplayMode.Grid,
  DisplayMode.List,
  DisplayMode.Tagger,
];

const numberCriteria: CriterionType[] = [
  "birth_year",
  "death_year",
  "age",
  "weight",
  "penis_length",
];

const stringCriteria: CriterionType[] = [
  "name",
  "disambiguation",
  "details",
  "ethnicity",
  "hair_color",
  "eye_color",
  "measurements",
  "fake_tits",
  "tattoos",
  "piercings",
  "aliases",
];

const criterionOptions = [
  FavoritePerformerCriterionOption,
  GenderCriterionOption,
  CircumcisedCriterionOption,
  PerformerIsMissingCriterionOption,
  TagsCriterionOption,
  // CUSTOM: begin
  HasMarkersCriterionOption,
  // Custom Filters: predefined complex filters (strict_tops, lenient_tops, strict_bottoms, lenient_bottoms)
  PerformerCustomFiltersCriterionOption,
  // Scene Type: filter performers by scene type (sex, oral, solo, facial)
  PerformerSceneTypeCriterionOption,
  // Performer Markers: filter by markers with specific tags, performer role, and partner attributes
  PerformerMarkersCriterionOption,
  // Performer Markers: Exclude - exclude performers with markers matching these criteria
  PerformerMarkersExcludeCriterionOption,
  // CUSTOM: end
  GroupsCriterionOption,
  StudiosCriterionOption,
  StashIDCriterionOption,
  createStringCriterionOption("url"),
  RatingCriterionOption,
  createMandatoryNumberCriterionOption("tag_count"),
  createMandatoryNumberCriterionOption("scene_count"),
  createMandatoryNumberCriterionOption("image_count"),
  ProfileImageCountCriterionOption, // CUSTOM
  createMandatoryNumberCriterionOption("gallery_count"),
  createMandatoryNumberCriterionOption("play_count"),
  createMandatoryNumberCriterionOption("o_counter", "o_count", {
    sfwMessageID: "o_count_sfw",
  }),
  createBooleanCriterionOption("ignore_auto_tag"),
  CountryCriterionOption,
  createNumberCriterionOption("height_cm", "height"),
  ...numberCriteria.map((c) => createNumberCriterionOption(c)),
  ...stringCriteria.map((c) => createStringCriterionOption(c)),
  createDateCriterionOption("birthdate"),
  createDateCriterionOption("death_date"),
  createDateCriterionOption("career_start"),
  createDateCriterionOption("career_end"),
  createMandatoryTimestampCriterionOption("created_at"),
  createMandatoryTimestampCriterionOption("updated_at"),
  CustomFieldsCriterionOption,
];
export const PerformerListFilterOptions = new ListFilterOptions(
  defaultSortBy,
  sortByOptions,
  displayModeOptions,
  criterionOptions
);
