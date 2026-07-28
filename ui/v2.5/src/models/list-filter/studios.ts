import {
  createBooleanCriterionOption,
  createMandatoryNumberCriterionOption,
  createMandatoryStringCriterionOption,
  createStringCriterionOption,
  createMandatoryTimestampCriterionOption,
} from "./criteria/criterion";
import { FavoriteStudioCriterionOption } from "./criteria/favorite";
import { StudioIsMissingCriterionOption } from "./criteria/is-missing";
import { RatingCriterionOption } from "./criteria/rating";
import { MetallicRatingCriterionOption } from "./criteria/metallic-rating_custom"; // CUSTOM
import { StashIDCriterionOption } from "./criteria/stash-ids";
import { ParentStudiosCriterionOption } from "./criteria/studios";
import { TagsCriterionOption } from "./criteria/tags";
import { ListFilterOptions } from "./filter-options";
import { DisplayMode } from "./types";
import { CustomFieldsCriterionOption } from "./criteria/custom-fields";
import { StudioActivityTypeCriterionOption } from "./criteria/activity-type_custom"; // CUSTOM
import { QualityTypeCriterionOptionInstance } from "./criteria/quality-type_custom"; // CUSTOM
import {
  StudioPerformerRatingCriteriaCriterionOption,
  StudioRatingCriteriaCriterionOption,
} from "./criteria/rating-criteria_custom"; // CUSTOM

const defaultSortBy = "name";
const sortByOptions = [
  "name",
  "tag_count",
  "random",
  "rating",
  "scenes_duration",
  "scenes_size",
  "latest_scene",
]
  .map(ListFilterOptions.createSortBy)
  .concat([
    {
      messageID: "gallery_count",
      value: "galleries_count",
    },
    {
      messageID: "image_count",
      value: "images_count",
    },
    {
      messageID: "scene_count",
      value: "scenes_count",
    },
    {
      messageID: "subsidiary_studio_count",
      value: "child_count",
    },
    // CUSTOM: begin
    {
      messageID: "sex_scene_count",
      value: "sex_scenes_count",
    },
    {
      messageID: "oral_scene_count",
      value: "oral_scenes_count",
    },
    {
      messageID: "solo_scene_count",
      value: "solo_scenes_count",
    },
    {
      messageID: "facial_scene_count",
      value: "facial_scenes_count",
    },
    {
      messageID: "unique_performer_count",
      value: "unique_performers_count",
    },
    {
      messageID: "o_count",
      value: "o_count",
    },
    {
      messageID: "sex_activity_percent",
      value: "sex_activity_percent",
    },
    {
      messageID: "oral_activity_percent",
      value: "oral_activity_percent",
    },
    {
      messageID: "solo_activity_percent",
      value: "solo_activity_percent",
    },
    {
      messageID: "other_activity_percent",
      value: "other_activity_percent",
    },
    {
      messageID: "outstanding_activity_percent",
      value: "outstanding_activity_percent",
    },
    {
      messageID: "standard_activity_percent",
      value: "standard_activity_percent",
    },
    {
      messageID: "unusable_activity_percent",
      value: "unusable_activity_percent",
    },
    {
      messageID: "rating_criteria_solo_performer_appeal",
      value: "rating_criteria_solo_performer_appeal",
    },
    {
      messageID: "rating_criteria_solo_performance",
      value: "rating_criteria_solo_performance",
    },
    {
      messageID: "rating_criteria_solo_usability",
      value: "rating_criteria_solo_usability",
    },
    {
      messageID: "rating_criteria_top_attractiveness",
      value: "rating_criteria_top_attractiveness",
    },
    {
      messageID: "rating_criteria_bottom_attractiveness",
      value: "rating_criteria_bottom_attractiveness",
    },
    {
      messageID: "rating_criteria_chemistry",
      value: "rating_criteria_chemistry",
    },
    {
      messageID: "rating_criteria_payoff",
      value: "rating_criteria_payoff",
    },
    {
      messageID: "rating_criteria_standout",
      value: "rating_criteria_standout",
    },
    {
      messageID: "rating_criteria_group_top_attractiveness",
      value: "rating_criteria_group_top_attractiveness",
    },
    {
      messageID: "rating_criteria_group_energy",
      value: "rating_criteria_group_energy",
    },
    {
      messageID: "rating_criteria_group_payoff",
      value: "rating_criteria_group_payoff",
    },
    {
      messageID: "rating_criteria_group_usability",
      value: "rating_criteria_group_usability",
    },
    {
      messageID: "average_solo_scene_rating",
      value: "average_solo_scene_rating",
    },
    {
      messageID: "average_standard_scene_rating",
      value: "average_standard_scene_rating",
    },
    {
      messageID: "average_group_scene_rating",
      value: "average_group_scene_rating",
    },
    {
      messageID: "average_performer_rating",
      value: "average_performer_rating",
    },
    // CUSTOM: end
  ]);

const displayModeOptions = [DisplayMode.Grid, DisplayMode.Tagger];
const criterionOptions = [
  FavoriteStudioCriterionOption,
  createMandatoryStringCriterionOption("name"),
  createStringCriterionOption("details"),
  ParentStudiosCriterionOption,
  StudioIsMissingCriterionOption,
  TagsCriterionOption,
  RatingCriterionOption,
  MetallicRatingCriterionOption, // CUSTOM
  StudioActivityTypeCriterionOption, // CUSTOM
  QualityTypeCriterionOptionInstance, // CUSTOM
  StudioRatingCriteriaCriterionOption, // CUSTOM
  StudioPerformerRatingCriteriaCriterionOption, // CUSTOM
  createBooleanCriterionOption("ignore_auto_tag"),
  createBooleanCriterionOption("organized"),
  createMandatoryNumberCriterionOption("tag_count"),
  createMandatoryNumberCriterionOption("scene_count"),
  createMandatoryNumberCriterionOption("image_count"),
  createMandatoryNumberCriterionOption("gallery_count"),
  createStringCriterionOption("url"),
  StashIDCriterionOption,
  createStringCriterionOption("aliases"),
  createMandatoryNumberCriterionOption(
    "child_count",
    "subsidiary_studio_count"
  ),
  createMandatoryTimestampCriterionOption("created_at"),
  createMandatoryTimestampCriterionOption("updated_at"),
  CustomFieldsCriterionOption,
];

export const StudioListFilterOptions = new ListFilterOptions(
  defaultSortBy,
  sortByOptions,
  displayModeOptions,
  criterionOptions
);
