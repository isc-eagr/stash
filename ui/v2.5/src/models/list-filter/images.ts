import {
  createMandatoryNumberCriterionOption,
  createMandatoryStringCriterionOption,
  createStringCriterionOption,
  createMandatoryTimestampCriterionOption,
  createDateCriterionOption,
} from "./criteria/criterion";
import { PerformerFavoriteCriterionOption } from "./criteria/favorite";
import { ImageIsMissingCriterionOption } from "./criteria/is-missing";
import { OrganizedCriterionOption } from "./criteria/organized";
import { PathCriterionOption } from "./criteria/path";
import { PerformersCriterionOption } from "./criteria/performers";
import { RatingCriterionOption, PerformerRatingCriterionOption } from "./criteria/rating";
import { ResolutionCriterionOption } from "./criteria/resolution";
import { OrientationCriterionOption } from "./criteria/orientation";
import { StudiosCriterionOption } from "./criteria/studios";
import {
  PerformerTagsCriterionOption,
  // StudioTagsCriterionOption,
  TagsCriterionOption,
} from "./criteria/tags";
import { ListFilterOptions, MediaSortByOptions } from "./filter-options";
import { DisplayMode } from "./types";
import { GalleriesCriterionOption } from "./criteria/galleries";
import { EthnicityCriterionOption } from "./criteria/ethnicity";
import { CriterionModifier } from "src/core/generated-graphql";
import { ModifierCriterionOption } from "./criteria/criterion";
import { CountryCriterion } from "./criteria/country";

const defaultSortBy = "path";

const sortByOptions = ["filesize", "file_count", "date", ...MediaSortByOptions]
  .map(ListFilterOptions.createSortBy)
  .concat([
    {
      messageID: "o_count",
      value: "o_counter",
    },
  ]);
const displayModeOptions = [DisplayMode.Grid, DisplayMode.Wall];
const criterionOptions = [
  createStringCriterionOption("title"),
  createStringCriterionOption("code", "scene_code"),
  createStringCriterionOption("details"),
  createStringCriterionOption("photographer"),
  createMandatoryStringCriterionOption("checksum", "media_info.checksum"),
  PathCriterionOption,
  GalleriesCriterionOption,
  OrganizedCriterionOption,
  createMandatoryNumberCriterionOption("o_counter", "o_count"),
  ResolutionCriterionOption,
  OrientationCriterionOption,
  ImageIsMissingCriterionOption,
  TagsCriterionOption,
  RatingCriterionOption,
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
  createMandatoryNumberCriterionOption("tag_count"),
  PerformerTagsCriterionOption,
  PerformersCriterionOption,
  createMandatoryNumberCriterionOption("performer_count"),
  createMandatoryNumberCriterionOption("performer_age"),
  PerformerFavoriteCriterionOption,
  // StudioTagsCriterionOption,
  StudiosCriterionOption,
  createStringCriterionOption("url"),
  createDateCriterionOption("date"),
  createMandatoryNumberCriterionOption("file_count"),
  createMandatoryTimestampCriterionOption("created_at"),
  createMandatoryTimestampCriterionOption("updated_at"),
];
export const ImageListFilterOptions = new ListFilterOptions(
  defaultSortBy,
  sortByOptions,
  displayModeOptions,
  criterionOptions
);
