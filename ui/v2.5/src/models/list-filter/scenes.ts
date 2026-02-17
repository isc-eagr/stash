import {
  createMandatoryNumberCriterionOption,
  createMandatoryStringCriterionOption,
  createStringCriterionOption,
  createDateCriterionOption,
  createMandatoryTimestampCriterionOption,
  createDurationCriterionOption,
  ModifierCriterionOption,
  StringBooleanCriterionOption,
  StringBooleanCriterion,
} from "./criteria/criterion";
import { CountryCriterion } from "./criteria/country";
import { CriterionModifier } from "src/core/generated-graphql";
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
import { SceneMarkersCriterionOption } from "./criteria/scene-markers";
import { SceneMarkersExcludeCriterionOption } from "./criteria/scene-markers-exclude";
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
  PerformerRatingCriterionOption,
} from "./criteria/rating";
import { PathCriterionOption } from "./criteria/path";
import { OrientationCriterionOption } from "./criteria/orientation";
import { EthnicityCriterionOption } from "./criteria/ethnicity";
import { SceneCustomFiltersCriterionOption } from "./criteria/custom-filters";
import { SceneSceneTypeCriterionOption } from "./criteria/scene-type";

// Has Marker Performers criterion option
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

const defaultSortBy = "date";
const sortByOptions = [
  "organized",
  "date",
  "effective_date",
  "file_count",
  "filesize",
  "duration",
  "framerate",
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
  createStringCriterionOption("details"),
  createStringCriterionOption("director"),
  createMandatoryStringCriterionOption("oshash", "media_info.hash"),
  createStringCriterionOption("checksum", "media_info.checksum"),
  PhashCriterionOption,
  DuplicatedCriterionOption,
  OrganizedCriterionOption,
  RatingCriterionOption,
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
  HasMarkerPerformersCriterionOption,
  SceneCustomFiltersCriterionOption,
  SceneSceneTypeCriterionOption,
  SceneIsMissingCriterionOption,
  TagsCriterionOption,
  createMandatoryNumberCriterionOption("tag_count"),
  PerformerTagsCriterionOption,
  PerformersCriterionOption,
  createMandatoryNumberCriterionOption("performer_count"),
  PerformerAgeCriterionOption,
  PerformerFavoriteCriterionOption,
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
  // StudioTagsCriterionOption,
  StudiosCriterionOption,
  GroupsCriterionOption,
  LegacyMoviesCriterionOption,
  GalleriesCriterionOption,
  createStringCriterionOption("url"),
  StashIDCriterionOption,
  InteractiveCriterionOption,
  CaptionsCriterionOption,
  createMandatoryNumberCriterionOption("interactive_speed"),
  createMandatoryNumberCriterionOption("file_count"),
  createMandatoryNumberCriterionOption("release_count"),
  createDateCriterionOption("date"),
  createDateCriterionOption("effective_date"),
  createMandatoryTimestampCriterionOption("created_at"),
  createMandatoryTimestampCriterionOption("updated_at"),
];

export const SceneListFilterOptions = new ListFilterOptions(
  defaultSortBy,
  sortByOptions,
  displayModeOptions,
  criterionOptions
);
