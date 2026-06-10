import {
  createMandatoryNumberCriterionOption,
  createMandatoryStringCriterionOption,
  createStringCriterionOption,
  createDateCriterionOption,
  createMandatoryTimestampCriterionOption,
  createDurationCriterionOption,
  ModifierCriterionOption, // CUSTOM
  StringBooleanCriterionOption, // CUSTOM
  StringBooleanCriterion, // CUSTOM
} from "./criteria/criterion";
import { CountryCriterion } from "./criteria/country"; // CUSTOM
import { CriterionModifier } from "src/core/generated-graphql"; // CUSTOM
import { HasMarkersCriterionOption } from "./criteria/has-markers";
import { SceneIsMissingCriterionOption } from "./criteria/is-missing";
import {
  GroupsCriterionOption,
  LegacyMoviesCriterionOption,
} from "./criteria/groups";
import { GalleriesCriterionOption } from "./criteria/galleries";
import { OrganizedCriterionOption } from "./criteria/organized";
import { PerformersCriterionOption } from "./criteria/performers";
import { ResolutionCriterionOption } from "./criteria/resolution";
import { StudiosCriterionOption } from "./criteria/studios";
import { InteractiveCriterionOption } from "./criteria/interactive";
import {
  PerformerTagsCriterionOption,
  // StudioTagsCriterionOption,
  TagsCriterionOption,
} from "./criteria/tags";
import { SceneMarkersCriterionOption } from "./criteria/scene-markers"; // CUSTOM
import { SceneMarkersExcludeCriterionOption } from "./criteria/scene-markers-exclude"; // CUSTOM
import { ListFilterOptions, MediaSortByOptions } from "./filter-options";
import { DisplayMode } from "./types";
import {
  DuplicatedCriterionOption,
  PhashCriterionOption,
} from "./criteria/phash";
import { PerformerFavoriteCriterionOption } from "./criteria/favorite";
import { CaptionsCriterionOption } from "./criteria/captions";
import { StashIDCriterionOption } from "./criteria/stash-ids";
import {
  RatingCriterionOption,
  PerformerRatingCriterionOption, // CUSTOM
} from "./criteria/rating";
import { MetallicRatingCriterionOption } from "./criteria/metallic-rating_custom"; // CUSTOM
import { SceneRatingCriteriaCriterionOption } from "./criteria/rating-criteria_custom"; // CUSTOM
import { PathCriterionOption } from "./criteria/path";
import { OrientationCriterionOption } from "./criteria/orientation";
import { CustomFieldsCriterionOption } from "./criteria/custom-fields";
import { FolderCriterionOption } from "./criteria/folder";
import { EthnicityCriterionOption } from "./criteria/ethnicity"; // CUSTOM
import { SceneCustomFiltersCriterionOption } from "./criteria/custom-filters"; // CUSTOM
import { SceneSceneTypeCriterionOption } from "./criteria/scene-type"; // CUSTOM

// CUSTOM: begin - Has Marker Performers criterion option
const HasMarkerPerformersCriterionOption = new StringBooleanCriterionOption(
  "has_marker_performers",
  "has_marker_performers",
  () => new HasMarkerPerformersCriterion()
);

class HasMarkerPerformersCriterion extends StringBooleanCriterion {
  constructor() {
    super(HasMarkerPerformersCriterionOption);
  }
}
// CUSTOM: end

const defaultSortBy = "date";
const sortByOptions = [
  "organized",
  "date",
  "effective_date", // CUSTOM
  "file_count",
  "filesize",
  "duration",
  "framerate",
  "resolution",
  "bitrate",
  "last_played_at",
  "resume_time",
  "play_duration",
  "play_count",
  "interactive",
  "interactive_speed",
  "perceptual_similarity",
  "performer_age",
  "studio",
  ...MediaSortByOptions,
]
  .map(ListFilterOptions.createSortBy)
  .concat([
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
    {
      messageID: "group_scene_number",
      value: "group_scene_number",
    },
    {
      messageID: "scene_code",
      value: "code",
    },
  ]);
const displayModeOptions = [
  DisplayMode.Grid,
  DisplayMode.List,
  DisplayMode.Wall,
  DisplayMode.Tagger,
];

export const PerformerAgeCriterionOption =
  createMandatoryNumberCriterionOption("performer_age");

export const DurationCriterionOption =
  createDurationCriterionOption("duration");

const criterionOptions = [
  createStringCriterionOption("title"),
  createStringCriterionOption("code", "scene_code"),
  PathCriterionOption,
  FolderCriterionOption,
  createStringCriterionOption("details"),
  createStringCriterionOption("director"),
  createMandatoryStringCriterionOption("oshash", "media_info.oshash"),
  createStringCriterionOption("checksum", "media_info.md5"),
  PhashCriterionOption,
  DuplicatedCriterionOption,
  OrganizedCriterionOption,
  RatingCriterionOption,
  MetallicRatingCriterionOption, // CUSTOM
  SceneRatingCriteriaCriterionOption, // CUSTOM
  createMandatoryNumberCriterionOption("o_counter", "o_count", {
    sfwMessageID: "o_count_sfw",
  }),
  ResolutionCriterionOption,
  OrientationCriterionOption,
  createMandatoryNumberCriterionOption("framerate"),
  createMandatoryNumberCriterionOption("bitrate"),
  createStringCriterionOption("video_codec"),
  createStringCriterionOption("audio_codec"),
  DurationCriterionOption,
  createDurationCriterionOption("resume_time"),
  createDurationCriterionOption("play_duration"),
  createMandatoryNumberCriterionOption("play_count"),
  createMandatoryTimestampCriterionOption("last_played_at"),
  HasMarkersCriterionOption,
  HasMarkerPerformersCriterionOption, // CUSTOM
  SceneCustomFiltersCriterionOption, // CUSTOM
  SceneSceneTypeCriterionOption, // CUSTOM
  SceneIsMissingCriterionOption,
  TagsCriterionOption,
  createMandatoryNumberCriterionOption("tag_count"),
  PerformerTagsCriterionOption,
  PerformersCriterionOption,
  createMandatoryNumberCriterionOption("performer_count"),
  PerformerAgeCriterionOption,
  PerformerFavoriteCriterionOption,
  // CUSTOM: begin
  EthnicityCriterionOption,
  // Specialized country criterion using multi-select editor
  new ModifierCriterionOption({
    messageID: "performer_country",
    type: "performer_country",
    modifierOptions: [
      // IS
      CriterionModifier.Equals,
      // IS NOT
      CriterionModifier.NotEquals,
      // INCLUDES (any one)
      CriterionModifier.Includes,
      // INCLUDES ALL (at least one from each selected country)
      CriterionModifier.IncludesAll,
    ],
    defaultModifier: CriterionModifier.Equals,
    inputType: "text",
    makeCriterion: (o) =>
      new CountryCriterion(o as unknown as ModifierCriterionOption),
  }),
  PerformerRatingCriterionOption,
  SceneMarkersCriterionOption,
  SceneMarkersExcludeCriterionOption,
  // CUSTOM: end
  // StudioTagsCriterionOption,
  StudiosCriterionOption,
  GroupsCriterionOption,
  LegacyMoviesCriterionOption,
  GalleriesCriterionOption,
  createStringCriterionOption("url"),
  StashIDCriterionOption,
  createMandatoryNumberCriterionOption("stash_id_count"),
  InteractiveCriterionOption,
  CaptionsCriterionOption,
  createMandatoryNumberCriterionOption("interactive_speed"),
  createMandatoryNumberCriterionOption("file_count"),
  createMandatoryNumberCriterionOption("release_count"), // CUSTOM
  createDateCriterionOption("date"),
  createDateCriterionOption("effective_date"), // CUSTOM
  createMandatoryTimestampCriterionOption("created_at"),
  createMandatoryTimestampCriterionOption("updated_at"),
  CustomFieldsCriterionOption,
];

export const SceneListFilterOptions = new ListFilterOptions(
  defaultSortBy,
  sortByOptions,
  displayModeOptions,
  criterionOptions
);
