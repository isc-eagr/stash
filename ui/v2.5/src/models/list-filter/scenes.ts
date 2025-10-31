import {
  createMandatoryNumberCriterionOption,
  createMandatoryStringCriterionOption,
  createStringCriterionOption,
  
  createDateCriterionOption,
  createMandatoryTimestampCriterionOption,
  createDurationCriterionOption,
  ModifierCriterionOption,
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
import { PerformersCriterionOption} from "./criteria/performers";
import { ResolutionCriterionOption } from "./criteria/resolution";
import { StudiosCriterionOption } from "./criteria/studios";
import { InteractiveCriterionOption } from "./criteria/interactive";
import {
  PerformerTagsCriterionOption,
  PerformerSceneTagsCriterionOption,
  PerformerSceneTagPairCriterionOption,
  // StudioTagsCriterionOption,
  TagsCriterionOption,
  SceneMarkerTagsCriterionOption,
} from "./criteria/tags";
import { ListFilterOptions, MediaSortByOptions } from "./filter-options";
import { DisplayMode } from "./types";
import {
  DuplicatedCriterionOption,
  PhashCriterionOption,
} from "./criteria/phash";
import { PerformerFavoriteCriterionOption } from "./criteria/favorite";
import { CaptionsCriterionOption } from "./criteria/captions";
import { StashIDCriterionOption } from "./criteria/stash-ids";
import { RatingCriterionOption, PerformerRatingCriterionOption } from "./criteria/rating";
import { PathCriterionOption } from "./criteria/path";
import { OrientationCriterionOption } from "./criteria/orientation";
import { EthnicityCriterionOption } from "./criteria/ethnicity";
import { PerformerSceneTagsWithAttrsCriterionOption } from "./criteria/performer-scene-tags-with-attrs";

const defaultSortBy = "date";
const sortByOptions = [
  "organized",
  "date",
  "file_count",
  "filesize",
  "duration",
  "framerate",
  "bitrate",
  "last_played_at",
  "last_o_at",
  "resume_time",
  "play_duration",
  "play_count",
  "interactive",
  "interactive_speed",
  "perceptual_similarity",
  ...MediaSortByOptions,
]
  .map(ListFilterOptions.createSortBy)
  .concat([
    {
      messageID: "o_count",
      value: "o_counter",
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
  createMandatoryNumberCriterionOption("o_counter", "o_count"),
  ResolutionCriterionOption,
  OrientationCriterionOption,
  createMandatoryNumberCriterionOption("framerate"),
  createMandatoryNumberCriterionOption("bitrate"),
  createStringCriterionOption("video_codec"),
  createStringCriterionOption("audio_codec"),
  createDurationCriterionOption("duration"),
  createDurationCriterionOption("resume_time"),
  createDurationCriterionOption("play_duration"),
  createMandatoryNumberCriterionOption("play_count"),
  createMandatoryTimestampCriterionOption("last_played_at"),
  HasMarkersCriterionOption,
  SceneIsMissingCriterionOption,
  TagsCriterionOption,
  createMandatoryNumberCriterionOption("tag_count"),
  PerformerTagsCriterionOption,
  PerformerSceneTagsCriterionOption,
  PerformerSceneTagsWithAttrsCriterionOption,
  // compact performer+tag pair criterion
  PerformerSceneTagPairCriterionOption,
  PerformersCriterionOption,
  createMandatoryNumberCriterionOption("performer_count"),
  createMandatoryNumberCriterionOption("performer_age"),
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
      makeCriterion: (o) => new CountryCriterion(o as unknown as ModifierCriterionOption),
    }),
  PerformerRatingCriterionOption,
  SceneMarkerTagsCriterionOption,
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
  createDateCriterionOption("date"),
  createMandatoryTimestampCriterionOption("created_at"),
  createMandatoryTimestampCriterionOption("updated_at"),
];

export const SceneListFilterOptions = new ListFilterOptions(
  defaultSortBy,
  sortByOptions,
  displayModeOptions,
  criterionOptions
);
